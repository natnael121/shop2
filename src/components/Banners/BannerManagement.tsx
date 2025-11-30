import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { X, Plus, Edit2, Trash2, Upload, Link2, Calendar, Toggle2, ArrowUp, ArrowDown } from 'lucide-react';

interface Banner {
  id: string;
  userId: string;
  shopId: string;
  title: string;
  description: string;
  imageUrl: string;
  link?: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

interface BannerFormData {
  title: string;
  description: string;
  imageUrl: string;
  link: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export default function BannerManagement({ selectedShopId }: { selectedShopId?: string }) {
  const { user } = useAuth();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState<BannerFormData>({
    title: '',
    description: '',
    imageUrl: '',
    link: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    isActive: true,
  });

  useEffect(() => {
    if (selectedShopId && user) {
      loadBanners();
    }
  }, [selectedShopId, user]);

  const loadBanners = async () => {
    if (!selectedShopId || !user) return;

    try {
      setLoading(true);
      const bannersQuery = query(
        collection(db, 'banners'),
        where('shopId', '==', selectedShopId),
        where('userId', '==', user.uid)
      );

      const snapshot = await getDocs(bannersQuery);
      const bannersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate?.() || new Date(doc.data().startDate),
        endDate: doc.data().endDate?.toDate?.() || new Date(doc.data().endDate),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt),
        updatedAt: doc.data().updatedAt?.toDate?.() || new Date(doc.data().updatedAt),
      })) as Banner[];

      bannersData.sort((a, b) => a.order - b.order);
      setBanners(bannersData);
    } catch (error) {
      console.error('Error loading banners:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) {
    alert("No file selected");
    return;
  }

  try {
    setUploading(true);

    const formData = new FormData();
    formData.append("image", file);

    console.log("Uploading to:", `${IMGBB_API_URL}?key=${IMGBB_API_KEY}`);

    const response = await fetch(`${IMGBB_API_URL}?key=${IMGBB_API_KEY}`, {
      method: "POST",
      body: formData,
    });

    const text = await response.text();  // read raw response
    console.log("Raw ImgBB Response:", text);

    const data = JSON.parse(text);

    if (!data.success) {
      console.error("ImgBB Error:", data);
      alert("Image upload failed: " + (data?.error?.message || "Unknown error"));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      imageUrl: data.data.url,
    }));
  } catch (error) {
    console.error("Upload exception:", error);
    alert("Upload failed: " + error);
  } finally {
    setUploading(false);
  }
};


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShopId || !user || !formData.imageUrl) {
      alert('Please fill in all required fields and upload an image');
      return;
    }

    try {
      setLoading(true);
      const bannerData = {
        userId: user.uid,
        shopId: selectedShopId,
        title: formData.title,
        description: formData.description,
        imageUrl: formData.imageUrl,
        link: formData.link || null,
        startDate: new Date(formData.startDate),
        endDate: new Date(formData.endDate),
        isActive: formData.isActive,
        updatedAt: new Date(),
      };

      if (editingId) {
        await updateDoc(doc(db, 'banners', editingId), bannerData);
      } else {
        await addDoc(collection(db, 'banners'), {
          ...bannerData,
          order: banners.length,
          createdAt: new Date(),
        });
      }

      resetForm();
      await loadBanners();
    } catch (error) {
      console.error('Error saving banner:', error);
      alert('Failed to save banner');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (banner: Banner) => {
    setFormData({
      title: banner.title,
      description: banner.description,
      imageUrl: banner.imageUrl,
      link: banner.link || '',
      startDate: banner.startDate.toISOString().split('T')[0],
      endDate: banner.endDate.toISOString().split('T')[0],
      isActive: banner.isActive,
    });
    setEditingId(banner.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this banner?')) return;

    try {
      setLoading(true);
      await deleteDoc(doc(db, 'banners', id));
      await loadBanners();
    } catch (error) {
      console.error('Error deleting banner:', error);
      alert('Failed to delete banner');
    } finally {
      setLoading(false);
    }
  };

  const handleReorder = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === banners.length - 1) return;

    const newBanners = [...banners];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newBanners[index].order, newBanners[swapIndex].order] = [newBanners[swapIndex].order, newBanners[index].order];

    try {
      await updateDoc(doc(db, 'banners', newBanners[index].id), { order: newBanners[index].order });
      await updateDoc(doc(db, 'banners', newBanners[swapIndex].id), { order: newBanners[swapIndex].order });
      await loadBanners();
    } catch (error) {
      console.error('Error reordering banners:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      imageUrl: '',
      link: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isActive: true,
    });
    setEditingId(null);
    setShowForm(false);
  };

  if (!selectedShopId) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Shop Selected</h3>
        <p className="text-gray-500">Please select a shop to manage banners.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Banners</h2>
        <button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Banner
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingId ? 'Edit Banner' : 'Create New Banner'}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Promotion Link
              </label>
              <input
                type="url"
                value={formData.link}
                onChange={(e) => setFormData(prev => ({ ...prev, link: e.target.value }))}
                placeholder="https://example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Banner Image *
            </label>
            <div className="flex items-center gap-4">
              <label className="flex-1 flex items-center justify-center px-4 py-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition">
                <div className="text-center">
                  <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <span className="text-sm text-gray-600">Click to upload</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
              {formData.imageUrl && (
                <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={formData.imageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date *
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
              Active
            </label>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || uploading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
            >
              {loading ? 'Saving...' : editingId ? 'Update Banner' : 'Create Banner'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {banners.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No banners yet. Create one to get started!</p>
          </div>
        ) : (
          <div className="divide-y">
            {banners.map((banner, index) => {
              const now = new Date();
              const isExpired = banner.endDate < now;
              const notStarted = banner.startDate > now;

              return (
                <div key={banner.id} className="p-6 hover:bg-gray-50 transition">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      <img
                        src={banner.imageUrl}
                        alt={banner.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">{banner.title}</h3>
                          <p className="text-sm text-gray-500">{banner.description}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isExpired && (
                            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                              Expired
                            </span>
                          )}
                          {notStarted && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">
                              Upcoming
                            </span>
                          )}
                          {!isExpired && !notStarted && banner.isActive && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                              Active
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {banner.startDate.toLocaleDateString()} - {banner.endDate.toLocaleDateString()}
                        </span>
                        {banner.link && (
                          <span className="flex items-center gap-1">
                            <Link2 className="w-4 h-4" />
                            {new URL(banner.link).hostname}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleReorder(index, 'up')}
                          disabled={index === 0}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleReorder(index, 'down')}
                          disabled={index === banners.length - 1}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(banner)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(banner.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
