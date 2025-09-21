import React from 'react';
import { X, Plus, Minus, Trash2, User, MapPin, CreditCard, Truck, Package } from 'lucide-react';

// Define OrderItem interface for this component
interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

interface CartModalProps {
  items: OrderItem[];
  totalAmount: number;
  tableNumber: string;
  onClose: () => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onPlaceOrder: (orderDetails: {
    customerName: string;
    deliveryMethod: 'pickup' | 'delivery';
    deliveryAddress?: string;
    paymentPreference: string;
    customerNotes: string;
  }) => void;
}

export const CartModal: React.FC<CartModalProps> = ({
  items,
  totalAmount,
  tableNumber,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onPlaceOrder,
}) => {
  const [showCheckout, setShowCheckout] = React.useState(false);
  const [customerName, setCustomerName] = React.useState('');
  const [deliveryMethod, setDeliveryMethod] = React.useState<'pickup' | 'delivery'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = React.useState('');
  const [paymentPreference, setPaymentPreference] = React.useState('cash');
  const [customerNotes, setCustomerNotes] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handlePlaceOrder = async () => {
    if (!customerName.trim()) {
      alert('Please enter your name');
      return;
    }

    if (deliveryMethod === 'delivery' && !deliveryAddress.trim()) {
      alert('Please enter delivery address');
      return;
    }

    setIsSubmitting(true);
    try {
      await onPlaceOrder({
        customerName: customerName.trim(),
        deliveryMethod,
        deliveryAddress: deliveryMethod === 'delivery' ? deliveryAddress.trim() : undefined,
        paymentPreference,
        customerNotes: customerNotes.trim() || undefined,
      });
      onClose();
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Failed to place order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setDeliveryAddress(`Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`);
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('Could not get your location. Please enter address manually.');
        }
      );
    } else {
      alert('Geolocation is not supported by this browser.');
    }
  };

  if (items.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-xl">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Your cart is empty</h2>
          <p className="text-gray-600 mb-5 text-sm">Add some delicious items to get started!</p>
          <button
            onClick={onClose}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors"
          >
            Continue Browsing
          </button>
        </div>
      </div>
    );
  }

  if (showCheckout) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-gray-900 w-full max-w-md max-h-[90vh] rounded-2xl overflow-hidden animate-slide-up flex flex-col shadow-xl">
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <h2 className="text-lg font-bold text-white">Order Details</h2>
            <button
              onClick={() => setShowCheckout(false)}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-300" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Customer Name */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Your Name *
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                placeholder="Enter your full name"
                required
              />
            </div>

            {/* Delivery Method */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Delivery Method *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDeliveryMethod('pickup')}
                  className={`p-3 rounded-lg border-2 transition-colors flex items-center justify-center gap-2 ${
                    deliveryMethod === 'pickup'
                      ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
                      : 'border-gray-600 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  Pickup
                </button>
                <button
                  onClick={() => setDeliveryMethod('delivery')}
                  className={`p-3 rounded-lg border-2 transition-colors flex items-center justify-center gap-2 ${
                    deliveryMethod === 'delivery'
                      ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
                      : 'border-gray-600 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <Truck className="w-4 h-4" />
                  Delivery
                </button>
              </div>
            </div>

            {/* Delivery Address */}
            {deliveryMethod === 'delivery' && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  <MapPin className="w-4 h-4 inline mr-2" />
                  Delivery Address *
                </label>
                <div className="space-y-2">
                  <textarea
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                    placeholder="Enter your delivery address"
                    rows={3}
                    required
                  />
                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <MapPin className="w-4 h-4" />
                    Use Current Location
                  </button>
                </div>
              </div>
            )}

            {/* Payment Preference */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                <CreditCard className="w-4 h-4 inline mr-2" />
                Payment Preference
              </label>
              <select
                value={paymentPreference}
                onChange={(e) => setPaymentPreference(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
              >
                <option value="cash">Cash on Delivery/Pickup</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="card">Credit/Debit Card</option>
              </select>
            </div>

            {/* Customer Notes */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Special Instructions (Optional)
              </label>
              <textarea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                placeholder="Any special requests or notes..."
                rows={2}
              />
            </div>

            {/* Order Summary */}
            <div className="bg-gray-800 p-3 rounded-lg">
              <h3 className="text-white font-semibold mb-2">Order Summary</h3>
              <div className="space-y-1 text-sm">
                {items.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex justify-between text-gray-300">
                    <span>{item.name} × {item.quantity}</span>
                    <span>${item.total.toFixed(2)}</span>
                  </div>
                ))}
                {items.length > 3 && (
                  <div className="text-gray-400 text-xs">
                    +{items.length - 3} more items
                  </div>
                )}
                <div className="border-t border-gray-700 pt-2 mt-2 flex justify-between font-bold text-yellow-400">
                  <span>Total</span>
                  <span>${totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-gray-800 bg-gray-800">
            <button
              onClick={handlePlaceOrder}
              disabled={isSubmitting}
              className="w-full bg-yellow-400 text-gray-900 py-3 rounded-lg font-semibold hover:bg-yellow-300 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                  Placing Order...
                </>
              ) : (
                'Place Order for Approval'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 w-full max-w-md max-h-[90vh] rounded-2xl overflow-hidden animate-slide-up flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white">Your Order</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-300" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {items.map((item) => (
            <div key={item.id} className="flex items-center space-x-3 bg-gray-800 rounded-xl p-3">
              <div className="flex-1">
                <h3 className="font-semibold text-sm text-white">{item.name}</h3>
                <p className="text-yellow-400 text-sm font-medium">${item.price.toFixed(2)} each</p>
              </div>

              <div className="flex items-center space-x-2">
                <div className="flex items-center bg-gray-700 rounded-lg border border-gray-600">
                  <button
                    onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                    className="p-2 hover:bg-gray-600 rounded-l-lg transition-colors text-white"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 font-semibold text-sm text-white">{item.quantity}</span>
                  <button
                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    className="p-2 hover:bg-gray-600 rounded-r-lg transition-colors text-white"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-right">
                  <p className="font-bold text-sm text-white">${item.total.toFixed(2)}</p>
                </div>

                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-800 bg-gray-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-base font-bold text-white">Total</span>
            <span className="text-xl font-bold text-yellow-400">${totalAmount.toFixed(2)}</span>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setShowCheckout(true)}
              className="w-full bg-yellow-400 text-gray-900 py-3 rounded-lg font-semibold hover:bg-yellow-300 transition-colors"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};