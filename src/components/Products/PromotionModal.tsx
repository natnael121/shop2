import React, { useState } from 'react';
import { X, Upload, Calendar, Clock, Image as ImageIcon, Trash2, Send, Eye } from 'lucide-react';
import { Product } from '../../types';
import { imgbbService } from '../../services/imgbb';

interface PromotionModalProps {
  product: Product;
  onClose: () => void;
  onPromote: (promotionData: {
    product: Product;
    customMessage?: string;
    promotionImages?: string[];
    scheduledDate?: Date;
    isScheduled: boolean;
    promotionTitle?: string;
    discountPercentage?: number;
    validUntil?: Date;
    tags?: string[];
  }) => Promise<void>;
}

export const PromotionModal: React.FC<PromotionModalProps> = ({
  product,
  onClose,
  onPromote,
}) => {
  const [customMessage, setCustomMessage] = useState('');
  const [promotionTitle, setPromotionTitle] = useState(`🔥 Special Offer: ${product.name}`);
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);
  const [validUntil, setValidUntil] = useState<string>('');
  const [tags, setTags] = useState<string[]>(['#special', '#offer']);
  const [newTag, setNewTag] = useState('');
  const [promotionImages, setPromotionImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [scheduledTime, setScheduledTime] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImages(true);
    try {
      const uploadPromises = Array.from(files).map(file => 
        imgbbService.uploadImage(file, `promotion-${product.name}-${Date.now()}`)
      );
      
      const uploadedUrls = await Promise.all(uploadPromises);
      setPromotionImages(prev => [...prev, ...uploadedUrls]);
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('Failed to upload images. Please try again.');
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index: number) => {
    setPromotionImages(prev => prev.filter((_, i) => i !== index));
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      const formattedTag = newTag.trim().startsWith('#') ? newTag.trim() : `#${newTag.trim()}`;
      setTags(prev => [...prev, formattedTag]);
      setNewTag('');
    }
  };

  const removeTag = (index: number) => {
    setTags(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const promotionData = {
        product,
        customMessage: customMessage.trim(),
        promotionImages,
        promotionTitle: promotionTitle.trim(),
        discountPercentage: discountPercentage > 0 ? discountPercentage : undefined,
        validUntil: validUntil ? new Date(validUntil) : undefined,
        tags,
        isScheduled,
        scheduledDate: isScheduled && scheduledDate && scheduledTime 
          ? new Date(`${scheduledDate}T${scheduledTime}`) 
          : undefined,
      };

      await onPromote(promotionData);
      onClose();
    } catch (error) {
      console.error('Error promoting product:', error);
      alert('Failed to promote product. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const generatePreviewMessage = () => {
    const discountText = discountPercentage > 0 ? `\n💥 <b>${discountPercentage}% OFF!</b>` : '';
    const originalPrice = discountPercentage > 0 ? `\n~~$${product.price.toFixed(2)}~~ ` : '';
    const discountedPrice = discountPercentage > 0 ? `<b>$${(product.price * (1 - discountPercentage / 100)).toFixed(2)}</b>` : `<b>$${product.price.toFixed(2)}</b>`;
    const validUntilText = validUntil ? `\n⏰ <b>Valid until:</b> ${new Date(validUntil).toLocaleDateString()}` : '';
    const tagsText = tags.length > 0 ? `\n\n${tags.join(' ')}` : '';
    
    return `
🔥 <b>${promotionTitle}</b>${discountText}

🛍️ <b>${product.name}</b>

${customMessage || product.description}

💰 <b>Price:</b> ${originalPrice}${discountedPrice}
📦 <b>Available:</b> ${product.stock} in stock
${product.sku ? `🏷️ <b>SKU:</b> ${product.sku}` : ''}${validUntilText}

🛒 <b>Order Now!</b> Don't miss this amazing deal!${tagsText}

<i>🚀 Limited time offer - Order today!</i>
    `.trim();
  };

  if (previewMode) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Promotion Preview</h2>
              <button 
                onClick={() => setPreviewMode(false)} 
                className="text-gray-500 hover:text-gray-700 transition-colors duration-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Preview Images */}
            {(promotionImages.length > 0 || product.images.length > 0) && (
              <div className="mb-4">
                <img
                  src={promotionImages[0] || product.images[0]}
                  alt={product.name}
                  className="w-full h-48 object-cover rounded-lg border border-gray-200"
                />
              </div>
            )}

            {/* Preview Message */}
            <div className="bg-gray-50 p-4 rounded-lg border">
              <div 
                className="text-sm whitespace-pre-line"
                dangerouslySetInnerHTML={{ 
                  __html: generatePreviewMessage()
                    .replace(/<b>/g, '<strong>')
                    .replace(/<\/b>/g, '</strong>')
                    .replace(/<i>/g, '<em>')
                    .replace(/<\/i>/g, '</em>')
                    .replace(/~~(.+?)~~/g, '<del>$1</del>')
                }}
              />
            </div>

            {isScheduled && scheduledDate && scheduledTime && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Scheduled for: {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString()}
                </p>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex space-x-3">
              <button
                onClick={() => setPreviewMode(false)}
                className="flex-1 bg-gray-600 text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {isScheduled ? 'Scheduling...' : 'Promoting...'}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {isScheduled ? 'Schedule Promotion' : 'Promote Now'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Promote Product</h2>
            <button 
              onClick={onClose} 
              className="text-gray-500 hover:text-gray-700 transition-colors duration-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="text-gray-600 mt-1">Create an engaging promotion for {product.name}</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Product Info */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center space-x-4">
              {product.images && product.images.length > 0 ? (
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="w-16 h-16 object-cover rounded-lg"
                />
              ) : (
                <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <div>
                <h3 className="font-semibold text-gray-900">{product.name}</h3>
                <p className="text-sm text-gray-600">${product.price.toFixed(2)} • {product.stock} in stock</p>
                <p className="text-xs text-gray-500">{product.category}</p>
              </div>
            </div>
          </div>

          {/* Promotion Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Promotion Title *
            </label>
            <input
              type="text"
              value={promotionTitle}
              onChange={(e) => setPromotionTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="🔥 Special Offer: Amazing Product"
            />
          </div>

          {/* Discount */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Discount Percentage (Optional)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={discountPercentage}
                onChange={(e) => setDiscountPercentage(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valid Until (Optional)
              </label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Custom Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Message (Optional)
            </label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Add a custom message to make your promotion more engaging..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to use the product description
            </p>
          </div>

          {/* Promotion Images */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Promotion Images (Optional)
            </label>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors duration-200">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="promotion-image-upload"
                disabled={uploadingImages}
              />
              <label
                htmlFor="promotion-image-upload"
                className="cursor-pointer flex flex-col items-center space-y-2"
              >
                {uploadingImages ? (
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="h-8 w-8 text-gray-400" />
                )}
                <span className="text-sm text-gray-600">
                  {uploadingImages ? 'Uploading images...' : 'Click to upload promotion images'}
                </span>
                <span className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB each</span>
              </label>
            </div>

            {promotionImages.length > 0 && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                {promotionImages.map((imageUrl, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={imageUrl}
                      alt={`Promotion ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">
              If no promotion images are uploaded, the product's main image will be used
            </p>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hashtags
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(index)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTag()}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Add hashtag (e.g., special, offer)"
              />
              <button
                onClick={addTag}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Schedule Options */}
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <input
                type="checkbox"
                id="schedule-promotion"
                checked={isScheduled}
                onChange={(e) => setIsScheduled(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="schedule-promotion" className="text-sm font-medium text-gray-700">
                Schedule promotion for later
              </label>
            </div>

            {isScheduled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Date
                  </label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required={isScheduled}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Time
                  </label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required={isScheduled}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-600 text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => setPreviewMode(true)}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};