export interface User {
  uid: string;
  email: string;
  displayName?: string;
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
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  deliveryMethod: 'pickup' | 'delivery';
  deliveryAddress?: string;
  customerNotes?: string;
  paymentStatus: 'pending' | 'paid' | 'refunded';
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

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface Customer {
  id: string;
  shopId: string;
  name: string;
  email?: string;
  phone?: string;
  telegramUsername?: string;
  telegramId?: string;
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
  type: 'shop' | 'cashier' | 'delivery';
  telegramGroupId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}