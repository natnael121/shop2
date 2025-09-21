import React, { useState } from "react";
import { X } from "lucide-react";
import { Product } from "../types";

interface MenuDetailProps {
  product: Product;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number, size: string, color: string) => void;
}

export const MenuDetail: React.FC<MenuDetailProps> = ({
  product,
  onClose,
  onAddToCart,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string>("43");
  const [selectedColor, setSelectedColor] = useState<string>("magenta");

  const handleAddToCart = () => {
    onAddToCart(product, quantity, selectedSize, selectedColor);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-xl">
        {/* Image Section */}
        <div className="relative">
          <img
            src={product.images?.[0]}
            alt={product.name}
            className="w-full object-cover"
          />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-black/50 p-2 rounded-full"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{product.name}</h2>
            <p className="text-gray-500 text-sm">{product.category}</p>
          </div>

          {/* Price */}
          <div className="flex items-center space-x-3">
            <span className="text-2xl font-bold text-blue-600">
              ${product.price.toFixed(2)}
            </span>
            {product.estimatedPriceRange && (
              <span className="text-gray-400 text-sm">
                Est. Resell {product.estimatedPriceRange}
              </span>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <p className="text-gray-600 text-sm leading-relaxed">
              {product.description}
            </p>
          )}

          {/* Size & Color */}
          <div className="flex space-x-4">
            <div>
              <label className="text-gray-700 text-sm font-medium">Size</label>
              <select
                className="mt-1 block w-20 border rounded-lg p-2 text-sm"
                value={selectedSize}
                onChange={(e) => setSelectedSize(e.target.value)}
              >
                <option value="41">41</option>
                <option value="42">42</option>
                <option value="43">43</option>
                <option value="44">44</option>
              </select>
            </div>

            <div>
              <label className="text-gray-700 text-sm font-medium">Color</label>
              <select
                className="mt-1 block w-24 border rounded-lg p-2 text-sm"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
              >
                <option value="magenta">Magenta</option>
                <option value="blue">Blue</option>
                <option value="black">Black</option>
              </select>
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="text-gray-700 text-sm font-medium">Quantity</label>
            <input
              type="number"
              className="mt-1 block w-20 border rounded-lg p-2 text-sm"
              value={quantity}
              min={1}
              max={product.stock}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t bg-gray-50">
          <button
            onClick={handleAddToCart}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-500 transition"
          >
            Add To Bag
          </button>
        </div>
      </div>
    </div>
  );
};
