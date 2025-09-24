import React, { useEffect, useState } from 'react'
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  getDoc,
  orderBy 
} from 'firebase/firestore'
import { useFirebase } from '../contexts/FirebaseContext'
import { useTelegram } from '../contexts/TelegramContext'
import { Shop, Product, Category, Department, UserData } from '../types'
import { 
  Store, 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Package, 
  DollarSign,
  Image,
  FileText,
  Star,
  MapPin,
  Phone,
  Clock,
  Users,
  BarChart3,
  Bell,
  ShoppingCart,
  Tag,
  User
} from 'lucide-react'

const AdminPanel: React.FC = () => {
  const { db } = useFirebase()
  const { user } = useTelegram()
  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [ownedShops, setOwnedShops] = useState<Shop[]>([])
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'departments' | 'analytics' | 'profile'>('profile')
  const [editingShop, setEditingShop] = useState<Shop | null>(null)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [showAddDepartment, setShowAddDepartment] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<any>(null)

  // Load bot token when user data is loaded
  useEffect(() => {
    if (userData?.telegramBotToken) {
      setTelegramBotToken(userData.telegramBotToken);
    }
  }, [userData]);

  // Set up real-time listeners for shop data
  useEffect(() => {
    if (!user?.uid || !selectedShop) return;

    // Real-time listener for departments
    const departmentsQuery = query(
      collection(db, 'departments'),
      where('userId', '==', user.uid),
      where('shopId', '==', selectedShop.id)
    );

    const unsubscribeDepartments = onSnapshot(departmentsQuery, (snapshot) => {
      const departmentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as Department[];
      
      setDepartments(departmentsData.sort((a, b) => a.order - b.order));
    });

    // Real-time listener for categories
    const categoriesQuery = query(
      collection(db, 'categories'),
      where('userId', '==', user.uid),
      where('shopId', '==', selectedShop.id)
    );

    const unsubscribeCategories = onSnapshot(categoriesQuery, (snapshot) => {
      const categoriesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as Category[];
      
      setCategories(categoriesData.sort((a, b) => a.order - b.order));
    });

    // Real-time listener for products
    const productsQuery = query(
      collection(db, 'products'),
      where('shopId', '==', selectedShop.id)
    );

    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as Product[];
      
      setProducts(productsData);
    });

    return () => {
      unsubscribeDepartments();
      unsubscribeCategories();
      unsubscribeProducts();
    };
  }, [user?.uid, selectedShop]);
  useEffect(() => {
    if (user?.id) {
      loadUserData()
    } else {
      setLoading(false)
    }
  }, [user])

  const loadUserData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      if (!user?.id) {
        setError('No user information available')
        return
      }

      // Get user document from Firebase using Telegram ID
      const userDoc = await getDoc(doc(db, 'users', user.uid));

      if (!userDoc.exists()) {
        setError('User not found in database');
        setLoading(false);
        return;
      }

      const userData = {
        uid: userDoc.id,
        ...userDoc.data(),
        createdAt: userDoc.data().createdAt?.toDate() || new Date(),
        updatedAt: userDoc.data().updatedAt?.toDate() || new Date()
      } as UserData;
      
      setUserData(userData);

      // Find shops owned by this user (if any)
      const shopsRef = collection(db, 'shops');
      const ownerQuery = query(shopsRef, where('ownerId', '==', user.uid));
      const shopsSnapshot = await getDocs(ownerQuery);

      const shopsList: Shop[] = []
      shopsSnapshot.forEach((doc) => {
        const data = doc.data()
        const shop: Shop = {
          id: doc.id,
          ownerId: data.ownerId,
          name: data.name,
          slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-'),
          description: data.description,
          logo: data.logo,
          isActive: data.isActive !== false,
          businessInfo: data.businessInfo || {},
          settings: data.settings || {
            currency: 'USD',
            taxRate: 0,
            businessHours: { open: '09:00', close: '18:00', days: [] },
            orderSettings: { autoConfirm: false, requirePayment: false, allowCancellation: true }
          },
          stats: data.stats || { totalProducts: 0, totalOrders: 0, totalRevenue: 0, totalCustomers: 0 },
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        };
        shopsList.push(shop);
      });

      setOwnedShops(shopsList);
      
    } catch (error) {
      console.error('Error loading user data:', error);
      setError('Failed to load user data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchShopData = async (shopId: string) => {
    await Promise.all([
      fetchShopProducts(shopId),
      fetchShopCategories(shopId),
      fetchShopDepartments(shopId),
      fetchShopStats(shopId)
    ]);
  };

  const fetchShopProducts = async (shopId: string) => {
    try {
      const productsRef = collection(db, 'products');
      const productsQuery = query(
        productsRef, 
        where('shopId', '==', shopId),
        orderBy('createdAt', 'desc')
      );
      const productsSnapshot = await getDocs(productsQuery);
      
      const productsList: Product[] = [];
      productsSnapshot.forEach((doc) => {
        const data = doc.data();
        const product: Product = {
          id: doc.id,
          shopId: data.shopId,
          name: data.name,
          description: data.description,
          price: data.price,
          stock: data.stock || 0,
          category: data.category,
          subcategory: data.subcategory,
          images: data.images || [],
          sku: data.sku,
          isActive: data.isActive !== false,
          lowStockAlert: data.lowStockAlert || 5,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        };
        productsList.push(product);
      });

      setProducts(productsList);
    } catch (error) {
      console.error('Error fetching products:', error);
      setError('Failed to load products. Please try again.');
    }
  };

  const fetchShopCategories = async (shopId: string) => {
    try {
      const categoriesRef = collection(db, 'categories');
      const categoriesQuery = query(
        categoriesRef, 
        where('shopId', '==', shopId),
        orderBy('order', 'asc')
      );
      const categoriesSnapshot = await getDocs(categoriesQuery);
      
      const categoriesList: Category[] = [];
      categoriesSnapshot.forEach((doc) => {
        const data = doc.data();
        const category: Category = {
          id: doc.id,
          userId: data.userId,
          shopId: data.shopId,
          name: data.name,
          description: data.description,
          color: data.color,
          icon: data.icon,
          order: data.order || 0,
          isActive: data.isActive !== false,
          productCount: data.productCount || 0,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        };
        categoriesList.push(category);
      });

      setCategories(categoriesList);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setError('Failed to load categories. Please try again.');
    }
  };

  const fetchShopDepartments = async (shopId: string) => {
    try {
      const departmentsRef = collection(db, 'departments');
      const departmentsQuery = query(
        departmentsRef, 
        where('shopId', '==', shopId),
        orderBy('order', 'asc')
      );
      const departmentsSnapshot = await getDocs(departmentsQuery);
      
      const departmentsList: Department[] = [];
      departmentsSnapshot.forEach((doc) => {
        const data = doc.data();
        const department: Department = {
          id: doc.id,
          userId: data.userId,
          shopId: data.shopId,
          name: data.name,
          telegramChatId: data.telegramChatId,
          adminChatId: data.adminChatId,
          role: data.role,
          order: data.order || 0,
          icon: data.icon,
          isActive: data.isActive !== false,
          notificationTypes: data.notificationTypes || [],
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        };
        departmentsList.push(department);
      });

      setDepartments(departmentsList);
    } catch (error) {
      console.error('Error fetching departments:', error);
      setError('Failed to load departments. Please try again.');
    }
  };

  const fetchShopStats = async (shopId: string) => {
    try {
      // Get product count
      const productsRef = collection(db, 'products');
      const productsQuery = query(productsRef, where('shopId', '==', shopId), where('isActive', '==', true));
      const productsSnapshot = await getDocs(productsQuery);
      const totalProducts = productsSnapshot.size;
      
      // Get order stats
      const ordersRef = collection(db, 'orders');
      const ordersQuery = query(ordersRef, where('shopId', '==', shopId));
      const ordersSnapshot = await getDocs(ordersQuery);
      
      let totalOrders = 0;
      let totalRevenue = 0;
      const customerIds = new Set<string>();
      
      ordersSnapshot.forEach((doc) => {
        const data = doc.data();
        totalOrders++;
        totalRevenue += data.total || 0;
        if (data.customerId) {
          customerIds.add(data.customerId);
        }
      });
      
      const totalCustomers = customerIds.size;

      setStats({
        totalProducts,
        totalOrders,
        totalRevenue,
        totalCustomers
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleShopSelect = async (shop: Shop) => {
    setSelectedShop(shop);
    setActiveTab('products');
    setError(null);
    await fetchShopData(shop.id);
  };

  const testTelegramConnection = async (chatId: string, departmentName: string) => {
    if (!chatId || !telegramBotToken) {
      alert('Please enter a Telegram Chat ID first');
      return;
    }

    try {
      const telegram = new TelegramService(telegramBotToken);
      await telegram.sendMessage({
        chat_id: chatId,
        text: `🧪 Test message from ${departmentName} department!\n\nThis is a test to verify the Telegram connection is working properly.`,
        parse_mode: 'HTML'
      });
      alert(`Test message sent to ${departmentName} chat! Check your Telegram.`);
    } catch (error) {
      console.error('Error testing Telegram connection:', error);
      alert('Failed to send test message. Please check your Chat ID.');
    }
  };
  const handleSaveProduct = async (productData: any) => {
    try {
      setError(null);
      
      if (editingProduct) {
        // Update existing product
        const productRef = doc(db, 'products', editingProduct.id);
        await updateDoc(productRef, {
          ...productData,
          updatedAt: new Date()
        });
      } else {
        // Add new product
        const productsRef = collection(db, 'products');
        await addDoc(productsRef, {
          ...productData,
          shopId: selectedShop?.id,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      setEditingProduct(null);
      setShowAddProduct(false);
    } catch (error) {
      console.error('Error saving product:', error);
      setError('Failed to save product. Please try again.');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
      await deleteDoc(doc(db, 'products', productId));
    } catch (error) {
      console.error('Error deleting product:', error);
      setError('Failed to delete product. Please try again.');
    }
  };

  const handleSaveCategory = async (categoryData: any) => {
    try {
      setError(null);
      
      if (editingCategory) {
        // Update existing category
        const categoryRef = doc(db, 'categories', editingCategory.id);
        await updateDoc(categoryRef, {
          ...categoryData,
          updatedAt: new Date()
        });
      } else {
        // Add new category
        const categoriesRef = collection(db, 'categories');
        await addDoc(categoriesRef, {
          ...categoryData,
          userId: user?.uid,
          shopId: selectedShop?.id,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      setEditingCategory(null);
      setShowAddCategory(false);
    } catch (error) {
      console.error('Error saving category:', error);
      setError('Failed to save category. Please try again.');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    
    try {
      await deleteDoc(doc(db, 'categories', categoryId));
    } catch (error) {
      console.error('Error deleting category:', error);
      setError('Failed to delete category. Please try again.');
    }
  };

  const handleSaveDepartment = async (departmentData: any) => {
    try {
      setError(null);
      
      if (editingDepartment) {
        // Update existing department
        const departmentRef = doc(db, 'departments', editingDepartment.id);
        await updateDoc(departmentRef, {
          ...departmentData,
          updatedAt: new Date()
        });
      } else {
        // Add new department
        const departmentsRef = collection(db, 'departments');
        await addDoc(departmentsRef, {
          ...departmentData,
          userId: user?.uid,
          shopId: selectedShop?.id,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      setEditingDepartment(null);
      setShowAddDepartment(false);
    } catch (error) {
      console.error('Error saving department:', error);
      setError('Failed to save department. Please try again.');
    }
  };

  const handleDeleteDepartment = async (departmentId: string) => {
    if (!confirm('Are you sure you want to delete this department?')) return;
    
    try {
      await deleteDoc(doc(db, 'departments', departmentId));
    } catch (error) {
      console.error('Error deleting department:', error);
      setError('Failed to delete department. Please try again.');
    }
  };

  const saveTelegramBotToken = async () => {
    if (!user?.uid) return;
    
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        telegramBotToken: telegramBotToken,
        updatedAt: new Date()
      });
      alert('Telegram bot token saved successfully!');
      await loadUserData();
    } catch (error) {
      console.error('Error saving bot token:', error);
      alert('Failed to save bot token');
    }
  };
  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-300 rounded w-1/2"></div>
          <div className="h-32 bg-gray-300 rounded"></div>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <User className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">User Not Found</h3>
          <p className="text-gray-500">
            {error || 'Unable to load user data. Please try again.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <div className="text-sm text-gray-500">
          Welcome, {userData.displayName || userData.email}
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* User Profile Section - Show for all users */}
      <div className="bg-white rounded-lg p-4 shadow-sm border">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">
              {userData.displayName || 'User'}
            </h2>
            <p className="text-gray-500">{userData.email}</p>
            <p className="text-sm text-gray-500 capitalize">Role: {userData.role}</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Owned Shops</div>
            <div className="text-2xl font-bold text-blue-600">
              {ownedShops.length}
            </div>
          </div>
        </div>
        
        {/* Telegram Bot Token Configuration */}
        <div className="mt-6 pt-6 border-t">
          <h3 className="text-md font-semibold text-gray-900 mb-4">Telegram Integration</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Telegram Bot Token
              </label>
              <div className="flex space-x-2">
                <input
                  type="password"
                  value={telegramBotToken}
                  onChange={(e) => setTelegramBotToken(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your Telegram bot token"
                />
                <button
                  onClick={saveTelegramBotToken}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Get your bot token from @BotFather on Telegram
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Shops List - Only show if user has shops */}
      {ownedShops.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Your Shops</h2>
          
          {ownedShops.map((shop) => (
            <div key={shop.id} className="bg-white rounded-lg p-4 shadow-sm border">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    {shop.logo && (
                      <img src={shop.logo} alt={shop.name} className="w-12 h-12 rounded-lg object-cover" />
                    )}
                    <div>
                      <h3 className="font-semibold text-gray-900">{shop.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{shop.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center">
                      <Package className="w-3 h-3 mr-1" />
                      {shop.stats?.totalProducts || 0} products
                    </span>
                    <span className="flex items-center">
                      <ShoppingCart className="w-3 h-3 mr-1" />
                      {shop.stats?.totalOrders || 0} orders
                    </span>
                    <span className={`px-2 py-1 rounded-full ${
                      shop.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {shop.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => setEditingShop(shop)}
                    className="p-2 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleShopSelect(shop)}
                    className="p-2 text-green-600 hover:bg-green-100 rounded transition-colors"
                  >
                    <BarChart3 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Shops Message */}
      {ownedShops.length === 0 && (
        <div className="text-center py-8">
          <Store className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Shops Yet</h3>
          <p className="text-gray-500 mb-4">
            You don't own any shops yet. Contact an administrator to get started.
          </p>
          <button
            onClick={() => setActiveTab('profile')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            View Profile
          </button>
        </div>
      )}

      {/* Shop Management - Only show if a shop is selected */}
      {selectedShop && (
        <div className="space-y-6">
          {/* Shop Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setSelectedShop(null)}
                className="p-2 text-gray-500 hover:text-gray-700 rounded transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedShop.name}</h2>
                <p className="text-sm text-gray-500">Shop Management</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            {[
              { id: 'products', label: 'Products', icon: Package },
              { id: 'categories', label: 'Categories', icon: Tag },
              { id: 'departments', label: 'Departments', icon: Users },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md flex-1 justify-center ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Products Tab */}
          {activeTab === 'products' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Products</h3>
                <button
                  onClick={() => setShowAddProduct(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Product</span>
                </button>
              </div>

              <div className="space-y-3">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onEdit={setEditingProduct}
                    onDelete={handleDeleteProduct}
                  />
                ))}
              </div>

              {products.length === 0 && (
                <div className="text-center py-8">
                  <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Products Yet</h3>
                  <p className="text-gray-500 mb-4">Add your first product to get started.</p>
                  <button
                    onClick={() => setShowAddProduct(true)}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add Product
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Categories Tab */}
          {activeTab === 'categories' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Categories</h3>
                <button
                  onClick={() => setShowAddCategory(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Category</span>
                </button>
              </div>

              <div className="space-y-3">
                {categories.map((category) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    onEdit={setEditingCategory}
                    onDelete={handleDeleteCategory}
                  />
                ))}
              </div>

              {categories.length === 0 && (
                <div className="text-center py-8">
                  <Tag className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Categories Yet</h3>
                  <p className="text-gray-500 mb-4">Add categories to organize your products.</p>
                  <button
                    onClick={() => setShowAddCategory(true)}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add Category
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Departments Tab */}
          {activeTab === 'departments' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Departments</h3>
                <button
                  onClick={() => setShowAddDepartment(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Department</span>
                </button>
              </div>

              <div className="space-y-3">
                {departments.map((department) => (
                  <DepartmentCard
                    key={department.id}
                    department={department}
                    onEdit={setEditingDepartment}
                    onDelete={handleDeleteDepartment}
                  />
                ))}
              </div>

              {departments.length === 0 && (
                <div className="text-center py-8">
                  <MessageSquare className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Departments Yet</h3>
                  <p className="text-gray-500 mb-4">Add departments for Telegram notifications.</p>
                  <button
                    onClick={() => setShowAddDepartment(true)}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add Department
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <AnalyticsTab shop={selectedShop} stats={stats} />
          )}
        </div>
      )}

      {/* Profile Tab for all users */}
      {!selectedShop && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">User Profile</h2>
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                <div className="p-3 bg-gray-50 rounded-lg text-gray-900">
                  {userData.displayName || 'Not set'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="p-3 bg-gray-50 rounded-lg text-gray-900">
                  {userData.email}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <div className="p-3 bg-gray-50 rounded-lg text-gray-900 capitalize">
                  {userData.role}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                <div className="p-3 bg-gray-50 rounded-lg text-gray-900 font-mono text-sm">
                  {userData.uid}
                </div>
              </div>
            </div>
            
            {userData.businessInfo && (
              <div className="mt-6">
                <h3 className="text-md font-semibold text-gray-900 mb-3">Business Information</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
                    <div className="p-3 bg-gray-50 rounded-lg text-gray-900">
                      {userData.businessInfo.name || 'Not set'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <div className="p-3 bg-gray-50 rounded-lg text-gray-900">
                      {userData.businessInfo.phone || 'Not set'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Edit Modal */}
      {(editingProduct || showAddProduct) && selectedShop && (
        <ProductEditModal
          product={editingProduct}
          shopId={selectedShop.id}
          categories={categories}
          onSave={handleSaveProduct}
          onCancel={() => {
            setEditingProduct(null);
            setShowAddProduct(false);
          }}
        />
      )}

      {/* Category Edit Modal */}
      {(editingCategory || showAddCategory) && user && selectedShop && (
        <CategoryEditModal
          category={editingCategory}
          userId={user.uid}
          shopId={selectedShop.id}
          onSave={handleSaveCategory}
          onCancel={() => {
            setEditingCategory(null);
            setShowAddCategory(false);
          }}
        />
      )}

      {/* Department Edit Modal */}
      {(editingDepartment || showAddDepartment) && user && selectedShop && (
        <DepartmentEditModal
          department={editingDepartment}
          userId={user.uid}
          shopId={selectedShop.id}
          telegramBotToken={telegramBotToken}
          onTestConnection={testTelegramConnection}
          onSave={handleSaveDepartment}
          onCancel={() => {
            setEditingDepartment(null);
            setShowAddDepartment(false);
          }}
        />
      )}

      {/* Shop Edit Modal */}
      {editingShop && (
        <ShopEditModal
          shop={editingShop}
          onSave={async (updatedShop) => {
            try {
              const shopRef = doc(db, 'shops', updatedShop.id);
              await updateDoc(shopRef, {
                ...updatedShop,
                updatedAt: new Date()
              });
              setEditingShop(null);
              await loadUserData();
            } catch (error) {
              console.error('Error updating shop:', error);
              setError('Failed to update shop. Please try again.');
            }
          }}
          onCancel={() => setEditingShop(null)}
        />
      )}
    </div>
  );
};

// Product Card Component
const ProductCard: React.FC<{ product: Product; onEdit: (product: Product) => void; onDelete: (id: string) => void }> = ({ product, onEdit, onDelete }) => (
  <div className="bg-white rounded-lg p-4 shadow-sm border">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        {product.images?.[0] ? (
          <img src={product.images[0]} alt={product.name} className="w-12 h-12 rounded-lg object-cover" />
        ) : (
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
            <Package className="w-6 h-6 text-gray-400" />
          </div>
        )}
        <div>
          <h3 className="font-semibold text-gray-900">{product.name}</h3>
          <p className="text-sm text-gray-500">${product.price.toFixed(2)} • Stock: {product.stock}</p>
        </div>
      </div>
      <div className="flex space-x-2">
        <button onClick={() => onEdit(product)} className="p-2 text-blue-600 hover:bg-blue-100 rounded">
          <Edit className="w-4 h-4" />
        </button>
        <button onClick={() => onDelete(product.id)} className="p-2 text-red-600 hover:bg-red-100 rounded">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
);

// Category Card Component
const CategoryCard: React.FC<{ category: Category; onEdit: (category: Category) => void; onDelete: (id: string) => void }> = ({ category, onEdit, onDelete }) => (
  <div className="bg-white rounded-lg p-4 shadow-sm border">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div 
          className="w-12 h-12 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: category.color + '20' }}
// Department Card Component
const DepartmentCard: React.FC<{ 
  department: Department; 
  onEdit: (department: Department) => void; 
  onDelete: (id: string) => void;
  onTest: (chatId: string, name: string) => void;
}> = ({ department, onEdit, onDelete, onTest }) => (
  <div className="bg-white rounded-lg p-4 shadow-sm border">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center space-x-3">
        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
          <span className="text-2xl">{department.icon || '🏢'}</span>
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">{department.name}</h3>
          <p className="text-sm text-gray-500 capitalize">{department.role}</p>
        </div>
      </div>
      <div className="flex space-x-2">
        <button onClick={() => onEdit(department)} className="p-1 text-blue-600 hover:text-blue-700">
          <Edit className="w-4 h-4" />
        </button>
        <button onClick={() => onDelete(department.id)} className="p-1 text-red-600 hover:text-red-700">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
        >
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Telegram Chat ID
        </label>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={department.telegramChatId}
            readOnly
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded bg-gray-50 text-gray-600"
          />
          <button
            onClick={() => onTest(department.telegramChatId, department.name)}
            className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors flex items-center space-x-1"
          >
            <TestTube className="w-3 h-3" />
            <span>Test</span>
          </button>
        </div>
      </div>
          <span className="text-2xl">{category.icon || '📦'}</span>
      {department.adminChatId && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Admin Chat ID
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={department.adminChatId}
              readOnly
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded bg-gray-50 text-gray-600"
            />
            <button
              onClick={() => onTest(department.adminChatId!, 'Admin')}
              className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors flex items-center space-x-1"
            >
              <TestTube className="w-3 h-3" />
              <span>Test</span>
            </button>
          </div>
        </div>
      )}
        </div>
      <div className="pt-2 border-t">
        <p className="text-xs text-gray-500">
          Created: {department.createdAt?.toLocaleDateString()}
        </p>
      </div>
    </div>
  </div>
);
        <div>
// Simple Product Edit Modal
const ProductEditModal: React.FC<{
  product: Product | null;
  shopId: string;
  categories: Category[];
  onSave: (data: any) => void;
  onCancel: () => void;
}> = ({ product, shopId, categories, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price?.toString() || '',
    stock: product?.stock?.toString() || '',
    category: product?.category || '',
    isActive: product?.isActive ?? true
  });
          <h3 className="font-semibold text-gray-900">{category.name}</h3>
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      price: parseFloat(formData.price),
      stock: parseInt(formData.stock),
      shopId
    });
  };
          <p className="text-sm text-gray-500">{category.description}</p>
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{product ? 'Edit Product' : 'Add Product'}</h2>
          <button onClick={onCancel}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Product Name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg"
            required
          />
          <textarea
            placeholder="Description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg"
            rows={3}
          />
          <div className="grid grid-cols-2 gap-4">
            <input
              type="number"
              step="0.01"
              placeholder="Price"
              value={formData.price}
              onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
              className="px-3 py-2 border rounded-lg"
              required
            />
            <input
              type="number"
              placeholder="Stock"
              value={formData.stock}
              onChange={(e) => setFormData(prev => ({ ...prev, stock: e.target.value }))}
              className="px-3 py-2 border rounded-lg"
              required
            />
          </div>
          <select
            value={formData.category}
            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg"
            required
          >
            <option value="">Select Category</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
            />
            <label className="text-sm">Product is active</label>
          </div>
          <div className="flex space-x-3">
            <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};
        </div>
// Simple Category Edit Modal
const CategoryEditModal: React.FC<{
  category: Category | null;
  userId: string;
  shopId: string;
  onSave: (data: any) => void;
  onCancel: () => void;
}> = ({ category, userId, shopId, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    description: category?.description || '',
    color: category?.color || '#3B82F6',
    icon: category?.icon || '📦',
    order: category?.order || 0
  });
      </div>
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      userId,
      shopId,
      isActive: true
    });
  };
      <div className="flex space-x-2">
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{category ? 'Edit Category' : 'Add Category'}</h2>
          <button onClick={onCancel}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Category Name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg"
            required
          />
          <textarea
            placeholder="Description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg"
            rows={2}
          />
          <div className="grid grid-cols-2 gap-4">
            <input
              type="color"
              value={formData.color}
              onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
              className="w-full h-10 border rounded-lg"
            />
            <input
              type="text"
              placeholder="Icon (emoji)"
              value={formData.icon}
              onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
              className="px-3 py-2 border rounded-lg"
              maxLength={2}
            />
          </div>
          <input
            type="number"
            placeholder="Display Order"
            value={formData.order}
            onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
            className="w-full px-3 py-2 border rounded-lg"
          />
          <div className="flex space-x-3">
            <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};
        <button onClick={() => onEdit(category)} className="p-2 text-blue-600 hover:bg-blue-100 rounded">
// Department Edit Modal
const DepartmentEditModal: React.FC<{
  department: Department | null;
  userId: string;
  shopId: string;
  telegramBotToken: string;
  onTestConnection: (chatId: string, name: string) => void;
  onSave: (data: any) => void;
  onCancel: () => void;
}> = ({ department, userId, shopId, telegramBotToken, onTestConnection, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: department?.name || '',
    telegramChatId: department?.telegramChatId || '',
    adminChatId: department?.adminChatId || '',
    role: department?.role || 'cashier' as 'kitchen' | 'cashier' | 'admin' | 'shop' | 'delivery' | 'sales',
    order: department?.order || 0,
    icon: department?.icon || '🏢'
  });
          <Edit className="w-4 h-4" />
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'cashier': return '💰';
      case 'delivery': return '🚚';
      case 'admin': return '👨‍💼';
      case 'sales': return '🛍️';
      case 'shop': return '🏪';
      default: return '🏢';
    }
  };
        </button>
  const getRoleName = (role: string) => {
    switch (role) {
      case 'cashier': return 'Cashier';
      case 'delivery': return 'Delivery';
      case 'admin': return 'Admin';
      case 'sales': return 'Sales';
      case 'shop': return 'Shop Channel';
      default: return 'Department';
    }
  };
        <button onClick={() => onDelete(category.id)} className="p-2 text-red-600 hover:bg-red-100 rounded">
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.telegramChatId.trim()) {
      alert('Please fill in all required fields');
      return;
    }
    
    onSave({
      ...formData,
      userId,
      shopId,
      isActive: true
    });
  };
          <Trash2 className="w-4 h-4" />
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{department ? 'Edit Department' : 'Add Department'}</h2>
          <button onClick={onCancel}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Department Name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg"
            required
          />
          <select
            value={formData.role}
            onChange={(e) => {
              const newRole = e.target.value as any;
              setFormData(prev => ({
                ...prev,
                role: newRole,
                name: getRoleName(newRole),
                icon: getRoleIcon(newRole)
              }));
            }}
            className="w-full px-3 py-2 border rounded-lg"
            required
          >
            <option value="cashier">Cashier</option>
            <option value="delivery">Delivery</option>
            <option value="admin">Admin</option>
            <option value="sales">Sales</option>
            <option value="shop">Shop Channel</option>
          </select>
          <div>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Telegram Chat ID"
                value={formData.telegramChatId}
                onChange={(e) => setFormData(prev => ({ ...prev, telegramChatId: e.target.value }))}
                className="flex-1 px-3 py-2 border rounded-lg"
                required
              />
              <button
                type="button"
                onClick={() => onTestConnection(formData.telegramChatId, formData.name)}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Test
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Get Chat ID from @userinfobot in your Telegram group
            </p>
          </div>
          {formData.role === 'cashier' && (
            <div>
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Admin Chat ID"
                  value={formData.adminChatId}
                  onChange={(e) => setFormData(prev => ({ ...prev, adminChatId: e.target.value }))}
                  className="flex-1 px-3 py-2 border rounded-lg"
                  required
                />
                <button
                  type="button"
                  onClick={() => onTestConnection(formData.adminChatId, 'Admin')}
                  className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                >
                  Test
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Admin chat for reports and administrative notifications
              </p>
            </div>
          )}
          <input
            type="text"
            placeholder="Icon (emoji)"
            value={formData.icon}
            onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg"
            maxLength={2}
          />
          <input
            type="number"
            placeholder="Display Order"
            value={formData.order}
            onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
            className="w-full px-3 py-2 border rounded-lg"
          />
          <div className="flex space-x-3">
            <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};
        </button>
// Simple Shop Edit Modal
const ShopEditModal: React.FC<{
  shop: Shop;
  onSave: (shop: Shop) => void;
  onCancel: () => void;
}> = ({ shop, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: shop.name,
    description: shop.description,
    isActive: shop.isActive
  });
      </div>
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...shop, ...formData });
  };
    </div>
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Edit Shop</h2>
          <button onClick={onCancel}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Shop Name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg"
            required
          />
          <textarea
            placeholder="Description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg"
            rows={3}
          />
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
            />
            <label className="text-sm">Shop is active</label>
          </div>
          <div className="flex space-x-3">
            <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};
  </div>
// Simple Analytics Tab
const AnalyticsTab: React.FC<{ shop: Shop; stats: any }> = ({ shop, stats }) => (
  <div className="space-y-4">
    <h3 className="text-lg font-semibold text-gray-900">Analytics for {shop.name}</h3>
    {stats && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border text-center">
          <Package className="w-8 h-8 mx-auto text-blue-600 mb-2" />
          <div className="text-2xl font-bold text-gray-900">{stats.totalProducts}</div>
          <div className="text-sm text-gray-500">Products</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border text-center">
          <ShoppingCart className="w-8 h-8 mx-auto text-green-600 mb-2" />
          <div className="text-2xl font-bold text-gray-900">{stats.totalOrders}</div>
          <div className="text-sm text-gray-500">Orders</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border text-center">
          <DollarSign className="w-8 h-8 mx-auto text-yellow-600 mb-2" />
          <div className="text-2xl font-bold text-gray-900">${stats.totalRevenue.toFixed(2)}</div>
          <div className="text-sm text-gray-500">Revenue</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border text-center">
          <Users className="w-8 h-8 mx-auto text-purple-600 mb-2" />
          <div className="text-2xl font-bold text-gray-900">{stats.totalCustomers}</div>
          <div className="text-sm text-gray-500">Customers</div>
        </div>
      </div>
    )}
  </div>
);
);
export default AdminPanel;