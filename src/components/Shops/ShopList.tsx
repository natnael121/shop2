import React, { useState } from 'react';
import { Store, Plus, Settings, ExternalLink, Users, Package } from 'lucide-react';
import { Shop } from '../../types';
import CreateShopModal from './CreateShopModal';

interface ShopListProps {
  shops: Shop[];
  onCreateShop: (shopData: any) => Promise<string>;
  onSelectShop: (shop: Shop) => void;
  selectedShop?: Shop;
}

export default function ShopList({ shops, onCreateShop, onSelectShop, selectedShop }: ShopListProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">My Shops</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create New Shop
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {shops.map((shop) => (
          <div
            key={shop.id}
            className={`bg-white rounded-xl shadow-sm border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${
              selectedShop?.id === shop.id ? 'border-blue-500' : 'border-gray-200'
            }`}
            onClick={() => onSelectShop(shop)}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Store className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{shop.name}</h3>
                    <p className="text-sm text-gray-500">/{shop.slug}</p>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <button className="p-1 text-gray-400 hover:text-gray-600">
                    <Settings className="h-4 w-4" />
                  </button>
                  <a 
                    href={`/shop/${encodeURIComponent(shop.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                {shop.description}
              </p>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center text-gray-500">
                    <Package className="h-4 w-4 mr-1" />
                    <span>0 products</span>
                  </div>
                  <div className="flex items-center text-gray-500">
                    <Users className="h-4 w-4 mr-1" />
                    <span>0 orders</span>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  shop.isActive 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {shop.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {shops.length === 0 && (
        <div className="text-center py-12">
          <Store className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No shops yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Create your first shop to start managing products and orders.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Shop
          </button>
        </div>
      )}

      <CreateShopModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={onCreateShop}
      />
    </div>
  );
}