// src/services/pdfThemes/classicTheme.ts
import jsPDF from 'jspdf';
import { Product, Category, User } from '../../types';

// Helper to load images
const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    
    // Handle Firebase storage URLs and other image sources
    if (url.startsWith('http')) {
      img.src = url;
    } else {
      // For base64 or data URLs
      img.src = url;
    }
  });
};

// Helper to add image to PDF
const addImageToPDF = async (pdf: jsPDF, imageUrl: string, x: number, y: number, width: number, height: number) => {
  try {
    const img = await loadImage(imageUrl);
    pdf.addImage(img, 'JPEG', x, y, width, height);
    return true;
  } catch (error) {
    console.error('Error adding image to PDF:', error);
    return false;
  }
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
  const itemSpacing = 10;

  // === Background for every page ===
  const addBackground = () => {
    pdf.setFillColor(255, 255, 255); // White background
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  };

  const addPageWithBackground = () => {
    pdf.addPage();
    addBackground();
  };

  // === Header with business logo and info ===
  const addHeader = async (y: number): Promise<number> => {
    const headerY = y;
    let currentY = headerY;
    
    // Add business logo if available
    if (businessInfo.logoUrl) {
      try {
        const logoHeight = 20;
        const logoWidth = logoHeight * 1.5;
        const logoX = pageWidth / 2 - logoWidth / 2;
        
        const imageAdded = await addImageToPDF(pdf, businessInfo.logoUrl, logoX, currentY, logoWidth, logoHeight);
        if (imageAdded) {
          currentY += logoHeight + 5;
        } else {
          // Fallback: show business name as text
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(24);
          pdf.setTextColor(0, 0, 0);
          const businessName = businessInfo.businessName?.toUpperCase() || 'BUSINESS';
          pdf.text(businessName, pageWidth / 2, currentY + 12, { align: 'center' });
          currentY += 20;
        }
      } catch (error) {
        console.error('Error adding logo:', error);
      }
    } else {
      // No logo, show business name
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(24);
      pdf.setTextColor(0, 0, 0);
      const businessName = businessInfo.businessName?.toUpperCase() || 'BUSINESS';
      pdf.text(businessName, pageWidth / 2, currentY + 12, { align: 'center' });
      currentY += 20;
    }
    
    // Add decorative line
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.5);
    pdf.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 5;
    
    // Add contact info
    const contactInfo = [];
    if (businessInfo.phone) contactInfo.push(`📞 ${businessInfo.phone}`);
    if (businessInfo.email) contactInfo.push(`✉️ ${businessInfo.email}`);
    if (businessInfo.address) contactInfo.push(`📍 ${businessInfo.address}`);
    
    if (contactInfo.length > 0) {
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      
      contactInfo.forEach((info, index) => {
        pdf.text(info, pageWidth / 2, currentY + (index * 4), { align: 'center' });
      });
      
      currentY += contactInfo.length * 4 + 5;
    }
    
    // Add title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(0, 0, 0);
    pdf.text('PRODUCT CATALOG', pageWidth / 2, currentY + 8, { align: 'center' });
    
    // Add decorative line under title
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.3);
    pdf.line(margin, currentY + 12, pageWidth - margin, currentY + 12);
    
    return currentY + 20;
  };

  // === Category header ===
  const addCategoryHeader = (x: number, y: number, width: number, categoryName: string): number => {
    // Category background
    pdf.setFillColor(240, 240, 240);
    pdf.rect(x, y, width, 10, 'F');
    
    // Category name
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    
    // Check if text fits, otherwise truncate
    let displayName = categoryName.toUpperCase();
    if (pdf.getTextWidth(displayName) > width - 10) {
      while (pdf.getTextWidth(displayName + '...') > width - 10 && displayName.length > 3) {
        displayName = displayName.slice(0, -1);
      }
      displayName += '...';
    }
    
    pdf.text(displayName, x + width / 2, y + 7, { align: 'center' });
    
    // Border
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.5);
    pdf.rect(x, y, width, 10);
    
    return y + 15;
  };

  // === Product item with image and details ===
  const addProductItem = async (
    x: number, 
    y: number, 
    width: number, 
    product: Product,
    index: number
  ): Promise<number> => {
    const padding = 5;
    const imageSize = 35;
    const contentWidth = width - padding * 2;
    let currentY = y;
    
    // Product border
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.3);
    pdf.rect(x, y, width, imageSize + 35); // Approximate height
    
    // Add background color for alternate rows
    if (index % 2 === 0) {
      pdf.setFillColor(250, 250, 250);
      pdf.rect(x, y, width, imageSize + 35, 'F');
    }
    
    // Product image
    const imageX = x + padding;
    const imageY = currentY + padding;
    
    if (product.images && product.images.length > 0) {
      try {
        const imageAdded = await addImageToPDF(pdf, product.images[0], imageX, imageY, imageSize, imageSize);
        
        if (!imageAdded) {
          // Fallback image placeholder
          pdf.setFillColor(245, 245, 245);
          pdf.rect(imageX, imageY, imageSize, imageSize, 'F');
          pdf.setDrawColor(200, 200, 200);
          pdf.rect(imageX, imageY, imageSize, imageSize);
          
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'italic');
          pdf.setTextColor(150, 150, 150);
          pdf.text('IMAGE', imageX + imageSize / 2, imageY + imageSize / 2, { align: 'center' });
        }
      } catch (error) {
        console.error('Error adding product image:', error);
        // Placeholder
        pdf.setFillColor(245, 245, 245);
        pdf.rect(imageX, imageY, imageSize, imageSize, 'F');
        pdf.setDrawColor(200, 200, 200);
        pdf.rect(imageX, imageY, imageSize, imageSize);
      }
    } else {
      // No image available
      pdf.setFillColor(245, 245, 245);
      pdf.rect(imageX, imageY, imageSize, imageSize, 'F');
      pdf.setDrawColor(200, 200, 200);
      pdf.rect(imageX, imageY, imageSize, imageSize);
      
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(150, 150, 150);
      pdf.text('NO IMAGE', imageX + imageSize / 2, imageY + imageSize / 2, { align: 'center' });
    }
    
    // Product details (right of image)
    const detailsX = imageX + imageSize + 5;
    const detailsWidth = contentWidth - imageSize - 5;
    
    // Product name
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    
    // Handle long product names
    const productName = product.name;
    const maxNameWidth = detailsWidth - 5;
    let displayName = productName;
    
    if (pdf.getTextWidth(displayName) > maxNameWidth) {
      while (pdf.getTextWidth(displayName + '...') > maxNameWidth && displayName.length > 3) {
        displayName = displayName.slice(0, -1);
      }
      displayName += '...';
    }
    
    pdf.text(displayName, detailsX, imageY + 6);
    
    // Product description (if available)
    if (product.description && pdf.getTextWidth(product.description) < maxNameWidth * 2) {
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      
      // Truncate long descriptions
      let desc = product.description;
      if (desc.length > 60) {
        desc = desc.substring(0, 57) + '...';
      }
      
      pdf.text(desc, detailsX, imageY + 15);
      currentY += 5;
    }
    
    // Price - prominent display
    const priceX = detailsX;
    const priceY = imageY + imageSize - 10;
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(0, 100, 0); // Green for price
    
    const priceText = `$${product.price.toFixed(2)}`;
    pdf.text(priceText, priceX, priceY);
    
    // Stock information (if available)
    if (product.stock !== undefined) {
      const stockX = priceX + pdf.getTextWidth(priceText) + 5;
      
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      
      if (product.stock <= (product.lowStockAlert || 5)) {
        pdf.setTextColor(200, 0, 0); // Red for low stock
        pdf.text(`Stock: ${product.stock} (Low)`, stockX, priceY);
      } else if (product.stock > 0) {
        pdf.setTextColor(0, 100, 0); // Green for in stock
        pdf.text(`Stock: ${product.stock}`, stockX, priceY);
      } else {
        pdf.setTextColor(150, 150, 150); // Gray for out of stock
        pdf.text('Out of Stock', stockX, priceY);
      }
    }
    
    // SKU (if available)
    if (product.sku) {
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(100, 100, 100);
      pdf.text(`SKU: ${product.sku}`, detailsX, priceY + 5);
    }
    
    return y + imageSize + 40; // Return next Y position
  };

  // === Footer ===
  const addFooter = (pageNumber: number, totalPages: number) => {
    const footerY = pageHeight - 15;
    
    // Decorative line
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.line(margin, footerY, pageWidth - margin, footerY);
    
    // Page number
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Page ${pageNumber} of ${totalPages}`, pageWidth / 2, footerY + 5, { align: 'center' });
    
    // Contact info
    const contactDetails = [];
    if (businessInfo.phone) contactDetails.push(`Tel: ${businessInfo.phone}`);
    if (businessInfo.email) contactDetails.push(`Email: ${businessInfo.email}`);
    if (businessInfo.website) contactDetails.push(`Web: ${businessInfo.website}`);
    
    if (contactDetails.length > 0) {
      pdf.setFontSize(8);
      contactDetails.forEach((detail, index) => {
        pdf.text(detail, margin, footerY + 5 + (index * 4));
      });
    }
    
    // Copyright
    const year = new Date().getFullYear();
    const businessName = businessInfo.businessName || 'Business';
    pdf.text(`© ${year} ${businessName}. All rights reserved.`, pageWidth - margin, footerY + 5, { align: 'right' });
  };

  // === Start PDF generation ===
  addBackground();
  
  let currentY = await addHeader(margin);
  let currentX = margin;
  let currentColumn = 1;
  let pageNumber = 1;
  
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
    productsByCategory['Other Products'] = uncategorizedProducts.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Calculate total pages (approximate)
  let totalItems = 0;
  Object.values(productsByCategory).forEach(prods => totalItems += prods.length);
  const itemsPerColumn = Math.floor((pageHeight - currentY - 30) / 60);
  const totalPages = Math.ceil(totalItems / (itemsPerColumn * 2)) + 1;

  // Generate catalog content
  for (const [catName, categoryProducts] of Object.entries(productsByCategory)) {
    // Add category header
    if (currentY > pageHeight - 100) {
      if (currentColumn === 1) {
        // Move to second column
        currentX = margin + colWidth + columnGap;
        currentY = margin + 30;
        currentColumn = 2;
      } else {
        // New page
        addFooter(pageNumber, totalPages);
        addPageWithBackground();
        pageNumber++;
        currentX = margin;
        currentY = margin + 30;
        currentColumn = 1;
      }
    }
    
    currentY = addCategoryHeader(currentX, currentY, colWidth, catName);
    
    // Add products in this category
    for (let i = 0; i < categoryProducts.length; i++) {
      const product = categoryProducts[i];
      
      // Check if we need to move to next column or page
      if (currentY > pageHeight - 80) {
        if (currentColumn === 1) {
          // Move to second column
          currentX = margin + colWidth + columnGap;
          currentY = margin + 30;
          currentColumn = 2;
          
          // Add category header again for second column
          currentY = addCategoryHeader(currentX, currentY, colWidth, catName);
        } else {
          // New page
          addFooter(pageNumber, totalPages);
          addPageWithBackground();
          pageNumber++;
          currentX = margin;
          currentY = margin + 30;
          currentColumn = 1;
          
          // Add category header on new page
          currentY = addCategoryHeader(currentX, currentY, colWidth, catName);
        }
      } 
      
      currentY = await addProductItem(currentX, currentY, colWidth, product, i);
    }
    
    // Add spacing between categories
    currentY += itemSpacing;
  }

  // Add final footer
  addFooter(pageNumber, totalPages);

  return pdf;
};