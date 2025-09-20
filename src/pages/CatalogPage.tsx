import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, Shop, TableBill, OrderItem } from '../types';
import { BottomNav } from '../components/BottomNav';
import { CartModal } from '../components/CartModal';
import { BillModal } from '../components/BillModal';
import { PaymentModal } from '../components/PaymentModal';
import { AboutModal } from '../components/AboutModal';
import { TableHeader } from '../components/TableHeader';
import { 
  ShoppingCart, 
  Search, 
  Filter, 
  Star, 
  Package, 
  ArrowLeft,
  Grid,
  List,
  Heart,
  Share2,
  Eye
} from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

interface CatalogPageProps {}

export default function CatalogPage({}: CatalogPageProps) {
  const { shopName } = useParams<{ shopName: string }>();
  const navigate = useNavigate();
  
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price-low' | 'price-high' | 'newest'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Cart and navigation state
  const [activeTab, setActiveTab] = useState('home');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showBill, setShowBill] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [language, setLanguage] = useState<'en' | 'am'>('en');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  
  // Table and bill state
  const [tableNumber] = useState('1'); // This could be dynamic based on URL params
  const [tableBill, setTableBill] = useState<TableBill | null>(null);

  // Business info for about modal
  const businessInfo = {
    name: shop?.name || 'Restaurant',
    description: shop?.description || 'Welcome to our restaurant! We serve delicious food with excellent service.',
    address: '123 Main Street, City, Country',
    phone: '+1-234-567-8900',
    email: 'info@restaurant.com',
    website: 'https://restaurant.com',
    socialMedia: {
      facebook: 'https://facebook.com/restaurant',
      instagram: 'https://instagram.com/restaurant',
      whatsapp: '+1234567890'
    },
    operatingHours: {
      monday: '9:00 AM - 10:00 PM',
      tuesday: '9:00 AM - 10:00 PM',
      wednesday: '9:00 AM - 10:00 PM',
      thursday: '9:00 AM - 10:00 PM',
      friday: '9:00 AM - 11:00 PM',
      saturday: '10:00 AM - 11:00 PM',
      sunday: '10:00 AM - 10:00 PM'
    },
    features: ['Free WiFi', 'Fresh Food', 'Fast Service', 'Top Rated'],
    specialMessage: 'Thank you for choosing us! We appreciate your business.'
  };

  useEffect(() => {
    if (shopName) {
      loadShopAndProducts();
    }
  }, [shopName]);

  useEffect(() => {
    filterAndSortProducts();
  }, [products, searchTerm, selectedCategory, sortBy]);

  useEffect(() => {
    // Update table bill when cart items change
    if (cartItems.length > 0) {
      const subtotal = cartItems.reduce((sum, item) => sum + item.total, 0);
      const tax = subtotal * 0.1; // 10% tax
      const total = subtotal + tax;
      
      const billItems: OrderItem[] = cartItems.map(item => ({
        productId: item.id,
        productName: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.total
      }));
      
      setTableBill({
        id: `bill-${tableNumber}-${Date.now()}`,
        tableNumber,
        items: billItems,
        subtotal,
        tax,
        total,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } else {
      setTableBill(null);
    }
  }, [cartItems, tableNumber]);

  const loadShopAndProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      // Find shop by name (case-insensitive)
      const shopsQuery = query(
        collection(db, 'shops'),
        where('isActive', '==', true)
      );
      
      const shopsSnapshot = await getDocs(shopsQuery);
      
      // Filter by shop name (case-insensitive)
      const matchingShops = shopsSnapshot.docs.filter(doc => 
        doc.data().name.toLowerCase() === shopName?.toLowerCase()
      );
      
      if (matchingShops.length === 0) {
        setError('Shop not found or inactive');
        setLoading(false);
        return;
      }

      const shopData = {
        id: matchingShops[0].id,
        ...matchingShops[0].data(),
        createdAt: matchingShops[0].data().createdAt?.toDate(),
        updatedAt: matchingShops[0].data().updatedAt?.toDate()
      } as Shop;

      setShop(shopData);

      // Load products for this shop
      const productsQuery = query(
        collection(db, 'products'),
        where('shopId', '==', shopData.id),
        where('isActive', '==', true)
      );

      const productsSnapshot = await getDocs(productsQuery);
      const productsData = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as Product[];

      setProducts(productsData);
    } catch (err) {
      console.error('Error loading shop and products:', err);
      setError('Failed to load shop catalog');
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortProducts = () => {
    let filtered = products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !selectedCategory || product.category === selectedCategory;
      return matchesSearch && matchesCategory && product.stock > 0;
    });

    // Sort products
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'newest':
          return (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0);
        default:
          return 0;
      }
    });

    setFilteredProducts(filtered);
  };

  const categories = Array.from(new Set(products.map(p => p.category))).filter(Boolean);

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
  };

  const handleAddToCart = (product: Product, quantity: number = 1) => {
    const existingItem = cartItems.find(item => item.id === product.id);
    
    if (existingItem) {
      setCartItems(cartItems.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + quantity, total: (item.quantity + quantity) * item.price }
          : item
      ));
    } else {
      const newItem: CartItem = {
        id: product.id,
        name: product.name,
        price: product.price,
        quantity,
        total: product.price * quantity
      };
      setCartItems([...cartItems, newItem]);
    }
  };

  const handleUpdateCartQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveFromCart(itemId);
      return;
    }
    
    setCartItems(cartItems.map(item =>
      item.id === itemId
        ? { ...item, quantity, total: quantity * item.price }
        : item
    ));
  };

  const handleRemoveFromCart = (itemId: string) => {
    setCartItems(cartItems.filter(item => item.id !== itemId));
  };

  const handlePlaceOrder = () => {
    // This would integrate with order placement system
    alert(`Order placed with ${cartItems.length} items!`);
    setCartItems([]);
    setShowCart(false);
  };

  const handleWaiterCall = () => {
    // Send waiter call to Telegram
    const { telegramService } = require('../services/telegram');
    telegramService.sendMessage({
      chat_id: '-1002701066037',
      text: `🔔 <b>Waiter Call</b>\n\nTable ${tableNumber} is requesting assistance.\n\n⏰ ${new Date().toLocaleString()}`,
      parse_mode: 'HTML'
    }).then(() => {
      alert('Waiter has been called!');
    }).catch(() => {
      alert('Failed to call waiter. Please try again.');
    });
  };

  const handleBillClick = () => {
    setShowBill(true);
  };

  const handleSettingsClick = () => {
    setLanguage(language === 'en' ? 'am' : 'en');
  };

  const handleAboutClick = () => {
    setShowAbout(true);
  };

  const handleNotificationToggle = () => {
    setNotificationsEnabled(!notificationsEnabled);
  };

  const handlePaymentOrder = () => {
    setShowBill(false);
    setShowPayment(true);
  };

  const handlePaymentSubmit = async (paymentData: { screenshotUrl: string; method: string }) => {
    // Payment has been submitted and sent to Telegram
    // Clear cart and show success message
    setCartItems([]);
    setTableBill(null);
    alert('Payment submitted successfully! Your order will be processed shortly.');
  };

  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cartItems.reduce((sum, item) => sum + item.total, 0);

  const handleShare = async (product: Product) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: product.description,
          url: window.location.href
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading catalog...</p>
        </div>
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Shop Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'The shop you\'re looking for doesn\'t exist or is inactive.'}</p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Table Header */}
      <TableHeader
        tableNumber={tableNumber}
        language={language}
        orderType="dine-in"
        businessName={shop.name}
        businessLogo={shop.logo}
      />

      {/* Filters */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <button
              onClick={() => navigate('/')}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200 sm:order-first"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div className="flex gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="newest">Newest First</option>
                <option value="name">Name A-Z</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
              
              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200 border border-gray-300 rounded-lg"
              >
                {viewMode === 'grid' ? <List className="w-5 h-5" /> : <Grid className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-600">
              {searchTerm || selectedCategory 
                ? 'Try adjusting your search or filter criteria.'
                : 'This shop doesn\'t have any products yet.'
              }
            </p>
          </div>
        ) : (
          <div className={viewMode === 'grid' 
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
            : 'space-y-4'
          }>
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                viewMode={viewMode}
                onProductClick={handleProductClick}
                onAddToCart={handleAddToCart}
                onShare={handleShare}
              />
            ))}
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
          onShare={handleShare}
        />
      )}

      {/* Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onWaiterCall={handleWaiterCall}
        onBillClick={handleBillClick}
        onCartClick={() => setShowCart(true)}
        onSettingsClick={handleSettingsClick}
        onAboutClick={handleAboutClick}
        cartItemCount={cartItemCount}
        language={language}
        notificationsEnabled={notificationsEnabled}
        onNotificationToggle={handleNotificationToggle}
      />

      {/* Cart Modal */}
      {showCart && (
        <CartModal
          items={cartItems}
          totalAmount={totalAmount}
          tableNumber={tableNumber}
          onClose={() => setShowCart(false)}
          onUpdateQuantity={handleUpdateCartQuantity}
          onRemoveItem={handleRemoveFromCart}
          onPlaceOrder={handlePlaceOrder}
        />
      )}

      {/* Bill Modal */}
      {showBill && (
        <BillModal
          tableBill={tableBill}
          tableNumber={tableNumber}
          businessName={shop.name}
          onClose={() => setShowBill(false)}
          onPaymentOrder={handlePaymentOrder}
        />
      )}

      {/* Payment Modal */}
      {showPayment && tableBill && (
        <PaymentModal
          items={tableBill.items}
          totalAmount={tableBill.total}
          tableNumber={tableNumber}
          onClose={() => setShowPayment(false)}
          onPaymentSubmit={handlePaymentSubmit}
        />
      )}

      {/* About Modal */}
      {showAbout && (
        <AboutModal
          businessInfo={businessInfo}
          language={language}
          onClose={() => setShowAbout(false)}
        />
      )}
    </div>
  );
}

