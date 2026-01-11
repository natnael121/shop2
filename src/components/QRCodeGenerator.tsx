import React, { useState, useRef } from 'react';
import { X, QrCode, FileImage, FileText } from 'lucide-react';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  iconType?: 'emoji' | 'image';
  iconImage?: string;
}

interface QRCodeGeneratorProps {
  userId: string;
  businessName: string;
  businessLogo?: string; // logo as base64 or URL
  shopName: string;
  categories: Category[];
  onClose: () => void;
}

export const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({
  userId,
  businessName,
  businessLogo,
  shopName,
  categories,
  onClose,
}) => {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [qrCodes, setQrCodes] = useState<{ [key: string]: string }>({});
  const qrContainerRef = useRef<HTMLDivElement>(null);

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories(categories.map(cat => cat.id));
    }
    setSelectAll(!selectAll);
  };

  const generateQRCode = async (category: Category): Promise<string> => {
    const url = `${window.location.origin}/catalog/${shopName}?category=${encodeURIComponent(category.name)}`;
    try {
      const qrDataURL = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
      });
      return qrDataURL;
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw error;
    }
  };

  const generateAllQRCodes = async () => {
    setGenerating(true);
    const codes: { [key: string]: string } = {};
    try {
      for (const categoryId of selectedCategories) {
        const category = categories.find(cat => cat.id === categoryId);
        if (category) {
          codes[categoryId] = await generateQRCode(category);
        }
      }
      setQrCodes(codes);
    } catch (error) {
      console.error('Error generating QR codes:', error);
      alert('Failed to generate QR codes');
    } finally {
      setGenerating(false);
    }
  };

  const downloadSingleQR = async (categoryId: string, format: 'png' | 'pdf') => {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return;

    const qrDataURL = qrCodes[categoryId] || await generateQRCode(category);
    
    if (format === 'png') {
      const link = document.createElement('a');
      link.download = `${shopName}-${category.name.toLowerCase().replace(/\s+/g, '-')}-qr.png`;
      link.href = qrDataURL;
      link.click();
    } else {
      // PDF download for single category
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a6'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Branding section at top
      pdf.setFillColor(255, 204, 0);
      pdf.roundedRect(10, 10, pageWidth - 20, 30, 5, 5, 'F');

      // Business logo
      if (businessLogo) {
        pdf.addImage(
          businessLogo,
          'PNG',
          pageWidth / 2 - 15,
          15,
          30,
          30
        );
      }

      // Business name
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text(businessName.toUpperCase(), pageWidth / 2, 55, { align: 'center' });

      // Category section
      const categoryColor = category.color || '#3B82F6';
      pdf.setFillColor(categoryColor);
      pdf.roundedRect(15, 70, pageWidth - 30, 20, 5, 5, 'F');

      // Category icon
      if (category.iconType === 'image' && category.iconImage) {
        pdf.addImage(
          category.iconImage,
          'PNG',
          20,
          72,
          16,
          16
        );
      } else {
        // Emoji icon (PDF doesn't support emojis well, so we use text)
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(12);
        pdf.text(category.icon || '📦', 28, 83);
      }

      // Category name
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(category.name.toUpperCase(), 50, 83);

      // QR Code
      const qrSize = 60;
      const qrX = (pageWidth - qrSize) / 2;
      const qrY = 100;

      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(qrX - 5, qrY - 5, qrSize + 10, qrSize + 10, 4, 4, 'FD');
      pdf.addImage(qrDataURL, 'PNG', qrX, qrY, qrSize, qrSize);

      // Instruction text
      pdf.setTextColor(107, 114, 128);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Scan to view category menu', pageWidth / 2, qrY + qrSize + 15, { align: 'center' });

      pdf.save(`${shopName}-${category.name.toLowerCase().replace(/\s+/g, '-')}-qr.pdf`);
    }
  };

  const downloadAllQRCodes = async (format: 'png' | 'pdf') => {
    if (selectedCategories.length === 0) return;
    setGenerating(true);

    try {
      if (format === 'png') {
        for (const categoryId of selectedCategories) {
          await downloadSingleQR(categoryId, 'png');
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } else {
        // A4 landscape for multiple categories
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a4'
        });

        const pageWidth = pdf.internal.pageSize.getWidth();   // 297mm
        const pageHeight = pdf.internal.pageSize.getHeight(); // 210mm

        const cols = 2;
        const rows = 2;
        const slotWidth = pageWidth / cols;
        const slotHeight = pageHeight / rows;

        let categoriesToPrint = selectedCategories.map(id => categories.find(cat => cat.id === id)).filter(Boolean) as Category[];
        
        // Repeat categories if less than 4
        while (categoriesToPrint.length < 4) {
          categoriesToPrint = categoriesToPrint.concat(categoriesToPrint);
        }
        categoriesToPrint = categoriesToPrint.slice(0, Math.ceil(selectedCategories.length / 4) * 4);

        for (let i = 0; i < categoriesToPrint.length; i++) {
          if (i > 0 && i % (cols * rows) === 0) {
            pdf.addPage();
          }

          const pageIndex = i % (cols * rows);
          const col = pageIndex % cols;
          const row = Math.floor(pageIndex / cols);

          const x = col * slotWidth;
          const y = row * slotHeight;

          const category = categoriesToPrint[i];
          const qrDataURL = qrCodes[category.id] || await generateQRCode(category);

          // Card background
          pdf.setFillColor(255, 255, 255);
          pdf.roundedRect(x + 5, y + 5, slotWidth - 10, slotHeight - 10, 5, 5, 'F');

          // Category header with color
          const categoryColor = category.color || '#3B82F6';
          pdf.setFillColor(categoryColor);
          pdf.roundedRect(x + 10, y + 10, slotWidth - 20, 25, 3, 3, 'F');

          // Category icon
          if (category.iconType === 'image' && category.iconImage) {
            pdf.addImage(
              category.iconImage,
              'PNG',
              x + 15,
              y + 12,
              20,
              20
            );
          } else {
            // Emoji icon
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(14);
            pdf.text(category.icon || '📦', x + 25, y + 25);
          }

          // Category name
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'bold');
          pdf.text(category.name.toUpperCase(), x + 40, y + 25);

          // QR code
          const qrSize = 50;
          const qrX = x + (slotWidth - qrSize) / 2;
          const qrY = y + 50;

          pdf.setFillColor(255, 255, 255);
          pdf.roundedRect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6, 3, 3, 'FD');
          pdf.addImage(qrDataURL, 'PNG', qrX, qrY, qrSize, qrSize);

          // Business name
          pdf.setTextColor(107, 114, 128);
          pdf.setFontSize(8);
          pdf.text(businessName, x + slotWidth / 2, y + slotHeight - 15, { align: 'center' });
        }

        pdf.save(`${shopName.toLowerCase().replace(/\s+/g, '-')}-category-qr-codes.pdf`);
      }
    } catch (error) {
      console.error('Error downloading QR codes:', error);
      alert('Failed to download QR codes');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <QrCode className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">
                Category QR Code Generator
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="text-gray-600 mt-2">
            Generate QR codes for your menu categories
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Category Selection */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Select Categories
              </h3>
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Select All</span>
                </label>
                <span className="text-sm text-gray-500">
                  {selectedCategories.length} of {categories.length} selected
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => handleCategorySelect(category.id)}
                  className={`p-4 rounded-lg border-2 transition-colors flex items-center space-x-4 ${
                    selectedCategories.includes(category.id)
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: category.color + '20' }}
                  >
                    {category.iconType === 'image' && category.iconImage ? (
                      <img
                        src={category.iconImage}
                        alt={category.name}
                        className="w-8 h-8 object-cover"
                      />
                    ) : (
                      <span className="text-2xl">{category.icon || '📦'}</span>
                    )}
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-semibold text-lg">{category.name}</div>
                    {category.color && (
                      <div className="text-sm text-gray-500">
                        Color: <span className="font-medium" style={{ color: category.color }}>
                          {category.color}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t">
            <button
              onClick={generateAllQRCodes}
              disabled={selectedCategories.length === 0 || generating}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <QrCode className="w-4 h-4" />
              <span>{generating ? 'Generating...' : 'Generate QR Codes'}</span>
            </button>

            <div className="flex space-x-3">
              <button
                onClick={() => downloadAllQRCodes('png')}
                disabled={Object.keys(qrCodes).length === 0 || generating}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <FileImage className="w-4 h-4" />
                <span>Download PNG</span>
              </button>
              <button
                onClick={() => downloadAllQRCodes('pdf')}
                disabled={Object.keys(qrCodes).length === 0 || generating}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <FileText className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
            </div>
          </div>

          {/* Generated QR Codes Preview */}
          {Object.keys(qrCodes).length > 0 && (
            <div className="pt-6 border-t">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Generated QR Codes
              </h3>
              <div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                ref={qrContainerRef}
              >
                {Object.entries(qrCodes).map(([categoryId, qrDataURL]) => {
                  const category = categories.find(cat => cat.id === categoryId);
                  if (!category) return null;

                  const url = `${window.location.origin}/catalog/${shopName}?category=${encodeURIComponent(category.name)}`;
                  
                  return (
                    <div
                      key={categoryId}
                      className="bg-gray-50 p-4 rounded-lg text-center"
                    >
                      <div className="flex items-center justify-center space-x-2 mb-3">
                        <div 
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: category.color + '20' }}
                        >
                          {category.iconType === 'image' && category.iconImage ? (
                            <img
                              src={category.iconImage}
                              alt={category.name}
                              className="w-6 h-6 object-cover"
                            />
                          ) : (
                            <span className="text-xl">{category.icon || '📦'}</span>
                          )}
                        </div>
                        <h4 className="font-semibold text-gray-900">
                          {category.name}
                        </h4>
                      </div>
                      <img
                        src={qrDataURL}
                        alt={`QR Code for ${category.name}`}
                        className="w-32 h-32 mx-auto mb-3 border rounded"
                      />
                      <p className="text-xs text-gray-500 mt-2 break-all">
                        {url}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};