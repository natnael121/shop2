import React, { useState } from 'react';
import { Package, Plus, CreditCard as Edit, Trash2, Search, Filter, Image as ImageIcon, Megaphone } from 'lucide-react';
import { Product } from '../../types';
import CreateProductModal from './CreateProductModal';
import EditProductModal from './EditProductModal';
import { PromotionModal } from './PromotionModal';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { TelegramService } from '../../services/telegram';

interface ProductListProps {
  products: Product[];
  onCreateProduct: (productData: any) => Promise<string>;
  onUpdateProduct: (productId: string, updates: any) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
  loading: boolean;
  selectedShopId?: string;
}

export default function ProductList({ 
  products, 
  onCreateProduct, 
  onUpdateProduct, 
  onDeleteProduct, 
  loading,
  selectedShopId
}: ProductListProps) {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [promotingProducts, setPromotingProducts] = useState<Set<string>>(new Set());
  const [promotingProduct, setPromotingProduct] = useState<Product | null>(null);

  const categories = Array.from(new Set(products.map(p => p.category))).filter(Boolean);
  
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filterCategory || product.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const handleDeleteProduct = async (productId: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await onDeleteProduct(productId);
      } catch (error) {
        console.error('Error deleting product:', error);
      }
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
  };

  const handleUpdateProduct = async (productId: string, updates: any) => {
    try {
      await onUpdateProduct(productId, updates);
      setEditingProduct(null);
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  };

  const handlePromoteProduct = (product: Product) => {
    setPromotingProduct(product);
  };

  const handlePromoteSubmit = async (promotionData: {
    product: Product;
    customMessage?: string;
    promotionImages?: string[];
    scheduledDate?: Date;
    isScheduled: boolean;
    promotionTitle?: string;
    discountPercentage?: number;
    validUntil?: Date;
    tags?: string[];
  }) => {
    if (!user?.uid || !selectedShopId) {
      alert('Unable to promote product. Please ensure you are logged in and have selected a shop.');
      return;
    }

    if (promotingProducts.has(promotionData.product.id)) return;

    setPromotingProducts(prev => new Set(prev).add(promotionData.product.id));

    try {
      // Get bot token
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        throw new Error('User configuration not found');
      }

      const userData = userDoc.data();
      const botToken = userData.telegramBotToken;

      if (!botToken) {
        throw new Error('Telegram bot token not configured. Please set up Telegram integration in Settings.');
      }

      // Get shop department (role: 'shop')
      const departmentsQuery = query(
        collection(db, 'departments'),
        where('userId', '==', user.uid),
        where('shopId', '==', selectedShopId),
        where('role', '==', 'shop')
      );

      const departmentsSnapshot = await getDocs(departmentsQuery);
      
      if (departmentsSnapshot.empty) {
        throw new Error('No shop channel/group configured. Please set up a shop department in Telegram Setup.');
      }

      const shopDepartment = departmentsSnapshot.docs[0].data();
      const shopChatId = shopDepartment.telegramChatId;

      // Create Telegram service and send product promotion
      const telegram = new TelegramService(botToken);
      
      // Get current shop name for the product link
      const shopDoc = await getDoc(doc(db, 'shops', selectedShopId));
      const shopName = shopDoc.exists() ? shopDoc.data().name : 'Shop';
      const productLink = `${window.location.origin}/shop/${encodeURIComponent(shopName)}`;

      // Enhanced promotion with all the new data
      await telegram.promoteProductEnhanced(promotionData, shopChatId, productLink);
      
      if (promotionData.isScheduled && promotionData.scheduledDate) {
        alert(`Promotion scheduled successfully for ${promotionData.scheduledDate.toLocaleString()}!`);
      } else {
        alert('Product promoted successfully to shop channel!');
      }
    } catch (error) {
      console.error('Error promoting product:', error);
      alert(`Failed to promote product: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setPromotingProducts(prev => {
        const newSet = new Set(prev);
        newSet.delete(promotionData.product.id);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Products</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
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
        
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="aspect-w-16 aspect-h-9 bg-gray-200">
              {product.images && product.images.length > 0 ? (
                <div className="relative">
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full h-48 object-cover"
                  />
                  {product.images.length > 1 && (
                    <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full flex items-center space-x-1">
                      <ImageIcon className="w-3 h-3" />
                      <span>+{product.images.length - 1}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                  <Package className="h-12 w-12 text-gray-400" />
                </div>
              )}
            </div>
            
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900 text-base leading-tight">{product.name}</h3>
                <div className="flex space-x-1 ml-2">
                  <button
                    onClick={() => handleEditProduct(product)}
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors duration-200"
                    title="Edit Product"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handlePromoteProduct(product)}
                    disabled={promotingProducts.has(product.id)}
                    className="p-1 text-gray-400 hover:text-green-600 transition-colors duration-200 disabled:opacity-50"
                    title="Promote to Shop Channel"
                  >
                    {promotingProducts.has(product.id) ? (
                      <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Megaphone className="h-4 w-4" />
                    )}
                  </button>
                  <button 
                    onClick={() => handleDeleteProduct(product.id)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors duration-200"
                    title="Delete Product"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mb-3 line-clamp-2 min-h-[2.5rem]">
                {product.description}
              </p>
              
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-lg font-bold text-gray-900">${product.price.toFixed(2)}</span>
                  <div className="flex items-center space-x-2 mt-1">
                    <p className="text-sm text-gray-500">Stock: {product.stock}</p>
                    {product.stock <= product.lowStockAlert && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Low
                      </span>
                    )}
                  </div>
                  {product.sku && (
                    <p className="text-xs text-gray-400">SKU: {product.sku}</p>
                  )}
                </div>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full whitespace-nowrap">
                  {product.category}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && !loading && (
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            {searchTerm || filterCategory ? 'No products found' : 'No products yet'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || filterCategory 
              ? 'Try adjusting your search or filter criteria.'
              : 'Add your first product to start selling.'
            }
          </p>
        </div>
      )}

      <CreateProductModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={onCreateProduct}
        selectedShopId={selectedShopId}
      />

      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSubmit={handleUpdateProduct}
          selectedShopId={selectedShopId}
        />
      )}

      {promotingProduct && (
        <PromotionModal
          product={promotingProduct}
          onClose={() => setPromotingProduct(null)}
          onPromote={handlePromoteSubmit}
        />
      )}
    </div>
  );
}