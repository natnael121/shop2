import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, Shop, TableBill, OrderItem } from '../types';
import { BottomNav } from '../components/BottomNav';
import { CartModal } from '../components/CartModal';
import { BillModal } from '../components/BillModal';
import { PaymentModal } from '../components/PaymentModal';
import { AboutModal } from '../components/AboutModal';
import { TableHeader } from '../components/TableHeader';
import { MenuCard } from '../components/MenuCard';
import { MenuDetail } from '../components/MenuDetail';
import { TelegramService } from '../services/telegram';
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
  
  // Telegram integration state
  const [telegramBotToken, setTelegramBotToken] = useState<string | null>(null);
  const [approvalChatId, setApprovalChatId] = useState<string | null>(null);
  const [billChatId, setBillChatId] = useState<string | null>(null);
  const [paymentChatId, setPaymentChatId] = useState<string | null>(null);
  const [businessInfo, setBusinessInfo] = useState<any>(null);


  useEffect(() => {
    if (shopName) {
      loadShopAndProducts();
    }
  }, [shopName]);

  useEffect(() => {
    if (shop?.ownerId) {
      loadTelegramConfig();
    }
  }, [shop?.ownerId, shop?.id]);

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

  const loadTelegramConfig = async () => {
    if (!shop?.ownerId) return;
    
    try {
      // Fetch bot token from user document
      const userDoc = await getDoc(doc(db, 'users', shop.ownerId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setTelegramBotToken(userData.telegramBotToken || null);
      }

      // Fetch department chat IDs
      const departmentsQuery = query(
        collection(db, 'departments'),
        where('userId', '==', shop.ownerId),
        where('shopId', '==', shop.id)
      );
      
      const departmentsSnapshot = await getDocs(departmentsQuery);
      const departments = departmentsSnapshot.docs.map(doc => doc.data());
      
      // Find relevant chat IDs
      const cashierDept = departments.find(d => d.role === 'cashier');
      const adminDept = departments.find(d => d.role === 'admin');
      
      // Set chat IDs for different purposes
      setApprovalChatId(cashierDept?.telegramChatId || adminDept?.telegramChatId || null);
      setBillChatId(cashierDept?.telegramChatId || adminDept?.telegramChatId || null);
      setPaymentChatId(cashierDept?.telegramChatId || adminDept?.telegramChatId || null);

      // Load business info from shop document
      const shopDoc = await getDoc(doc(db, 'shops', shop.id));
      if (shopDoc.exists()) {
        const shopData = shopDoc.data();
        setBusinessInfo(shopData.businessInfo || {
          name: shop?.name || 'Restaurant',
          logo: shopData.logo || '',
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
          features: ['Free WiFi', 'Fresh Food', 'Fast Service', 'Top Rated'],
          specialMessage: 'Thank you for choosing us! We appreciate your business.'
        });
      }
      
    } catch (error) {
      console.error('Error loading Telegram config:', error);
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
    
    // Show success feedback
    const itemName = product.name;
    const totalQuantity = quantity;
    setTimeout(() => {
      // You could add a toast notification here
      console.log(`Added ${totalQuantity}x ${itemName} to cart`);
    }, 100);
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
    // This is now handled by the enhanced cart modal
    setShowCart(true);
  };

  const handlePlaceOrderWithDetails = async (orderDetails: {
    customerName: string;
    customerPhone: string;
    deliveryMethod: 'pickup' | 'delivery';
    deliveryAddress?: string;
    paymentPreference: string;
    customerNotes?: string;
    requiresPaymentConfirmation?: boolean;
  }) => {
    try {
      // Create order data
      const orderData: any = {
        shopId: shop!.id,
        customerId: orderDetails.customerName,
        customerName: orderDetails.customerName,
        customerPhone: orderDetails.customerPhone,
        items: cartItems.map(item => ({
          productId: item.id,
          productName: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.total
        })),
        total: totalAmount,
        deliveryMethod: orderDetails.deliveryMethod,
        paymentPreference: orderDetails.paymentPreference,
        tableNumber: tableNumber
      };

      // Only include optional fields if they have values
      if (orderDetails.deliveryAddress) {
        orderData.deliveryAddress = orderDetails.deliveryAddress;
      }
      if (orderDetails.customerNotes) {
        orderData.customerNotes = orderDetails.customerNotes;
      }

      // Create the order in database      
      const docRef = await addDoc(collection(db, 'orders'), {
        ...orderData,
        status: orderDetails.requiresPaymentConfirmation ? 'payment_pending' : 'pending',
        paymentStatus: orderDetails.requiresPaymentConfirmation ? 'confirmation_required' : 'pending',
        requiresPaymentConfirmation: orderDetails.requiresPaymentConfirmation || false,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Add the order ID to the data for Telegram
      const orderWithId = { ...orderData, id: docRef.id };

      // Send order to Telegram for admin approval
      if (telegramBotToken && approvalChatId) {
        const telegram = new TelegramService(telegramBotToken);
        if (orderDetails.requiresPaymentConfirmation) {
          await telegram.sendPaymentConfirmationOrder(orderWithId, approvalChatId);
        } else {
          await telegram.sendOrderForApproval(orderWithId, approvalChatId);
        }
      }

      // Clear cart and show success message
      setCartItems([]);
      setShowCart(false);
      
      if (orderDetails.requiresPaymentConfirmation) {
        alert('Order submitted with payment confirmation! Please wait for approval after payment verification.');
      } else {
        alert('Order submitted for approval! You will be notified once it\'s reviewed.');
      }
    } catch (error) {
      console.error('Error placing order:', error);
      throw error;
    }
  };

  const handleWaiterCall = () => {
    if (telegramBotToken && approvalChatId) {
      const telegram = new TelegramService(telegramBotToken);
      telegram.sendMessage({
        chat_id: approvalChatId,
        text: `🔔 <b>Waiter Call</b>\n\nTable ${tableNumber} is requesting assistance.\n\n⏰ ${new Date().toLocaleString()}`,
        parse_mode: 'HTML'
      }).then(() => {
        alert('Waiter has been called!');
      }).catch(() => {
        alert('Failed to call waiter. Please try again.');
      });
    } else {
      alert('Telegram integration not configured. Please contact the restaurant.');
    }
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
    <div className="min-h-screen bg-gray-50 pb-20 overflow-x-hidden">
      {/* Table Header */}
      <TableHeader
        tableNumber={tableNumber}
        language={language}
        orderType="dine-in"
        businessName={shop.name}
        businessLogo={businessInfo?.logo}
      />

      {/* Filters */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <button
              onClick={() => navigate('/')}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200 sm:order-first"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div className="flex gap-2 flex-shrink-0">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-0"
              >
                <option value="">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-0"
              >
                <option value="newest">Newest First</option>
                <option value="name">Name A-Z</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
              
              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200 border border-gray-300 rounded-lg flex-shrink-0"
              >
                {viewMode === 'grid' ? <List className="w-5 h-5" /> : <Grid className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 overflow-y-auto">
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
            ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 auto-rows-fr'
            : 'space-y-4'
          }>
            {filteredProducts.map((product) => (
              <MenuCard
                key={product.id}
                product={product}
                onClick={() => handleProductClick(product)}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <MenuDetail
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
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
          onPlaceOrder={handlePlaceOrderWithDetails}
        />
      )}

      {/* Bill Modal */}
      {showBill && (
        <BillModal
          tableBill={tableBill}
          tableNumber={tableNumber}
          businessName={shop.name}
          botToken={telegramBotToken}
          billChatId={billChatId}
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
          botToken={telegramBotToken}
          paymentChatId={paymentChatId}
          onClose={() => setShowPayment(false)}
          onPaymentSubmit={handlePaymentSubmit}
        />
      )}

      {/* About Modal */}
      {showAbout && businessInfo && (
        <AboutModal
          businessInfo={businessInfo}
          language={language}
          onClose={() => setShowAbout(false)}
        />
      )}
    </div>
  );
}
