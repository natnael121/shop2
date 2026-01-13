import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { useShops } from './hooks/useShops';
import { useProducts } from './hooks/useProducts';
import { useOrders } from './hooks/useOrders';
import AuthForm from './components/Auth/AuthForm';
import CatalogPage from './pages/CatalogPage';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import DashboardStats from './components/Dashboard/DashboardStats';
import RecentOrders from './components/Dashboard/RecentOrders';
import ShopList from './components/Shops/ShopList';
import ProductList from './components/Products/ProductList';
import { OrderManagement } from './components/Orders/OrderManagement';
import DepartmentManagement from './components/Departments/DepartmentManagement';
import CategoryManagement from './components/Categories/CategoryManagement';
import SettingsPanel from './components/Settings/SettingsPanel';
import CustomerManagement from './components/Customers/CustomerManagement';
import BannerManagement from './components/Banners/BannerManagement';
import { PrintCatalog } from './components/PrintCatalog'; // Import the PrintCatalog component
import { Shop } from './types';

function App() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/shop/:shopName" element={<CatalogPage />} />
        <Route path="/*" element={user ? <DashboardApp /> : <AuthForm />} />
      </Routes>
    </Router>
  );
}

function DashboardApp() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [selectedShop, setSelectedShop] = useState<Shop | undefined>();
  const [showPrintCatalog, setShowPrintCatalog] = useState(false); // State for showing print catalog

  const { shops, loading: shopsLoading, createShop } = useShops(user?.uid);
  const { products, loading: productsLoading, createProduct, updateProduct, deleteProduct } = useProducts(selectedShop?.id);
  const { orders, loading: ordersLoading, updateOrderStatus } = useOrders(selectedShop?.id);

  // Auto-select first shop if none selected
  useEffect(() => {
    if (shops.length > 0 && !selectedShop) {
      setSelectedShop(shops[0]);
    }
  }, [shops, selectedShop]);

  // Calculate dashboard stats
  const stats = {
    totalShops: shops.length,
    totalProducts: products.length,
    totalOrders: orders.length,
    totalCustomers: new Set(orders.map(o => o.customerId)).size,
    revenue: orders.reduce((sum, order) => sum + order.total, 0),
    lowStockItems: products.filter(p => p.stock <= p.lowStockAlert).length,
  };

  const handleCreateProduct = async (productData: any) => {
    if (!selectedShop) throw new Error('No shop selected');
    return await createProduct({
      ...productData,
      shopId: selectedShop.id
    });
  };

  const handleSectionChange = (section: string) => {
    if (section === 'print') {
      // Only show print catalog if a shop is selected
      if (selectedShop) {
        setShowPrintCatalog(true);
      } else {
        alert('Please select a shop first to print catalog');
        setActiveSection('shops');
      }
    } else {
      setActiveSection(section);
    }
  };

  const handleClosePrintCatalog = () => {
    setShowPrintCatalog(false);
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <DashboardStats stats={stats} />
            <RecentOrders orders={orders} onUpdateStatus={updateOrderStatus} />
          </div>
        );
        
      case 'shops':
        return (
          <ShopList 
            shops={shops} 
            onCreateShop={createShop}
            onSelectShop={setSelectedShop}
            selectedShop={selectedShop}
          />
        );
        
      case 'products':
        if (!selectedShop) {
          return (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Shop Selected</h3>
              <p className="text-gray-500">Please select a shop to manage products.</p>
            </div>
          );
        }
        return (
          <ProductList
            products={products}
            onCreateProduct={handleCreateProduct}
            onUpdateProduct={updateProduct}
            onDeleteProduct={deleteProduct}
            loading={productsLoading}
            selectedShopId={selectedShop?.id}
          />
        );
        
      case 'orders':
        if (!selectedShop) {
          return (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Shop Selected</h3>
              <p className="text-gray-500">Please select a shop to view orders.</p>
            </div>
          );
        }
        return (
          <OrderManagement selectedShopId={selectedShop.id} />
        );
        
      case 'customers':
        return (
          <CustomerManagement selectedShopId={selectedShop?.id} />
        );
        
      case 'telegram':
        return (
          <DepartmentManagement selectedShopId={selectedShop?.id} />
        );
        
      case 'categories':
        return (
          <CategoryManagement selectedShopId={selectedShop?.id} />
        );

      case 'banners':
        if (!selectedShop) {
          return (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Shop Selected</h3>
              <p className="text-gray-500">Please select a shop to manage banners.</p>
            </div>
          );
        }
        return (
          <BannerManagement selectedShopId={selectedShop.id} />
        );

      case 'analytics':
        return (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Analytics</h2>
            <p className="text-gray-500">Advanced analytics coming soon...</p>
          </div>
        );
        
      case 'settings':
        return (
          <SettingsPanel selectedShop={selectedShop} />
        );
        
      default:
        return null;
    }
  };

  // Create businessInfo from user and shop data
  const businessInfo = {
    uid: user?.uid || '',
    email: user?.email || '',
    businessName: selectedShop?.name || '',
    phone: selectedShop?.phone || '',
    address: selectedShop?.address || '',
    city: selectedShop?.city || '',
    state: selectedShop?.state || '',
    zipCode: selectedShop?.zipCode || '',
    country: selectedShop?.country || '',
    website: selectedShop?.website || '',
    logoUrl: selectedShop?.logoUrl || '',
    telegramBotToken: user?.telegramBotToken || '',
    // Add any other fields from User type that might be needed
  };

  return (
    <>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar 
          activeSection={activeSection} 
          onSectionChange={handleSectionChange} 
        />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          
          <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
            {selectedShop && (
              <div className="mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-700">
                    <strong>Active Shop:</strong> {selectedShop.name} ({selectedShop.slug})
                    {activeSection === 'print' && (
                      <button
                        onClick={() => setShowPrintCatalog(true)}
                        className="ml-4 bg-blue-600 text-white px-3 py-1 rounded-lg text-xs hover:bg-blue-700 transition-colors"
                      >
                        Generate Print Catalog
                      </button>
                    )}
                  </p>
                </div>
              </div>
            )}
            
            {renderContent()}

            {/* Show print catalog button on products page */}
            {activeSection === 'products' && selectedShop && products.length > 0 && (
              <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Print Product Catalog</h3>
                    <p className="text-sm text-gray-600">
                      Generate a professional PDF catalog with all your products
                    </p>
                  </div>
                  <button
                    onClick={() => handleSectionChange('print')}
                    className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 transition-colors flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    <span>Print Catalog</span>
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Print Catalog Modal */}
      {showPrintCatalog && selectedShop && user && (
        <PrintCatalog
          userId={user.uid}
          businessInfo={businessInfo}
          products={products}
          categories={[]} // You might need to fetch categories separately
          onClose={handleClosePrintCatalog}
        />
      )}
    </>
  );
}

export default App;