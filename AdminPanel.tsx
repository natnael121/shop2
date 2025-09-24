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
      const usersRef = collection(db, 'users')
      const userQuery = query(usersRef, where('telegramId', '==', parseInt(user.id)))
      const userSnapshot = await getDocs(userQuery)

      if (userSnapshot.empty) {
        setError('User not found in database')
        setLoading(false)
        return
      }

      const userDoc = userSnapshot.docs[0]
      const userData = userDoc.data() as UserData
      setUserData(userData)

      // Find shops owned by this user (if any)
      const shopsRef = collection(db, 'shops')
      const ownerQuery = query(shopsRef, where('ownerId', '==', userDoc.id))
      const shopsSnapshot = await getDocs(ownerQuery)

      const shopsList: Shop[] = []
      shopsSnapshot.forEach((doc) => {
        const data = doc.data()
        const shop: Shop = {
          id: doc.id,
          ownerId: data.ownerId,
          name: data.name,
          slug: data.slug,
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
        }
        shopsList.push(shop)
      })

      setOwnedShops(shopsList)
      
    } catch (error) {
      console.error('Error loading user data:', error)
      setError('Failed to load user data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const fetchShopData = async (shopId: string) => {
    await Promise.all([
      fetchShopProducts(shopId),
      fetchShopCategories(shopId),
      fetchShopDepartments(shopId),
      fetchShopStats(shopId)
    ])
  }

  const fetchShopProducts = async (shopId: string) => {
    try {
      const productsRef = collection(db, 'products')
      const productsQuery = query(
        productsRef, 
        where('shopId', '==', shopId),
        orderBy('createdAt', 'desc')
      )
      const productsSnapshot = await getDocs(productsQuery)
      
      const productsList: Product[] = []
      productsSnapshot.forEach((doc) => {
        const data = doc.data()
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
          tags: data.tags || [],
          featured: data.featured || false,
          costPrice: data.costPrice,
          weight: data.weight,
          dimensions: data.dimensions,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        }
        productsList.push(product)
      })

      setProducts(productsList)
    } catch (error) {
      console.error('Error fetching products:', error)
      setError('Failed to load products. Please try again.')
    }
  }

  const fetchShopCategories = async (shopId: string) => {
    try {
      setLoading(true)
      const categoriesRef = collection(db, 'categories')
      const categoriesQuery = query(
        categoriesRef, 
        where('shopId', '==', shopId),
        where('isActive', '==', true),
        orderBy('order', 'asc')
      )
      const categoriesSnapshot = await getDocs(categoriesQuery)
      
      const categoriesList: Category[] = []
      categoriesSnapshot.forEach((doc) => {
        const data = doc.data()
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
        }
        categoriesList.push(category)
      })

      setCategories(categoriesList)
    } catch (error) {
      console.error('Error fetching categories:', error)
      setError('Failed to load categories. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const fetchShopDepartments = async (shopId: string) => {
    try {
      const departmentsRef = collection(db, 'departments')
      const departmentsQuery = query(
        departmentsRef, 
        where('shopId', '==', shopId),
        orderBy('order', 'asc')
      )
      const departmentsSnapshot = await getDocs(departmentsQuery)
      
      const departmentsList: Department[] = []
      departmentsSnapshot.forEach((doc) => {
        const data = doc.data()
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
        }
        departmentsList.push(department)
      })

      setDepartments(departmentsList)
    } catch (error) {
      console.error('Error fetching departments:', error)
      setError('Failed to load departments. Please try again.')
    }
  }

  const fetchShopStats = async (shopId: string) => {
    try {
      // Get product count
      const productsRef = collection(db, 'products')
      const productsQuery = query(productsRef, where('shopId', '==', shopId), where('isActive', '==', true))
      const productsSnapshot = await getDocs(productsQuery)
      const totalProducts = productsSnapshot.size
      
      // Get order stats
      const ordersRef = collection(db, 'orders')
      const ordersQuery = query(ordersRef, where('shopId', '==', shopId))
      const ordersSnapshot = await getDocs(ordersQuery)
      
      let totalOrders = 0
      let totalRevenue = 0
      const customerIds = new Set<string>()
      
      ordersSnapshot.forEach((doc) => {
        const data = doc.data()
        totalOrders++
        totalRevenue += data.total || 0
        if (data.customerId) {
          customerIds.add(data.customerId)
        }
      })
      
      const totalCustomers = customerIds.size

      setStats({
        totalProducts,
        totalOrders,
        totalRevenue,
        totalCustomers
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const handleShopSelect = async (shop: Shop) => {
    setSelectedShop(shop)
    setActiveTab('products')
    setError(null)
    await fetchShopData(shop.id)
  }

  const handleSaveProduct = async (productData: any) => {
    try {
      setError(null)
      
      if (editingProduct) {
        // Update existing product
        const productRef = doc(db, 'products', editingProduct.id)
        await updateDoc(productRef, {
          ...productData,
          updatedAt: new Date()
        })
      } else {
        // Add new product
        const productsRef = collection(db, 'products')
        await addDoc(productsRef, {
          ...productData,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      }
      
      setEditingProduct(null)
      setShowAddProduct(false)
      if (selectedShop) {
        await fetchShopProducts(selectedShop.id)
      }
    } catch (error) {
      console.error('Error saving product:', error)
      setError('Failed to save product. Please try again.')
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    try {
      setError(null)
      const productRef = doc(db, 'products', productId)
      await deleteDoc(productRef)
      
      if (selectedShop) {
        await fetchShopProducts(selectedShop.id)
      }
    } catch (error) {
      console.error('Error deleting product:', error)
      setError('Failed to delete product. Please try again.')
    }
  }

  const handleSaveCategory = async (categoryData: any) => {
    try {
      setError(null)
      
      if (editingCategory) {
        // Update existing category
        const categoryRef = doc(db, 'categories', editingCategory.id)
        await updateDoc(categoryRef, {
          ...categoryData,
          updatedAt: new Date()
        })
      } else {
        // Add new category
        const categoriesRef = collection(db, 'categories')
        await addDoc(categoriesRef, {
          ...categoryData,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      }
      
      setEditingCategory(null)
      setShowAddCategory(false)
      if (selectedShop) {
        await fetchShopCategories(selectedShop.id)
      }
    } catch (error) {
      console.error('Error saving category:', error)
      setError('Failed to save category. Please try again.')
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      setError(null)
      const categoryRef = doc(db, 'categories', categoryId)
      await deleteDoc(categoryRef)
      
      if (selectedShop) {
        await fetchShopCategories(selectedShop.id)
      }
    } catch (error) {
      console.error('Error deleting category:', error)
      setError('Failed to delete category. Please try again.')
    }
  }

  const handleSaveDepartment = async (departmentData: any) => {
    try {
      setError(null)
      
      if (editingDepartment) {
        // Update existing department
        const departmentRef = doc(db, 'departments', editingDepartment.id)
        await updateDoc(departmentRef, {
          ...departmentData,
          updatedAt: new Date()
        })
      } else {
        // Add new department
        const departmentsRef = collection(db, 'departments')
        await addDoc(departmentsRef, {
          ...departmentData,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      }
      
      setEditingDepartment(null)
      setShowAddDepartment(false)
      if (selectedShop) {
        await fetchShopDepartments(selectedShop.id)
      }
    } catch (error) {
      console.error('Error saving department:', error)
      setError('Failed to save department. Please try again.')
    }
  }

  const handleDeleteDepartment = async (departmentId: string) => {
    try {
      setError(null)
      const departmentRef = doc(db, 'departments', departmentId)
      await deleteDoc(departmentRef)
      
      if (selectedShop) {
        await fetchShopDepartments(selectedShop.id)
      }
    } catch (error) {
      console.error('Error deleting department:', error)
      setError('Failed to delete department. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-300 rounded w-1/2"></div>
          <div className="h-32 bg-gray-300 rounded"></div>
        </div>
      </div>
    )
  }

  if (!userData) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <User className="w-16 h-16 mx-auto text-telegram-hint mb-4" />
          <h3 className="text-lg font-medium text-telegram-text mb-2">User Not Found</h3>
          <p className="text-telegram-hint">
            {error || 'Unable to load user data. Please try again.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-telegram-text">Admin Panel</h1>
        <div className="text-sm text-telegram-hint">
          Welcome, {userData.displayName || userData.email}
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* User Profile Section - Show for all users */}
      <div className="bg-telegram-secondary-bg rounded-lg p-4">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-telegram-button rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-telegram-text">
              {userData.displayName || 'User'}
            </h2>
            <p className="text-telegram-hint">{userData.email}</p>
            <p className="text-sm text-telegram-hint capitalize">Role: {userData.role}</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-telegram-hint">Owned Shops</div>
            <div className="text-2xl font-bold text-telegram-button">
              {ownedShops.length}
            </div>
          </div>
        </div>
      </div>

      {/* Shops List - Only show if user has shops */}
      {ownedShops.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-telegram-text">Your Shops</h2>
          
          {ownedShops.map((shop) => (
            <div key={shop.id} className="bg-telegram-secondary-bg rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    {shop.logo && (
                      <img src={shop.logo} alt={shop.name} className="w-12 h-12 rounded-lg object-cover" />
                    )}
                    <div>
                      <h3 className="font-semibold text-telegram-text">{shop.name}</h3>
                      <p className="text-sm text-telegram-hint mt-1">{shop.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 mt-2 text-xs text-telegram-hint">
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
                    className="p-2 text-telegram-button hover:bg-telegram-button hover:text-telegram-button-text rounded"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleShopSelect(shop)}
                    className="p-2 text-telegram-button hover:bg-telegram-button hover:text-telegram-button-text rounded"
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
          <Store className="w-16 h-16 mx-auto text-telegram-hint mb-4" />
          <h3 className="text-lg font-medium text-telegram-text mb-2">No Shops Yet</h3>
          <p className="text-telegram-hint mb-4">
            You don't own any shops yet. Contact an administrator to get started.
          </p>
          <button
            onClick={() => setActiveTab('profile')}
            className="bg-telegram-button text-telegram-button-text px-6 py-2 rounded-lg"
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
                className="p-2 text-telegram-hint hover:text-telegram-text rounded"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-xl font-bold text-telegram-text">{selectedShop.name}</h2>
                <p className="text-sm text-telegram-hint">Shop Management</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 bg-telegram-secondary-bg rounded-lg p-1">
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
                    ? 'bg-telegram-button text-telegram-button-text'
                    : 'text-telegram-hint hover:text-telegram-text'
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
                <h3 className="text-lg font-semibold text-telegram-text">Products</h3>
                <button
                  onClick={() => setShowAddProduct(true)}
                  className="bg-telegram-button text-telegram-button-text px-4 py-2 rounded-lg flex items-center space-x-2"
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
                  <Package className="w-16 h-16 mx-auto text-telegram-hint mb-4" />
                  <h3 className="text-lg font-medium text-telegram-text mb-2">No Products Yet</h3>
                  <p className="text-telegram-hint mb-4">Add your first product to get started.</p>
                  <button
                    onClick={() => setShowAddProduct(true)}
                    className="bg-telegram-button text-telegram-button-text px-6 py-2 rounded-lg"
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
                <h3 className="text-lg font-semibold text-telegram-text">Categories</h3>
                <button
                  onClick={() => setShowAddCategory(true)}
                  className="bg-telegram-button text-telegram-button-text px-4 py-2 rounded-lg flex items-center space-x-2"
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
                  <Tag className="w-16 h-16 mx-auto text-telegram-hint mb-4" />
                  <h3 className="text-lg font-medium text-telegram-text mb-2">No Categories Yet</h3>
                  <p className="text-telegram-hint mb-4">Add categories to organize your products.</p>
                  <button
                    onClick={() => setShowAddCategory(true)}
                    className="bg-telegram-button text-telegram-button-text px-6 py-2 rounded-lg"
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
                <h3 className="text-lg font-semibold text-telegram-text">Departments</h3>
                <button
                  onClick={() => setShowAddDepartment(true)}
                  className="bg-telegram-button text-telegram-button-text px-4 py-2 rounded-lg flex items-center space-x-2"
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
                  <Users className="w-16 h-16 mx-auto text-telegram-hint mb-4" />
                  <h3 className="text-lg font-medium text-telegram-text mb-2">No Departments Yet</h3>
                  <p className="text-telegram-hint mb-4">Add departments for Telegram notifications.</p>
                  <button
                    onClick={() => setShowAddDepartment(true)}
                    className="bg-telegram-button text-telegram-button-text px-6 py-2 rounded-lg"
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
          <h2 className="text-lg font-semibold text-telegram-text">User Profile</h2>
          <div className="bg-telegram-secondary-bg rounded-lg p-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-telegram-text mb-1">Display Name</label>
                <div className="p-3 bg-telegram-bg rounded-lg text-telegram-text">
                  {userData.displayName || 'Not set'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-telegram-text mb-1">Email</label>
                <div className="p-3 bg-telegram-bg rounded-lg text-telegram-text">
                  {userData.email}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-telegram-text mb-1">Role</label>
                <div className="p-3 bg-telegram-bg rounded-lg text-telegram-text capitalize">
                  {userData.role}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-telegram-text mb-1">User ID</label>
                <div className="p-3 bg-telegram-bg rounded-lg text-telegram-text font-mono text-sm">
                  {userData.uid}
                </div>
              </div>
            </div>
            
            {userData.businessInfo && (
              <div className="mt-6">
                <h3 className="text-md font-semibold text-telegram-text mb-3">Business Information</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-telegram-text mb-1">Business Name</label>
                    <div className="p-3 bg-telegram-bg rounded-lg text-telegram-text">
                      {userData.businessInfo.name || 'Not set'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-telegram-text mb-1">Phone</label>
                    <div className="p-3 bg-telegram-bg rounded-lg text-telegram-text">
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
      {(editingProduct || showAddProduct) && (
        <ProductEditModal
          product={editingProduct || undefined}
          shopId={selectedShop?.id || ''}
          categories={categories}
          onSave={handleSaveProduct}
          onCancel={() => {
            setEditingProduct(null)
            setShowAddProduct(false)
          }}
        />
      )}

      {/* Category Edit Modal */}
      {(editingCategory || showAddCategory) && userData && selectedShop && (
        <CategoryEditModal
          category={editingCategory || undefined}
          userId={userData.uid}
          shopId={selectedShop.id}
          onSave={handleSaveCategory}
          onCancel={() => {
            setEditingCategory(null)
            setShowAddCategory(false)
          }}
        />
      )}

      {/* Department Edit Modal */}
      {(editingDepartment || showAddDepartment) && userData && selectedShop && (
        <DepartmentEditModal
          department={editingDepartment || undefined}
          userId={userData.uid}
          shopId={selectedShop.id}
          onSave={handleSaveDepartment}
          onCancel={() => {
            setEditingDepartment(null)
            setShowAddDepartment(false)
          }}
        />
      )}

      {/* Shop Edit Modal */}
      {editingShop && (
        <ShopEditModal
          shop={editingShop}
          onSave={async (updatedShop) => {
            try {
              const shopRef = doc(db, 'shops', updatedShop.id)
              await updateDoc(shopRef, {
                ...updatedShop,
                updatedAt: new Date()
              })
              setEditingShop(null)
              await loadUserData()
            } catch (error) {
              console.error('Error updating shop:', error)
              setError('Failed to update shop. Please try again.')
            }
          }}
          onCancel={() => setEditingShop(null)}
        />
      )}
    </div>
  )
}

// Import required components
import ProductCard from './admin/ProductCard'
import ProductEditModal from './admin/ProductEditModal'
import CategoryCard from './admin/CategoryCard'
import CategoryEditModal from './admin/CategoryEditModal'
import DepartmentCard from './admin/DepartmentCard'
import DepartmentEditModal from './admin/DepartmentEditModal'
import ShopCard from './admin/ShopCard'
import ShopEditModal from './admin/ShopEditModal'
import AnalyticsTab from './admin/AnalyticsTab'
import { ArrowLeft } from 'lucide-react'

export default AdminPanel