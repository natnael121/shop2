// src/services/pdfThemes/classicTheme.ts
import jsPDF from 'jspdf';
import { Product, Category, User } from '../../types';

// Helper to check if image URL is accessible
const isImageAccessible = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
    return true;
  } catch {
    return false;
  }
};

// Helper to get image data URL
const getImageDataURL = async (url: string): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataURL = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataURL);
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    };
    
    img.onerror = () => resolve(null);
    
    // Set timeout to prevent hanging
    setTimeout(() => resolve(null), 3000);
    
    img.src = url;
  });
};

export const generateClassicDesignPDF = async (
  businessInfo: User,
  products: Product[],
  categories: Category[]
): Promise<jsPDF> => {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const margin = 15;
  const columnGap = 10;
  const colWidth = (pageWidth - margin * 2 - columnGap) / 2;
  const lineHeight = 6;

  // === Background ===
  const addBackground = () => {
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  };

  const addPageWithBackground = () => {
    pdf.addPage();
    addBackground();
  };

  // === Header ===
  const addHeader = async (y: number): Promise<number> => {
    let currentY = y;
    
    // Business name
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(24);
    pdf.setTextColor(30, 64, 175);
    const businessName = businessInfo.businessName || 'PRODUCT CATALOG';
    pdf.text(businessName, pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;
    
    // Title
    pdf.setFontSize(18);
    pdf.setTextColor(50, 50, 50);
    pdf.text('Product Catalog', pageWidth / 2, currentY, { align: 'center' });
    currentY += 15;
    
    // Divider
    pdf.setDrawColor(30, 64, 175);
    pdf.setLineWidth(1);
    pdf.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 20;
    
    // Try to add business logo
    if (businessInfo.logoUrl) {
      try {
        const logoDataURL = await getImageDataURL(businessInfo.logoUrl);
        if (logoDataURL) {
          const logoSize = 25;
          const logoX = pageWidth / 2 - logoSize / 2;
          pdf.addImage(logoDataURL, 'JPEG', logoX, currentY, logoSize, logoSize);
          currentY += logoSize + 10;
        } 
      } catch (error) {
        console.log('Could not load business logo:', error);
      }
    }
    
    return currentY;
  };
 
  // === Category header ===
  const addCategoryHeader = (x: number, y: number, width: number, categoryName: string): number => {
    const colors = [
      [30, 64, 175],   // Blue
      [220, 38, 38],   // Red
      [22, 101, 52],   // Green
      [194, 65, 12],   // Orange
      [109, 40, 217],  // Purple
    ];
    
    const color = colors[categoryName.length % colors.length];
    
    // Category background
    pdf.setFillColor(color[0], color[1], color[2]);
    pdf.rect(x, y, width, 10, 'F');
    
    // Category name
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(255, 255, 255);
    
    let displayName = categoryName.toUpperCase();
    if (pdf.getTextWidth(displayName) > width - 10) {
      displayName = displayName.substring(0, 15) + '...';
    }
    
    pdf.text(displayName, x + width / 2, y + 7, { align: 'center' });
    
    return y + 15;
  };

  // === Product item with image ===
  const addProductItem = async (
    x: number, 
    y: number, 
    width: number, 
    product: Product,
    index: number
  ): Promise<number> => {
    const padding = 5;
    const imageSize = 40;
    let currentY = y;
    
    // Background for product card
    if (index % 2 === 0) {
      pdf.setFillColor(250, 250, 250);
      pdf.rect(x, y, width, 50, 'F');
    }
    
    // Border
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.3);
    pdf.rect(x, y, width, 50);
    
    // Try to add product image
    const imageX = x + padding;
    const imageY = y + padding;
    let imageAdded = false;
    
    if (product.images && product.images.length > 0) {
      try {
        const imageUrl = product.images[0];
        const imageDataURL = await getImageDataURL(imageUrl);
        
        if (imageDataURL) {
          // Add circular background for image
          pdf.setFillColor(245, 245, 245);
          pdf.circle(imageX + imageSize/2, imageY + imageSize/2, imageSize/2, 'F');
          
          // Add image
          pdf.addImage(imageDataURL, 'JPEG', imageX, imageY, imageSize, imageSize);
          imageAdded = true;
        }
      } catch (error) {
        console.log('Could not load product image:', error);
      }
    }
    
    // If no image was added, show placeholder
    if (!imageAdded) {
      pdf.setFillColor(245, 245, 245);
      pdf.circle(imageX + imageSize/2, imageY + imageSize/2, imageSize/2, 'F');
      
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.5);
      pdf.circle(imageX + imageSize/2, imageY + imageSize/2, imageSize/2);
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(150, 150, 150);
      pdf.text('📦', imageX + imageSize/2, imageY + imageSize/2 + 2, { align: 'center' });
    }
    
    // Product details
    const detailsX = imageX + imageSize + 8;
    const detailsWidth = width - (imageSize + padding * 2 + 8);
    
    // Product name
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(30, 30, 30);
    
    let productName = product.name;
    const maxNameWidth = detailsWidth - 15;
    
    if (pdf.getTextWidth(productName) > maxNameWidth) {
      while (pdf.getTextWidth(productName + '...') > maxNameWidth && productName.length > 3) {
        productName = productName.slice(0, -1);
      }
      productName += '...';
    }
    
    pdf.text(productName, detailsX, y + 10);
    
    // Description (if available)
    if (product.description) {
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      
      let desc = product.description;
      if (desc.length > 60) {
        desc = desc.substring(0, 57) + '...';
      }
      
      pdf.text(desc, detailsX, y + 18);
    }
    
    // Price
    const priceText = `$${product.price.toFixed(2)}`;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(0, 100, 0);
    pdf.text(priceText, detailsX, y + 35);
    
    // Stock info
    if (product.stock !== undefined) {
      const stockX = detailsX + pdf.getTextWidth(priceText) + 5;
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      
      if (product.stock <= (product.lowStockAlert || 5)) {
        pdf.setTextColor(200, 0, 0);
        pdf.text(`Stock: ${product.stock} (Low)`, stockX, y + 35);
      } else {
        pdf.setTextColor(100, 100, 100);
        pdf.text(`Stock: ${product.stock}`, stockX, y + 35);
      }
    }
    
    return y + 55;
  };

  // === Footer ===
  const addFooter = (pageNumber: number) => {
    const footerY = pageHeight - 15;
    
    // Divider
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.5);
    pdf.line(margin, footerY, pageWidth - margin, footerY);
    
    // Page number
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Page ${pageNumber}`, pageWidth / 2, footerY + 5, { align: 'center' });
    
    // Contact info
    if (businessInfo.phone || businessInfo.email) {
      const contactInfo = [];
      if (businessInfo.phone) contactInfo.push(`📞 ${businessInfo.phone}`);
      if (businessInfo.email) contactInfo.push(`✉️ ${businessInfo.email}`);
      
      pdf.text(contactInfo.join(' • '), margin, footerY + 5);
    }
    
    // Date
    const date = new Date().toLocaleDateString();
    pdf.text(`Generated: ${date}`, pageWidth - margin, footerY + 5, { align: 'right' });
  };

  try {
    // Start PDF generation
    addBackground();
    
    let currentY = await addHeader(margin);
    let currentX = margin;
    let currentColumn = 1;
    let pageNumber = 1;
    let productIndex = 0;
    
    // Group products by category
    const productsByCategory = categories.reduce((acc, category) => {
      const categoryProducts = products.filter(
        (product) => product.category === category.name
      );
      if (categoryProducts.length > 0) {
        acc[category.name] = categoryProducts.sort((a, b) => a.name.localeCompare(b.name));
      }
      return acc;
    }, {} as Record<string, Product[]>);

    // Add uncategorized products
    const uncategorizedProducts = products.filter(
      (product) => !categories.some((cat) => cat.name === product.category)
    );
    if (uncategorizedProducts.length > 0) {
      productsByCategory['Featured Products'] = uncategorizedProducts.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Generate catalog content
    for (const [catName, categoryProducts] of Object.entries(productsByCategory)) {
      // Check space
      if (currentY > pageHeight - 100) {
        if (currentColumn === 1) {
          // Move to second column
          currentX = margin + colWidth + columnGap;
          currentY = margin + 50;
          currentColumn = 2;
        } else {
          // New page
          addFooter(pageNumber);
          addPageWithBackground();
          pageNumber++;
          currentX = margin;
          currentY = margin + 50;
          currentColumn = 1;
        }
      }
      
      currentY = addCategoryHeader(currentX, currentY, colWidth, catName);
      
      // Add products in category
      for (const product of categoryProducts) {
        // Check space
        if (currentY > pageHeight - 70) {
          if (currentColumn === 1) {
            // Move to second column
            currentX = margin + colWidth + columnGap;
            currentY = margin + 50;
            currentColumn = 2;
            
            // Add category header again
            currentY = addCategoryHeader(currentX, currentY, colWidth, catName);
          } else {
            // New page
            addFooter(pageNumber);
            addPageWithBackground();
            pageNumber++;
            currentX = margin;
            currentY = margin + 50;
            currentColumn = 1;
            
            // Add category header on new page
            currentY = addCategoryHeader(currentX, currentY, colWidth, catName);
          }
        }
        
        currentY = await addProductItem(currentX, currentY, colWidth, product, productIndex);
        productIndex++;
        currentY += 5; // Spacing
      }
      
      currentY += 10; // Extra space between categories
    }

    // Add final footer
    addFooter(pageNumber);
    
    return pdf;
    
  } catch (error) {
    console.error('PDF Generation Error:', error);
    
    // Fallback: Create simple text-only PDF
    const fallbackPdf = new jsPDF();
    
    fallbackPdf.setFontSize(16);
    fallbackPdf.text('Product Catalog', 105, 20, { align: 'center' });
    
    fallbackPdf.setFontSize(12);
    const businessName = businessInfo.businessName || 'Business';
    fallbackPdf.text(businessName, 105, 30, { align: 'center' });
    
    fallbackPdf.setFontSize(10);
    fallbackPdf.text('--- Product List ---', 20, 50);
    
    let y = 60;
    products.forEach((product, index) => {
      if (y > 280) {
        fallbackPdf.addPage();
        y = 20;
      }
      
      fallbackPdf.text(`${index + 1}. ${product.name} - $${product.price.toFixed(2)}`, 20, y);
      y += 7;
      
      if (product.description) {
        fallbackPdf.setFontSize(8);
        fallbackPdf.text(`   ${product.description.substring(0, 80)}${product.description.length > 80 ? '...' : ''}`, 25, y);
        y += 5;
        fallbackPdf.setFontSize(10);
      }
      
      if (product.stock !== undefined) {  
        fallbackPdf.setFontSize(8);
        fallbackPdf.text(`   Stock: ${product.stock}`, 25, y);
        y += 4;
        fallbackPdf.setFontSize(10);
      }
      
      y += 5;
    });
    
    fallbackPdf.text(`Total Products: ${products.length}`, 20, 280);
    fallbackPdf.text(`Generated: ${new Date().toLocaleDateString()}`, 180, 280, { align: 'right' });
    
    return fallbackPdf;
  }
};
