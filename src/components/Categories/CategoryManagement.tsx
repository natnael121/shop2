import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, Save, Tag, Package, Upload, Image as ImageIcon, QrCode } from 'lucide-react';
import { imgbbService } from '../../services/imgbb';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../lib/firebase';
import { QRCodeGenerator } from '../QRCodeGenerator';

interface Category {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  iconType?: 'emoji' | 'image';
  iconImage?: string;
  order: number;
  userId: string;
  shopId?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CategoryManagementProps {
  selectedShopId?: string;
}

const CategoryManagement: React.FC<CategoryManagementProps> = ({ selectedShopId }) => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showQRGenerator, setShowQRGenerator] = useState(false);
  const [shopData, setShopData] = useState<any>(null);
  const [businessLogo, setBusinessLogo] = useState<string>('');
  const [shopSlug, setShopSlug] = useState<string>('');

  useEffect(() => {
    if (!user?.uid) return;

    // Load shop data if shopId is provided
    if (selectedShopId) {
      const loadShopData = async () => {
        try {
          const shopDocRef = doc(db, 'shops', selectedShopId);
          const shopSnapshot = await getDoc(shopDocRef);
          if (shopSnapshot.exists()) {
            const data = shopSnapshot.data();
            setShopData(data);
            setBusinessLogo(data.logo || '');
            setShopSlug(data.slug || data.name.toLowerCase().replace(/\s+/g, '-'));
          }
        } catch (error) {
          console.error('Error loading shop data:', error);
        }
      };
      loadShopData();
    }

    const q = query(
      collection(db, 'categories'),
      where('userId', '==', user.uid),
      ...(selectedShopId ? [where('shopId', '==', selectedShopId)] : [])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const categoriesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as Category[];
      
      setCategories(categoriesData.sort((a, b) => a.order - b.order));
      setLoading(false);
    });

    return unsubscribe;
  }, [user?.uid, selectedShopId]);

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Failed to delete category');
    }
  };

  const handleGenerateQRCodes = () => {
    if (!selectedShopId) {
      alert('Please select a shop first');
      return;
    }
    
    if (!shopSlug) {
      alert('Shop information not loaded yet. Please wait.');
      return;
    }
    
    if (categories.length === 0) {
      alert('No categories available. Please create categories first.');
      return;
    }
    
    setShowQRGenerator(true);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Category Management</h2>
          <p className="text-gray-600">Organize your products with custom categories</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleGenerateQRCodes}
            disabled={!selectedShopId || categories.length === 0 || !shopSlug}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <QrCode className="h-4 w-4 mr-2" />
            Generate QR Codes
          </button>
          <button
            onClick={() => setShowAddCategory(true)}
            disabled={!selectedShopId}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </button>
        </div>
      </div>

      {/* Shop Info Banner */}
      {selectedShopId && shopData && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {shopData.logo && (
                <img
                  src={shopData.logo}
                  alt={shopData.name}
                  className="w-10 h-10 rounded-lg object-cover"
                />
              )}
              <div>
                <h3 className="font-semibold text-gray-900">{shopData.name}</h3>
                <p className="text-sm text-gray-600">
                  {categories.length} categories available for QR generation
                  {shopSlug && (
                    <span className="ml-2 text-blue-600">
                      (URL: /shop/{shopSlug})
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={handleGenerateQRCodes}
              disabled={categories.length === 0 || !shopSlug}
              className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <QrCode className="h-3.5 w-3.5 mr-1.5" />
              QR Codes
            </button>
          </div>
        </div>
      )}

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((category) => (
          <div key={category.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden"
                  style={{ backgroundColor: category.color + '20' }}
                >
                  {category.iconType === 'image' && category.iconImage ? (
                    <img
                      src={category.iconImage}
                      alt={category.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl">{category.icon || '📦'}</span>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{category.name}</h3>
                  {category.description && (
                    <p className="text-sm text-gray-500">{category.description}</p>
                  )}
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setEditingCategory(category)}
                  className="text-blue-600 hover:text-blue-700 p-1 transition-colors duration-200"
                  title="Edit Category"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteCategory(category.id)}
                  className="text-red-600 hover:text-red-700 p-1 transition-colors duration-200"
                  title="Delete Category"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <p className="text-xs text-gray-500">
                Created: {category.createdAt?.toLocaleDateString()}
              </p>
              <span 
                className="text-xs font-medium px-2 py-1 rounded"
                style={{ 
                  backgroundColor: category.color + '20',
                  color: category.color 
                }}
              >
                Order: {category.order}
              </span>
            </div>
          </div>
        ))}

        {categories.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Tag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No categories yet</h3>
            <p className="text-gray-600 mb-6">
              {!selectedShopId 
                ? 'Select a shop first, then create categories to organize your products'
                : 'Create your first category to organize your products'
              }
            </p>
            <div className="flex justify-center space-x-3">
              {!selectedShopId && (
                <div className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg border border-yellow-200">
                  Select a shop first
                </div>
              )}
              <button
                onClick={() => setShowAddCategory(true)}
                disabled={!selectedShopId}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </button>
            </div>
          </div>
        )}
      </div>

      {/* QR Code Generator Modal */}
      {showQRGenerator && selectedShopId && shopData && shopSlug && (
        <QRCodeGenerator
          userId={user?.uid || ''}
          businessName={shopData.name}
          businessLogo={businessLogo}
          shopName={shopSlug}
          categories={categories}
          onClose={() => setShowQRGenerator(false)}
        />
      )}

      {/* Add/Edit Category Modal */}
      {(showAddCategory || editingCategory) && (
        <CategoryModal
          category={editingCategory}
          userId={user?.uid || ''}
          shopId={selectedShopId}
          onClose={() => {
            setShowAddCategory(false);
            setEditingCategory(null);
          }}
          onSave={() => {
            setShowAddCategory(false);
            setEditingCategory(null);
          }}
        />
      )}
    </div>
  );
};
// Update CategoryManagement component props
interface CategoryManagementProps {
  categories: Category[];
  loading: boolean;
  selectedShopId?: string;
}