// Product Card Component
interface ProductCardProps {
  product: Product;
  viewMode: 'grid' | 'list';
  onProductClick: (product: Product) => void;
  onAddToCart: (product: Product, quantity?: number) => void;
  onShare: (product: Product) => void;
}

function ProductCard({ product, viewMode, onProductClick, onAddToCart, onShare }: ProductCardProps) {
  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
        <div className="flex items-center space-x-4">
          <div className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
            {product.images && product.images.length > 0 ? (
              <img
                src={product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-8 h-8 text-gray-400" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
            <p className="text-sm text-gray-600 line-clamp-2 mt-1">{product.description}</p>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold text-gray-900">${product.price.toFixed(2)}</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {product.category}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onShare(product);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onProductClick(product)}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToCart(product);
                  }}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors duration-200"
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200 cursor-pointer"
      onClick={() => onProductClick(product)}
    >
      <div className="aspect-w-1 aspect-h-1 bg-gray-200">
        {product.images && product.images.length > 0 ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-48 object-cover"
          />
        ) : (
          <div className="w-full h-48 flex items-center justify-center">
            <Package className="w-12 h-12 text-gray-400" />
          </div>
        )}
      </div>
      
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-900 line-clamp-2 flex-1">{product.name}</h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShare(product);
            }}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors duration-200 ml-2"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
        
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{product.description}</p>
        
        <div className="flex items-center justify-between mb-3">
          <span className="text-lg font-bold text-gray-900">${product.price.toFixed(2)}</span>
          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
            {product.category}
          </span>
        </div>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToCart(product);
          }}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center space-x-2"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Add to Cart</span>
        </button>
      </div>
    </div>
  );
}

