export interface User {
  uid: string;
  email: string;
  displayName?: string;
  telegramId?: number;
  role?: 'shop_admin' | 'customer';
  userType?: 'admin' | 'customer';
  createdAt: Date;
  updatedAt: Date;
}

export interface Shop {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  logo?: string;
  isActive: boolean;
  telegramConfig?: TelegramConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface TelegramConfig {
  botToken: string;
  shopGroupId: string;
  cashierGroupId: string;
  deliveryGroupId: string;
}

export interface Product {
  id: string;
  shopId: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  subcategory?: string;
  images: string[];
  sku?: string;
  isActive: boolean;
  lowStockAlert: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  shopId: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  deliveryMethod: 'pickup' | 'delivery';
  deliveryAddress?: string;
  customerNotes?: string;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  paymentPreference?: string;
  tableNumber?: string;
  telegramId?: string;
  telegramUsername?: string;
  source?: 'web' | 'telegram';
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

export interface TableBill {
  id: string;
  tableNumber: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'active' | 'paid' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export type OrderStatus = 'pending' | 'payment_pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface BusinessInfo {
  name: string;
  logo?: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    tiktok?: string;
    youtube?: string;
    whatsapp?: string;
  };
  features?: string[];
  specialMessage?: string;
}

export interface Customer {
  id: string;
  shopId: string;
  name: string;
  email?: string;
  phone?: string;
  telegramUsername?: string;
  telegramId?: string;
  source: 'web' | 'telegram';
  tags: CustomerTag[];
  totalOrders: number;
  totalSpent: number;
  lastOrderDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CustomerTag = 'VIP' | 'Wholesale' | 'Regular' | 'New';

export interface Department {
  id: string;
  shopId: string;
  name: string;
  type: 'shop' | 'cashier' | 'delivery' | 'admin';
  telegramGroupId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}