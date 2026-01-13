// src/services/pdfThemes/classicTheme.ts
import jsPDF from 'jspdf';
import { Product, Category, User } from '../../types';

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
    pdf.setFillColor(252, 248, 240); // light beige
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  };

  const addPageWithBackground = () => {
    pdf.addPage();
    addBackground();
  };

  // === Cover Page ===
  const addCoverPage = () => {
    addBackground();

    // Border
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.5);
    pdf.rect(margin, margin, pageWidth - margin * 2, pageHeight - margin * 2);

    // Title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(36);
    pdf.setTextColor(0, 0, 0);
    pdf.text('PRODUCT CATALOG', pageWidth / 2, pageHeight / 2 - 10, { align: 'center' });

    // Business name
    const name = businessInfo.businessName || 'BUSINESS';
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'normal');
    pdf.text(name.toUpperCase(), pageWidth / 2, pageHeight / 2 + 10, { align: 'center' });

    addPageWithBackground();
  };

  // === Category Box ===
  const addCategoryBox = (x: number, y: number, width: number, title: string, items: Product[]): number => {
    const startY = y;

    // Header
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text(title.toUpperCase(), x + 2, y + 5);

    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.3);
    pdf.line(x, y + 7, x + width, y + 7);

    let currentY = y + 12;

    items.forEach((product) => {
      const itemHeight = lineHeight + 3;
      if (currentY + itemHeight > pageHeight - margin) {
        addPageWithBackground();
        currentY = margin + 12;
      }

      const productName = product.name;
      const priceText = `$${product.price.toFixed(2)}`;
      const startX = x + 2;
      const endX = x + width - 2;

      // Product name
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);
      pdf.text(productName, startX, currentY);

      // Dotted leader
      pdf.setFontSize(8);
      let dots = '';
      while (pdf.getTextWidth(dots) < endX - startX - pdf.getTextWidth(productName) - pdf.getTextWidth(priceText) - 4) {
        dots += '.';
      }
      pdf.text(dots, startX + pdf.getTextWidth(productName) + 2, currentY);

      // Price
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text(priceText, endX, currentY, { align: 'right' });

      // Optional: Add stock information if available
      if (product.stock !== undefined) {
        currentY += lineHeight - 2;
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(100, 100, 100);
        const stockText = `Stock: ${product.stock}${product.stock <= (product.lowStockAlert || 5) ? ' (Low Stock)' : ''}`;
        pdf.text(stockText, startX, currentY);
      }

      currentY += lineHeight + 3;
    });

    // Box border
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.5);
    pdf.rect(x, startY, width, currentY - startY + 3);

    return currentY + 8;
  };

  // === Footer ===
  const addFooter = () => {
    const footerY = pageHeight - 10;
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);

    const phone = businessInfo.phone || '+123-456-7890';
    const website = businessInfo.website || 'www.business.com';

    pdf.text(`Contact: ${phone}`, margin, footerY);
    pdf.text(website, pageWidth - margin, footerY, { align: 'right' });
  };

  // === Start PDF generation ===
  addCoverPage();

  let currentX = margin;
  let currentY = margin;

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

  // Generate catalog content
  for (const [catName, categoryProducts] of Object.entries(productsByCategory)) {
    if (currentY > pageHeight - margin - 40) {
      if (currentX === margin) {
        currentX = margin + colWidth + columnGap;
        currentY = margin;
      } else {
        addPageWithBackground();
        currentX = margin;
        currentY = margin;
      }
    }

    currentY = addCategoryBox(currentX, currentY, colWidth, catName, categoryProducts);
  }

  addFooter();

  return pdf;
};