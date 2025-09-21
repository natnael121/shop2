import React from 'react';
import { X, Plus, Minus, Trash2, User, MapPin, CreditCard, Truck, Package, ArrowRight } from 'lucide-react';

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
    customerPhone: string;
    deliveryMethod: 'pickup' | 'delivery';
    deliveryAddress?: string;
    paymentPreference: string;
    customerNotes: string;
    requiresPaymentConfirmation?: boolean;
    paymentPhotoUrl?: string;
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
  const [customerPhone, setCustomerPhone] = React.useState('');
  const [deliveryMethod, setDeliveryMethod] = React.useState<'pickup' | 'delivery'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = React.useState('');
  const [paymentPreference, setPaymentPreference] = React.useState('cash');
  const [customerNotes, setCustomerNotes] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showPaymentConfirmation, setShowPaymentConfirmation] = React.useState(false);
  const [paymentPhoto, setPaymentPhoto] = React.useState<File | null>(null);

  const handlePlaceOrder = async () => {
    if (!customerName.trim()) {
      alert('Please enter your name');
      return;
    }

    if (deliveryMethod === 'delivery' && !deliveryAddress.trim()) {
      alert('Please enter delivery address');
      return;
    }

    // Check if payment photo is required
    const requiresPhoto = paymentPreference === 'bank_transfer' || paymentPreference === 'mobile_money';
    if (requiresPhoto && !paymentPhoto) {
      alert('Please upload payment proof photo');
      return;
    }

    // Check if payment method requires confirmation
    const requiresConfirmation = paymentPreference === 'bank_transfer' || paymentPreference === 'mobile_money';
    
    if (requiresConfirmation) {
      // Show payment confirmation instead of placing order directly
      setShowPaymentConfirmation(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await onPlaceOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryMethod,
        deliveryAddress: deliveryMethod === 'delivery' ? deliveryAddress.trim() : undefined,
        paymentPreference,
        customerNotes: customerNotes.trim(),
        requiresPaymentConfirmation: false,
      });
      onClose();
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Failed to place order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentConfirmation = async () => {
    if (!paymentPhoto && (paymentPreference === 'bank_transfer' || paymentPreference === 'mobile_money')) {
      alert('Please upload payment proof photo');
      return;
    }

    setIsSubmitting(true);
    try {
      let paymentPhotoUrl = '';
      if (paymentPhoto) {
        // Upload payment photo
        const { imgbbService } = await import('../../services/imgbb');
        paymentPhotoUrl = await imgbbService.uploadImage(paymentPhoto, `payment_${Date.now()}`);
      }

      await onPlaceOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryMethod,
        deliveryAddress: deliveryMethod === 'delivery' ? deliveryAddress.trim() : undefined,
        paymentPreference,
        customerNotes: customerNotes.trim(),
        requiresPaymentConfirmation: true,
        paymentPhotoUrl,
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

  if (showPaymentConfirmation) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-gray-900 w-full max-w-md max-h-[90vh] rounded-2xl overflow-hidden animate-slide-up flex flex-col shadow-xl">
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <h2 className="text-lg font-bold text-white">Payment Confirmation</h2>
            <button
              onClick={() => setShowPaymentConfirmation(false)}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-300" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Order Summary */}
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-white font-semibold mb-3">Order Summary</h3>
              <div className="space-y-2 text-sm">
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

            {/* Payment Instructions */}
            <div className="bg-blue-900/30 border border-blue-700 p-4 rounded-lg">
              <h3 className="text-blue-300 font-semibold mb-3">Payment Instructions</h3>
              {paymentPreference === 'bank_transfer' ? (
                <div className="space-y-2 text-sm text-blue-200">
                  <p><span className="font-medium">Bank:</span> Example Bank</p>
                  <p><span className="font-medium">Account:</span> 123-456-789</p>
                  <p><span className="font-medium">Account Name:</span> Restaurant Name</p>
                  <p><span className="font-medium">Reference:</span> {customerName} - Table {tableNumber}</p>
                  <p><span className="font-medium">Amount:</span> ${totalAmount.toFixed(2)}</p>
                </div>
              ) : (
                <div className="space-y-2 text-sm text-blue-200">
                  <p><span className="font-medium">Service:</span> Telebirr / M-Birr</p>
                  <p><span className="font-medium">Number:</span> +251-912-345-678</p>
                  <p><span className="font-medium">Reference:</span> {customerName} - Table {tableNumber}</p>
                  <p><span className="font-medium">Amount:</span> ${totalAmount.toFixed(2)}</p>
                </div>
              )}
            </div>

            {/* Important Notice */}
            <div className="bg-yellow-900/30 border border-yellow-700 p-4 rounded-lg">
              <h4 className="text-yellow-300 font-semibold mb-2">Important Notice</h4>
              <div className="text-sm text-yellow-200 space-y-1">
                <p>• Complete the payment using the details above</p>
                <p>• Your order will be sent for approval after confirmation</p>
                <p>• Keep your payment receipt for verification</p>
                <p>• You will be notified once your order is approved</p>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-gray-800 bg-gray-800">
            <div className="flex space-x-3">
              <button
                onClick={() => setShowPaymentConfirmation(false)}
                className="flex-1 bg-gray-700 text-white py-3 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
              >
                Back to Order
              </button>
              <button
                onClick={handlePaymentConfirmation}
                disabled={isSubmitting}
                className="flex-1 bg-yellow-400 text-gray-900 py-3 rounded-lg font-semibold hover:bg-yellow-300 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                    Confirming...
                  </>
                ) : (
                  <>
                    Confirm Payment Made
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

            {/* Customer Phone */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Phone Number *
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                placeholder="Enter your phone number"
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

            {/* Payment Photo Upload for bank transfer or mobile money */}
            {(paymentPreference === 'bank_transfer' || paymentPreference === 'mobile_money') && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Payment Proof Photo *
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPaymentPhoto(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-yellow-400 file:text-gray-900 hover:file:bg-yellow-300"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  Upload a screenshot or photo of your payment confirmation
                </p>
              </div>
            )}

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