export default function CategoryManagement({ 
  categories, 
  loading, 
  selectedShopId 
}: CategoryManagementProps) {
  // Your existing component code
}
// Category Modal Component
interface CategoryModalProps {
  category: Category | null;
  userId: string;
  shopId?: string;
  onClose: () => void;
  onSave: () => void;
}

const CategoryModal: React.FC<CategoryModalProps> = ({ 
  category, 
  userId, 
  shopId,
  onClose, 
  onSave 
}) => {
  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');
  const [color, setColor] = useState(category?.color || '#3B82F6');
  const [icon, setIcon] = useState(category?.icon || '');
  const [iconType, setIconType] = useState<'emoji' | 'image'>(category?.iconType || 'emoji');
  const [iconImage, setIconImage] = useState(category?.iconImage || '');
  const [order, setOrder] = useState(category?.order || 0);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const CATEGORY_ICONS = [
    '📦', '🍕', '🍔', '🥗', '🍰', '☕', '🍹', '🍜', '🍝', '🥘',
    '🍖', '🐟', '🥩', '🧀', '🥖', '🍞', '🥐', '🥯', '🍪', '🍫',
    '🍎', '🍌', '🍊', '🍇', '🥑', '🥕', '🥒', '🌶️', '🧄', '🧅'
  ];

  const PRESET_COLORS = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      alert('Please enter a category name');
      return;
    }

    setSaving(true);

    try {
      const categoryData = {
        name: name.trim(),
        description: description.trim(),
        color,
        icon: icon || '📦',
        iconType,
        iconImage: iconType === 'image' ? iconImage : '',
        order,
        userId,
        ...(shopId && { shopId }),
        updatedAt: new Date(),
        ...(category ? {} : { createdAt: new Date() })
      };

      if (category) {
        await updateDoc(doc(db, 'categories', category.id), categoryData);
      } else {
        await addDoc(collection(db, 'categories'), categoryData);
      }

      onSave();
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {category ? 'Edit Category' : 'Add New Category'}
            </h2>
            <button 
              onClick={onClose} 
              className="text-gray-500 hover:text-gray-700 transition-colors duration-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
              placeholder="e.g., Main Dishes, Beverages"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
              placeholder="Optional description..."
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category Color
            </label>
            <div className="flex items-center space-x-2 mb-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-12 h-10 border border-gray-300 rounded-lg cursor-pointer"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="#3B82F6"
              />
            </div>
            <div className="grid grid-cols-5 gap-2">
              {PRESET_COLORS.map((presetColor, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setColor(presetColor)}
                  className={`w-8 h-8 rounded border-2 transition-all duration-200 ${
                    color === presetColor ? 'border-gray-800 scale-110' : 'border-gray-200 hover:scale-105'
                  }`}
                  style={{ backgroundColor: presetColor }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category Icon
            </label>

            <div className="flex space-x-2 mb-3">
              <button
                type="button"
                onClick={() => setIconType('emoji')}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors duration-200 ${
                  iconType === 'emoji'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                Use Emoji
              </button>
              <button
                type="button"
                onClick={() => setIconType('image')}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors duration-200 ${
                  iconType === 'image'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                Upload Image
              </button>
            </div>

            {iconType === 'emoji' ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="📦"
                  maxLength={2}
                />
                <div className="grid grid-cols-10 gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                  {CATEGORY_ICONS.map((emoji, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setIcon(emoji)}
                      className={`p-2 text-lg rounded border hover:bg-gray-50 transition-colors duration-200 ${
                        icon === emoji ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {iconImage ? (
                  <div className="relative group">
                    <img
                      src={iconImage}
                      alt="Category icon"
                      className="w-full h-32 object-cover rounded-lg border border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={() => setIconImage('')}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors duration-200">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !file.type.startsWith('image/')) return;

                        setUploadingImage(true);
                        try {
                          const imageUrl = await imgbbService.uploadImage(file, `category-${name || 'icon'}-${Date.now()}`);
                          setIconImage(imageUrl);
                        } catch (error) {
                          console.error('Error uploading image:', error);
                          alert('Failed to upload image. Please try again.');
                        } finally {
                          setUploadingImage(false);
                        }
                      }}
                      className="hidden"
                      id="category-icon-upload"
                      disabled={uploadingImage}
                    />
                    <label
                      htmlFor="category-icon-upload"
                      className="cursor-pointer flex flex-col items-center space-y-2"
                    >
                      {uploadingImage ? (
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Upload className="h-8 w-8 text-gray-400" />
                      )}
                      <span className="text-sm text-gray-600">
                        {uploadingImage ? 'Uploading...' : 'Click to upload icon image'}
                      </span>
                      <span className="text-xs text-gray-500">PNG, JPG up to 10MB</span>
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Display Order
            </label>
            <input
              type="number"
              value={order}
              onChange={(e) => setOrder(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
              min="0"
            />
          </div>

          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:bg-gray-400 flex items-center space-x-2"
            > 
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Category'}</span>
            </button>
          </div>
        </form>
      </div>
    </div> 
  );   
};

export default CategoryManagement;
