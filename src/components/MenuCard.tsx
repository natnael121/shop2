import React from "react";
import { Heart, Package } from "lucide-react";
import { Product } from "../types";

interface MenuCardProps {
  product: Product;
  onClick: () => void;
  onAddToWishlist?: (product: Product) => void;
}

export const MenuCard: React.FC<MenuCardProps> = ({
  product,
  onClick,
  onAddToWishlist,
}) => {
  const isAvailable = product.isActive && product.stock > 0;

  const handleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAddToWishlist) {
      onAddToWishlist(product);
    }
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl p-3 shadow-md cursor-pointer hover:shadow-lg transition relative"
    >
      {/* Product Image */}
      <div className="aspect-square rounded-xl overflow-hidden flex items-center justify-center bg-gray-100 relative">
        {product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-gray-400 flex items-center justify-center h-full">
            <Package className="w-10 h-10" />
          </div>
        )}

        {/* Favorite Button */}
        <button
          onClick={handleWishlist}
          className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full shadow hover:bg-white"
        >
          <Heart className="w-4 h-4 text-gray-600 hover:text-red-500 transition" />
        </button>
      </div>

      {/* Product Info */}
      <div className="mt-3 space-y-1">
        <h3 className="text-gray-800 font-semibold text-sm line-clamp-2">
          {product.name}
        </h3>
        <span className="text-blue-600 font-bold text-sm">
          ${product.price.toFixed(2)}
        </span>
      </div>

      {/* Availability overlay if product is not active */}
      {!isAvailable && (
        <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center">
          <span className="text-white text-xs font-semibold">
            {product.stock === 0 ? "Out of Stock" : "Unavailable"}
          </span>
        </div>
      )}
    </div>
  );
};