// Product Detail Modal Component
interface ProductDetailModalProps {
  product: Product;
  onClose: () => void;
  onAddToCart: (product: Product, quantity?: number) => void;
  onShare: (product: Product) => void;
}

function ProductDetailModal({ product, onClose, onAddToCart, onShare }: ProductDetailModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const images = product.images && product.images.length > 0 ? product.images : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{product.name}</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Images */}
            <div>
              <div className="aspect-w-1 aspect-h-1 bg-gray-200 rounded-lg overflow-hidden mb-4">
                {images.length > 0 ? (
                  <img
                    src={images[currentImageIndex]}
                    alt={product.name}
                    className="w-full h-96 object-cover"
                  />
                ) : (
                  <div className="w-full h-96 flex items-center justify-center">
                    <Package className="w-16 h-16 text-gray-400" />
                  </div>
                )}
              </div>
              
              {images.length > 1 && (
                <div className="flex space-x-2 overflow-x-auto">
                  {images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 ${
                        currentImageIndex === index ? 'border-blue-500' : 'border-gray-200'
                      }`}
                    >
                      <img
                        src={image}
                        alt={`${product.name} ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Info */}
            <div>
              <div className="mb-4">
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                  {product.category}
                </span>
                {product.subcategory && (
                  <span className="ml-2 px-3 py-1 bg-gray-100 text-gray-800 text-sm rounded-full">
                    {product.subcategory}
                  </span>
                )}
              </div>

              <p className="text-gray-600 mb-6">{product.description}</p>

              <div className="mb-6">
                <span className="text-3xl font-bold text-gray-900">${product.price.toFixed(2)}</span>
                {product.sku && (
                  <p className="text-sm text-gray-500 mt-1">SKU: {product.sku}</p>
                )}
              </div>

              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-2">Stock: {product.stock} available</p>
                <div className="flex items-center space-x-4">
                  <label className="text-sm font-medium text-gray-700">Quantity:</label>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                    >
                      -
                    </button>
                    <span className="w-12 text-center">{quantity}</span>
                    <button
                      onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => onAddToCart(product, quantity)}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center space-x-2"
                >
                  <ShoppingCart className="w-5 h-5" />
                  <span>Add to Cart</span>
                </button>
                <button
                  onClick={() => onShare(product)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center justify-center space-x-2"
                >
                  <Share2 className="w-5 h-5" />
                  <span>Share</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}