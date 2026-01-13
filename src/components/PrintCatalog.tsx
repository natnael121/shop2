// src/components/PrintCatalog.tsx
import React from 'react';
import { TableTentPDFGenerator } from './TableTentPDFGenerator';
import { Product, Category, User } from '../types';

interface PrintCatalogProps {
  userId: string;
  businessInfo: User;
  products: Product[];
  categories: Category[];
  onClose: () => void;
}

export const PrintCatalog: React.FC<PrintCatalogProps> = (props) => {
  return <TableTentPDFGenerator {...props} />;
};