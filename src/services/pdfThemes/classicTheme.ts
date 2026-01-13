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

  // === Background for every page ===
  const addBackground = () => {
    pdf.setFillColor(255, 255, 255); // White background
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  };

  const addPageWithBackground = () => {
    pdf.addPage();
    addBackground();
  };

  // === Header with business info ===
  const addHeader = (y: number) => {
    const headerY = y;
    
    // Business name as logo
    const businessName = businessInfo.businessName?.toUpperCase() || 'FURNITURE';
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(28);
    pdf.setTextColor(0, 0, 0);
    pdf.text(businessName, pageWidth / 2, headerY + 12, { align: 'center' });
    
    // Add decorative line
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.3);
    pdf.line(margin, headerY + 18, pageWidth - margin, headerY + 18);
    
    // Add contact info on next line
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    const contactInfo = [
      businessInfo.phone || '+123-456-7890',
      businessInfo.city || 'City',
      businessInfo.country || 'Country'
    ].filter(Boolean).join(' • ');
    
    pdf.text(contactInfo, pageWidth / 2, headerY + 25, { align: 'center' });
    
    return headerY + 30;
  };

  // === Category header with background ===
  const addCategoryHeader = (x: number, y: number, width: number, categoryName: string): number => {
    // Background for category header
    pdf.setFillColor(240, 240, 240);
    pdf.rect(x, y, width, 12, 'F');
    
    // Border
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.5);
    pdf.rect(x, y, width, 12);
    
    // Category name
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    pdf.text(categoryName.toUpperCase(), x + width / 2, y + 8, { align: 'center' });
    
    return y + 15;
  };

  // === Product item with image ===
  const addProductItem = async (
    x: number, 
    y: number, 
    width: number, 
    product: Product
  ): Promise<number> => {
    let currentY = y;
    const padding = 2;
    const imageHeight = 30;
    const imageWidth = imageHeight * 0.8;
    
    // Try to load and add product image
    if (product.images && product.images.length > 0) {
      try {
        const img = await loadImage(product.images[0]);
        const aspectRatio = img.width / img.height;
        const imgWidth = Math.min(imageWidth, width - padding * 2);
        const imgHeight = imgWidth / aspectRatio;
        
        // Add image placeholder with border
        pdf.setFillColor(245, 245, 245);
        pdf.rect(x + padding, currentY, imgWidth, imgHeight, 'F');
        pdf.setDrawColor(220, 220, 220);
        pdf.rect(x + padding, currentY, imgWidth, imgHeight);
        
        // Add image text if we can't embed
        pdf.setFontSize(8);
        pdf.setTextColor(180, 180, 180);
        pdf.text('PRODUCT IMAGE', x + padding + imgWidth / 2, currentY + imgHeight / 2, { align: 'center' });
        
        currentY += imgHeight + 4;
      } catch (error) {
        console.error('Error loading image:', error);
        // Fallback: show placeholder
        pdf.setFillColor(245, 245, 245);
        pdf.rect(x + padding, currentY, imageWidth, imageHeight, 'F');
        pdf.setDrawColor(220, 220, 220);
        pdf.rect(x + padding, currentY, imageWidth, imageHeight);
        
        pdf.setFontSize(8);
        pdf.setTextColor(180, 180, 180);
        pdf.text('IMAGE', x + padding + imageWidth / 2, currentY + imageHeight / 2, { align: 'center' });
        
        currentY += imageHeight + 4;
      }
    } else {
      // No image available
      pdf.setFillColor(245, 245, 245);
      pdf.rect(x + padding, currentY, imageWidth, imageHeight, 'F');
      pdf.setDrawColor(220, 220, 220);
      pdf.rect(x + padding, currentY, imageWidth, imageHeight);
      
      pdf.setFontSize(8);
      pdf.setTextColor(180, 180, 180);
      pdf.text('NO IMAGE', x + padding + imageWidth / 2, currentY + imageHeight / 2, { align: 'center' });
      
      currentY += imageHeight + 4;
    }
    
    // Product name
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    
    // Split long product names
    const maxNameWidth = width - padding * 2;
    const productName = product.name;
    let nameLines: string[] = [];
    let currentLine = '';
    
    for (const word of productName.split(' ')) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      if (pdf.getTextWidth(testLine) <= maxNameWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) nameLines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) nameLines.push(currentLine);
    
    // If name is still too long, truncate
    if (nameLines.length > 2) {
      nameLines = [nameLines[0], nameLines[1] + '...'];
    }
    
    nameLines.forEach((line, index) => {
      pdf.text(line, x + padding, currentY + (index * 4));
    });
    
    currentY += (nameLines.length * 4) + 2;
    
    // Price - prominent display
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);
    const priceText = `$${product.price.toFixed(2)}`;
    pdf.text(priceText, x + padding, currentY);
    
    currentY += 5;
    
    // Optional: SKU or stock info
    if (product.sku) {
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(100, 100, 100);
      pdf.text(`SKU: ${product.sku}`, x + padding, currentY);
      currentY += 4;
    }
    
    if (product.stock !== undefined) {
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      const stockColor = product.stock <= (product.lowStockAlert || 5) ? [200, 0, 0] : [0, 100, 0];
      pdf.setTextColor(stockColor[0], stockColor[1], stockColor[2]);
      pdf.text(`Stock: ${product.stock}`, x + padding, currentY);
      currentY += 4;
    }
    
    // Add border around product box
    pdf.setDrawColor(220, 220, 220);
    pdf.rect(x, y, width, currentY - y + 2);
    
    return currentY + 8;
  };

  // === Footer with contact and social ===
  const addFooter = (pageNumber: number, totalPages: number) => {
    const footerY = pageHeight - 15;
    
    // Decorative line
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.2);
    pdf.line(margin, footerY, pageWidth - margin, footerY);
    
    // Contact info
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);
    
    const contactDetails = [
      businessInfo.address || '123 Business St',
      businessInfo.city || 'City',
      businessInfo.state || 'State',
      businessInfo.zipCode || '12345'
    ].filter(Boolean).join(', ');
    
    const contactInfo = [
      businessInfo.phone || '+123-456-7890',
      businessInfo.email || 'info@business.com',
      businessInfo.website || 'www.business.com'
    ].filter(Boolean).join(' • ');
    
    pdf.text(contactDetails, margin, footerY + 5);
    pdf.text(contactInfo, pageWidth - margin, footerY + 5, { align: 'right' });
    
    // Page number
    pdf.text(`Page ${pageNumber} of ${totalPages}`, pageWidth / 2, footerY + 5, { align: 'center' });
    
    // Copyright
    pdf.setFontSize(7);
    pdf.text(`© ${new Date().getFullYear()} ${businessInfo.businessName || 'Business'}. All rights reserved.`, 
      pageWidth / 2, footerY + 10, { align: 'center' });
  };

  // === Start PDF generation ===
  addBackground();
  
  let currentY = addHeader(margin);
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

  // Calculate total pages
  let totalProducts = 0;
  Object.values(productsByCategory).forEach(prods => totalProducts += prods.length);
  const estimatedItemsPerPage = Math.floor((pageHeight - currentY - 30) / 60) * 2;
  const totalPages = Math.ceil(totalProducts / estimatedItemsPerPage) + 1; // +1 for cover

  // Generate catalog content
  for (const [catName, categoryProducts] of Object.entries(productsByCategory)) {
    // Add category header
    if (currentY > pageHeight - 100) {
      addFooter(pageNumber, totalPages);
      addPageWithBackground();
      pageNumber++;
      currentY = margin + 30;
      currentX = margin;
      currentColumn = 1;
    }
    
    currentY = addCategoryHeader(currentX, currentY, colWidth, catName);
    
    // Add products in this category
    for (const product of categoryProducts) {
      if (currentY > pageHeight - 100) {
        if (currentColumn === 1) {
          // Move to second column
          currentX = margin + colWidth + columnGap;
          currentY = margin + 30;
          currentColumn = 2;
          
          // Add category header for second column
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
      
      currentY = await addProductItem(currentX, currentY, colWidth, product);
    }
    
    // Reset for next category
    currentX = margin;
    currentColumn = 1;
    currentY += 10; // Extra space between categories
  }

  // Add final footer
  addFooter(pageNumber, totalPages);

  return pdf;
};