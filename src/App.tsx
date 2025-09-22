import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
import { Shop } from './types';

function App() {
  const { user, loading: authLoading } = useAuth();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [selectedShop, setSelectedShop] = useState<Shop | undefined>();

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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/shop/:shopName" element={<CatalogPage />} />
        <Route path="/*" element={<DashboardApp />} />
      </Routes>
    </Router>
  );
}

function DashboardApp() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [selectedShop, setSelectedShop] = useState<Shop | undefined>();

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
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Customers</h2>
            <p className="text-gray-500">Customer management coming soon...</p>
          </div>
        );
        
      case 'telegram':
        return (
          <DepartmentManagement selectedShopId={selectedShop?.id} />
        );
        
      case 'categories':
        return (
          <CategoryManagement selectedShopId={selectedShop?.id} />
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

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar 
        activeSection={activeSection} 
        onSectionChange={setActiveSection} 
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {selectedShop && (
            <div className="mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-700">
                  <strong>Active Shop:</strong> {selectedShop.name} ({selectedShop.slug})
                </p>
              </div>
            </div>
          )}
          
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default App;