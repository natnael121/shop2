import React from 'react';
import { Plus, Clock, Package, Star } from 'lucide-react';
import { Product } from '../types';

interface MenuCardProps {
  product: Product;
  onClick: () => void;
  onAddToCart: (product: Product) => void;
  theme?: 'classic' | 'modern' | 'elegant' | 'minimal';
}

export const MenuCard: React.FC<MenuCardProps> = ({
  product,
  onClick,
  onAddToCart,
  theme = 'modern',
}) => {
  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (product.isActive && product.stock > 0) {
      onAddToCart(product);
    }
  };

  const isAvailable = product.isActive && product.stock > 0;
  const isLowStock = product.stock <= product.lowStockAlert;

  return (
    <div
      onClick={onClick}
      className={`bg-gray-800 rounded-xl p-2 sm:p-3 cursor-pointer transform transition-all duration-300 hover:scale-105 relative overflow-hidden ${
        !isAvailable ? 'opacity-75' : ''
      }`}
    >
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-700/20 to-gray-900/40 rounded-xl" />

      {/* Content */}
      <div className="relative z-10">
        {/* Image */}
        <div className="relative mb-2 sm:mb-3">
          <div className="aspect-square rounded-lg overflow-hidden bg-gray-700">
            {product.images && product.images.length > 0 ? (
              <img
                src={product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-8 h-8 text-gray-400" />
              </div>
            )}
          </div>

          {/* Plus button */}
          {isAvailable && (
            <button
              onClick={handleAddToCart}
              className="absolute -bottom-2 -right-2 w-7 h-7 sm:w-8 sm:h-8 bg-yellow-400 rounded-full flex items-center justify-center shadow-md hover:bg-yellow-300 transition-colors z-20"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-900" />
            </button>
          )}

          {/* Category badge */}
          {product.category && (
            <div className="absolute top-2 right-2 bg-blue-600 rounded-full px-2 py-0.5">
              <span className="text-white text-[10px] font-medium">
                {product.category}
              </span>
            </div>
          )}

          {/* Stock status overlay */}
          {!isAvailable && (
            <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center p-2">
              <div className="text-center text-white text-[11px] leading-snug">
                {!product.isActive ? (
                  <span className="font-semibold">Unavailable</span>
                ) : product.stock === 0 ? (
                  <span className="font-semibold">Out of Stock</span>
                ) : (
                  <span className="font-semibold">Not Available</span>
                )}
              </div>
            </div>
          )}

          {/* Low stock warning */}
          {isAvailable && isLowStock && (
            <div className="absolute top-2 left-2 bg-orange-500 rounded-full px-1.5 py-0.5">
              <span className="text-white text-[10px] font-medium">
                Low Stock
              </span>
            </div>
          )}
        </div>

        {/* Item details */}
        <div className="space-y-0.5">
          <h3 className="text-white font-semibold text-sm sm:text-base leading-tight line-clamp-2">
            {product.name}
          </h3>

          {/* Description */}
          {product.description && (
            <p className="text-gray-300 text-xs leading-tight line-clamp-1">
              {product.description}
            </p>
          )}

          <div className="flex items-center justify-between">
            <span className="text-white font-bold text-sm sm:text-base">
              ${product.price.toFixed(2)}
            </span>
            <div className="flex items-center space-x-1">
              {product.stock > 0 && (
                <span className="text-gray-400 text-[10px] sm:text-xs">
                  {product.stock} left
                </span>
              )}
            </div>
          </div>

          {/* SKU if available */}
          {product.sku && (
            <div className="text-gray-400 text-[10px]">
              SKU: {product.sku}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};