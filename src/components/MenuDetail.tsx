import React, { useState } from 'react';
import { X, Plus, Minus, Package, AlertTriangle, Star, Tag, Box } from 'lucide-react';
import { Product } from '../types';

interface MenuDetailProps {
  product: Product;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
}

export const MenuDetail: React.FC<MenuDetailProps> = ({ product, onClose, onAddToCart }) => {
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const handleAddToCart = () => {
    if (product.isActive && product.stock > 0) {
      onAddToCart(product, quantity);
      onClose();
    }
  };

  const incrementQuantity = () => {
    setQuantity(prev => Math.min(prev + 1, product.stock));
  };
  
  const decrementQuantity = () => {
    setQuantity(prev => Math.max(1, prev - 1));
  };

  const isAvailable = product.isActive && product.stock > 0;
  const isLowStock = product.stock <= product.lowStockAlert;
  const images = product.images && product.images.length > 0 ? product.images : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2">
      <div className="bg-gray-900 w-full max-w-md max-h-[90vh] rounded-xl overflow-hidden animate-slide-up flex flex-col shadow-xl">
        
        {/* Image section */}
        <div className="relative h-48">
          {images.length > 0 ? (
            <img
              src={images[currentImageIndex]}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-700 flex items-center justify-center">
              <Package className="w-16 h-16 text-gray-400" />
            </div>
          )}
          
          <button
            onClick={onClose}
            className="absolute top-2 right-2 bg-black/50 rounded-full p-1.5"
          >
            <X className="w-4 h-4 text-white" />
          </button>

          {/* Image navigation dots */}
          {images.length > 1 && (
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`w-2 h-2 rounded-full ${
                    currentImageIndex === index ? 'bg-white' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Status badges */}
          <div className="absolute top-2 left-2 flex flex-col space-y-1">
            {product.category && (
              <div className="bg-blue-600 rounded-full px-2 py-0.5">
                <span className="text-white text-xs font-medium">
                  {product.category}
                </span>
              </div>
            )}
            {isLowStock && isAvailable && (
              <div className="bg-orange-500 rounded-full px-2 py-0.5">
                <span className="text-white text-xs font-medium">
                  Low Stock
                </span>
              </div>
            )}
            {!isAvailable && (
              <div className="bg-red-500 rounded-full px-2 py-0.5">
                <span className="text-white text-xs font-medium">
                  {product.stock === 0 ? 'Out of Stock' : 'Unavailable'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
          {/* Title and basic info */}
          <div>
            <h2 className="text-xl font-bold text-white mb-2">{product.name}</h2>
            
            {/* Price and stock info */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold text-yellow-400">
                ${product.price.toFixed(2)}
              </span>
              <div className="text-right">
                <div className="text-gray-300 text-sm">
                  {product.stock} in stock
                </div>
                {product.sku && (
                  <div className="text-gray-400 text-xs">
                    SKU: {product.sku}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div>
              <h3 className="text-white font-semibold mb-2 flex items-center space-x-2">
                <span>Description</span>
              </h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                {product.description}
              </p>
            </div>
          )}

          {/* Product details */}
          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-1">
                <Tag className="w-4 h-4 text-blue-400" />
                <span className="text-white font-semibold text-xs">Category</span>
              </div>
              <span className="text-gray-300 text-sm">{product.category}</span>
            </div>

            {/* Stock Status */}
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-1">
                <Box className="w-4 h-4 text-green-400" />
                <span className="text-white font-semibold text-xs">Stock</span>
              </div>
              <span className={`text-sm ${
                product.stock > product.lowStockAlert ? 'text-green-400' : 
                product.stock > 0 ? 'text-orange-400' : 'text-red-400'
              }`}>
                {product.stock > 0 ? `${product.stock} available` : 'Out of stock'}
              </span>
            </div>
          </div>

          {/* Subcategory if available */}
          {product.subcategory && (
            <div>
              <h3 className="text-white font-semibold mb-1 text-sm">Subcategory</h3>
              <span className="text-gray-300 text-sm">{product.subcategory}</span>
            </div>
          )}

          {/* Low stock warning */}
          {isLowStock && isAvailable && (
            <div className="bg-orange-500/20 border border-orange-500/30 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
                <span className="text-orange-300 text-sm font-medium">
                  Only {product.stock} left in stock!
                </span>
              </div>
            </div>
          )}

          {/* Additional images preview */}
          {images.length > 1 && (
            <div>
              <h3 className="text-white font-semibold mb-2 text-sm">More Images</h3>
              <div className="grid grid-cols-4 gap-2">
                {images.slice(1, 5).map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index + 1)}
                    className="aspect-square rounded-lg overflow-hidden bg-gray-700 hover:opacity-80 transition-opacity"
                  >
                    <img
                      src={image}
                      alt={`${product.name} ${index + 2}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center bg-gray-700 rounded-lg">
              <button
                onClick={decrementQuantity}
                className="p-2 hover:bg-gray-600 rounded-l-lg transition-colors"
                disabled={!isAvailable}
              >
                <Minus className="w-4 h-4 text-white" />
              </button>
              <span className="px-4 py-2 font-bold text-white">{quantity}</span>
              <button
                onClick={incrementQuantity}
                className="p-2 hover:bg-gray-600 rounded-r-lg transition-colors"
                disabled={!isAvailable || quantity >= product.stock}
              >
                <Plus className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="text-right">
              {quantity > 1 && (
                <div className="text-gray-400 text-sm mb-1">
                  ${product.price.toFixed(2)} × {quantity}
                </div>
              )}
              <div className="text-xl font-bold text-yellow-400">
                ${(product.price * quantity).toFixed(2)}
              </div>
            </div>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={!isAvailable}
            className="w-full bg-yellow-400 text-gray-900 py-3 rounded-lg font-semibold hover:bg-yellow-300 transition-colors disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {!product.isActive ? 'Product Unavailable' : 
             product.stock === 0 ? 'Out of Stock' : 
             'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  );
};