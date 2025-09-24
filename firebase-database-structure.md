# Firebase Database Structure

This document outlines the complete Firestore database structure for the Multi-Shop Management Platform with Telegram Integration.

## Collections Overview

```
firestore/
├── users/                    # User accounts and settings
├── shops/                    # Shop information and configuration
├── products/                 # Product catalog
├── categories/               # Product categories
├── orders/                   # Customer orders
├── customers/                # Customer information (auto-generated from orders)
├── departments/              # Telegram department configuration
├── bills/                    # Table bills for restaurant mode
├── notifications/            # System notifications
├── analytics/                # Analytics and reporting data
└── settings/                 # Global application settings
```

## Detailed Collection Schemas

### 1. users/ Collection

**Document ID**: Firebase Auth UID

```typescript
interface User {
  uid: string;                          // Firebase Auth UID
  email: string;                        // User email
  displayName?: string;                 // User display name
  phone?: string;                       // Phone number
  bio?: string;                         // User bio
  role: 'shop_owner' | 'admin';        // User role
  
  // Settings
  settings: {
    notifications: {
      email: boolean;                   // Email notifications enabled
      push: boolean;                    // Push notifications enabled
      telegram: boolean;                // Telegram notifications enabled
    };
    theme: 'light' | 'dark' | 'auto';   // UI theme preference
    language: string;                   // Language preference (en, am, etc.)
    timezone: string;                   // User timezone
  };
  
  // Telegram Integration
  telegramBotToken?: string;            // Bot token for Telegram integration
  
  // Business Information (for About Us page)
  businessInfo?: {
    name: string;                       // Business name
    logo?: string;                      // Business logo URL
    description?: string;               // Business description
    address?: string;                   // Business address
    phone?: string;                     // Business phone
    email?: string;                     // Business email
    website?: string;                   // Business website
    socialMedia?: {
      facebook?: string;
      instagram?: string;
      twitter?: string;
      tiktok?: string;
      youtube?: string;
      whatsapp?: string;
    };
    operatingHours?: {
      monday?: string;
      tuesday?: string;
      wednesday?: string;
      thursday?: string;
      friday?: string;
      saturday?: string;
      sunday?: string;
    };
    features?: string[];                // Business features array
    specialMessage?: string;            // Special message for customers
  };
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 2. shops/ Collection

**Document ID**: Auto-generated

```typescript
interface Shop {
  id: string;                           // Auto-generated document ID
  ownerId: string;                      // Reference to users collection
  name: string;                         // Shop name
  slug: string;                         // URL-friendly shop name
  description: string;                  // Shop description
  logo?: string;                        // Shop logo URL
  isActive: boolean;                    // Shop active status
  
  // Business Information (shop-specific)
  businessInfo?: {
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
    operatingHours?: {
      monday?: string;
      tuesday?: string;
      wednesday?: string;
      thursday?: string;
      friday?: string;
      saturday?: string;
      sunday?: string;
    };
    features?: string[];
    specialMessage?: string;
  };
  
  // Shop Settings
  settings?: {
    currency: string;                   // Default: 'USD'
    taxRate: number;                    // Tax rate percentage
    businessHours: {
      open: string;                     // Opening time (HH:mm)
      close: string;                    // Closing time (HH:mm)
      days: string[];                   // Operating days
    };
    orderSettings: {
      autoConfirm: boolean;             // Auto-confirm orders
      requirePayment: boolean;          // Require payment before processing
      allowCancellation: boolean;       // Allow order cancellation
    };
  };
  
  // Statistics (updated by cloud functions)
  stats?: {
    totalProducts: number;
    totalOrders: number;
    totalRevenue: number;
    totalCustomers: number;
  };
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 3. products/ Collection

**Document ID**: Auto-generated

```typescript
interface Product {
  id: string;                           // Auto-generated document ID
  shopId: string;                       // Reference to shops collection
  name: string;                         // Product name
  description: string;                  // Product description
  price: number;                        // Product price
  stock: number;                        // Available stock
  category: string;                     // Product category
  subcategory?: string;                 // Product subcategory
  images: string[];                     // Array of image URLs
  sku?: string;                         // Stock Keeping Unit
  isActive: boolean;                    // Product active status
  lowStockAlert: number;                // Low stock threshold
  
  // SEO and Marketing
  tags?: string[];                      // Product tags for search
  featured?: boolean;                   // Featured product flag
  
  // Inventory Management
  costPrice?: number;                   // Cost price for profit calculation
  weight?: number;                      // Product weight
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 4. categories/ Collection

**Document ID**: Auto-generated

```typescript
interface Category {
  id: string;                           // Auto-generated document ID
  userId: string;                       // Reference to users collection
  shopId?: string;                      // Reference to shops collection (optional for global categories)
  name: string;                         // Category name
  description?: string;                 // Category description
  color: string;                        // Category color (hex)
  icon: string;                         // Category icon (emoji or icon name)
  order: number;                        // Display order
  isActive: boolean;                    // Category active status
  
  // Statistics
  productCount?: number;                // Number of products in category
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 5. orders/ Collection

**Document ID**: Auto-generated

```typescript
interface Order {
  id: string;                           // Auto-generated document ID
  shopId: string;                       // Reference to shops collection
  customerId: string;                   // Customer identifier
  customerName: string;                 // Customer name
  customerPhone?: string;               // Customer phone
  customerEmail?: string;               // Customer email
  
  // Order Items
  items: OrderItem[];                   // Array of ordered items
  
  // Pricing
  subtotal: number;                     // Subtotal amount
  tax: number;                          // Tax amount
  total: number;                        // Total amount
  
  // Order Status
  status: 'pending' | 'payment_pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'confirmation_required';
  
  // Delivery Information
  deliveryMethod: 'pickup' | 'delivery';
  deliveryAddress?: string;             // Delivery address
  deliveryFee?: number;                 // Delivery fee
  estimatedDeliveryTime?: Timestamp;    // Estimated delivery time
  
  // Payment Information
  paymentPreference?: string;           // Payment method preference
  paymentPhotoUrl?: string;             // Payment proof photo URL
  requiresPaymentConfirmation?: boolean; // Requires payment confirmation
  
  // Customer Notes
  customerNotes?: string;               // Special instructions
  
  // Source Tracking
  source: 'web' | 'telegram';          // Order source
  tableNumber?: string;                 // Table number for restaurant orders
  
  // Telegram Integration
  telegramId?: string;                  // Telegram user ID
  telegramUsername?: string;            // Telegram username
  
  // Order Tracking
  trackingNumber?: string;              // Shipping tracking number
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  confirmedAt?: Timestamp;              // Order confirmation time
  shippedAt?: Timestamp;                // Order shipped time
  deliveredAt?: Timestamp;              // Order delivered time
}

interface OrderItem {
  productId: string;                    // Reference to products collection
  productName: string;                  // Product name (snapshot)
  quantity: number;                     // Quantity ordered
  price: number;                        // Unit price (snapshot)
  total: number;                        // Total price for this item
  productImage?: string;                // Product image URL (snapshot)
  productSku?: string;                  // Product SKU (snapshot)
}
```

### 6. customers/ Collection

**Document ID**: Auto-generated (based on customer identifier)

```typescript
interface Customer {
  id: string;                           // Customer identifier
  shopId: string;                       // Reference to shops collection
  name: string;                         // Customer name
  email?: string;                       // Customer email
  phone?: string;                       // Customer phone
  
  // Telegram Information
  telegramId?: string;                  // Telegram user ID
  telegramUsername?: string;            // Telegram username
  
  // Customer Classification
  source: 'web' | 'telegram';          // Customer source
  tags: CustomerTag[];                  // Customer tags
  
  // Statistics
  totalOrders: number;                  // Total number of orders
  totalSpent: number;                   // Total amount spent
  averageOrderValue: number;            // Average order value
  lastOrderDate?: Timestamp;            // Last order date
  
  // Preferences
  preferredDeliveryMethod?: 'pickup' | 'delivery';
  preferredPaymentMethod?: string;
  deliveryAddresses?: string[];         // Saved delivery addresses
  
  // Loyalty Program
  loyaltyPoints?: number;               // Loyalty points earned
  loyaltyTier?: 'bronze' | 'silver' | 'gold' | 'platinum';
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type CustomerTag = 'VIP' | 'Wholesale' | 'Regular' | 'New';
```

### 7. departments/ Collection

**Document ID**: Auto-generated

```typescript
interface Department {
  id: string;                           // Auto-generated document ID
  userId: string;                       // Reference to users collection
  shopId?: string;                      // Reference to shops collection
  name: string;                         // Department name
  telegramChatId: string;               // Telegram chat/group ID
  adminChatId?: string;                 // Admin chat ID (for cashier departments)
  role: 'kitchen' | 'cashier' | 'admin' | 'shop' | 'delivery' | 'sales';
  order: number;                        // Display order
  icon: string;                         // Department icon (emoji)
  isActive: boolean;                    // Department active status
  
  // Configuration
  notificationTypes?: string[];         // Types of notifications to receive
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 8. bills/ Collection (for Restaurant Table Service)

**Document ID**: Auto-generated

```typescript
interface Bill {
  id: string;                           // Auto-generated document ID
  shopId: string;                       // Reference to shops collection
  tableNumber: string;                  // Table number
  items: OrderItem[];                   // Array of ordered items
  subtotal: number;                     // Subtotal amount
  tax: number;                          // Tax amount
  total: number;                        // Total amount
  status: 'active' | 'paid' | 'cancelled';
  
  // Payment Information
  paymentMethod?: string;               // Payment method used
  paymentPhotoUrl?: string;             // Payment proof photo URL
  
  // Customer Information
  customerId?: string;                  // Customer identifier
  customerName?: string;                // Customer name
  telegramId?: string;                  // Telegram user ID
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  paidAt?: Timestamp;                   // Payment completion time
}
```

### 9. notifications/ Collection

**Document ID**: Auto-generated

```typescript
interface Notification {
  id: string;                           // Auto-generated document ID
  userId: string;                       // Reference to users collection
  shopId?: string;                      // Reference to shops collection
  type: 'order' | 'payment' | 'stock' | 'system' | 'promotion';
  title: string;                        // Notification title
  message: string;                      // Notification message
  data?: any;                           // Additional notification data
  
  // Status
  read: boolean;                        // Read status
  priority: 'low' | 'medium' | 'high' | 'urgent';
  
  // Delivery Channels
  channels: {
    email?: boolean;                    // Send via email
    push?: boolean;                     // Send via push notification
    telegram?: boolean;                 // Send via Telegram
  };
  
  // Delivery Status
  delivered: {
    email?: Timestamp;                  // Email delivery time
    push?: Timestamp;                   // Push notification delivery time
    telegram?: Timestamp;               // Telegram delivery time
  };
  
  // Timestamps
  createdAt: Timestamp;
  readAt?: Timestamp;                   // Read timestamp
  expiresAt?: Timestamp;                // Expiration timestamp
}
```

### 10. analytics/ Collection

**Document ID**: Date-based (YYYY-MM-DD) or custom

```typescript
interface Analytics {
  id: string;                           // Date or custom identifier
  shopId: string;                       // Reference to shops collection
  date: Timestamp;                      // Analytics date
  
  // Sales Metrics
  sales: {
    totalOrders: number;                // Total orders for the period
    totalRevenue: number;               // Total revenue
    averageOrderValue: number;          // Average order value
    newCustomers: number;               // New customers acquired
    returningCustomers: number;         // Returning customers
  };
  
  // Product Metrics
  products: {
    topSelling: Array<{
      productId: string;
      productName: string;
      quantitySold: number;
      revenue: number;
    }>;
    lowStock: Array<{
      productId: string;
      productName: string;
      currentStock: number;
      alertThreshold: number;
    }>;
  };
  
  // Channel Metrics
  channels: {
    web: {
      orders: number;
      revenue: number;
    };
    telegram: {
      orders: number;
      revenue: number;
    };
  };
  
  // Geographic Data (if available)
  geography?: {
    [region: string]: {
      orders: number;
      revenue: number;
    };
  };
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 11. settings/ Collection (Global App Settings)

**Document ID**: 'global' or feature-specific

```typescript
interface Settings {
  id: string;                           // Settings identifier
  
  // Application Settings
  app: {
    name: string;                       // Application name
    version: string;                    // Application version
    maintenanceMode: boolean;           // Maintenance mode flag
    supportedLanguages: string[];       // Supported languages
    defaultCurrency: string;            // Default currency
    defaultTimezone: string;            // Default timezone
  };
  
  // Feature Flags
  features: {
    telegramIntegration: boolean;       // Telegram integration enabled
    multiLanguage: boolean;             // Multi-language support
    analytics: boolean;                 // Analytics enabled
    loyaltyProgram: boolean;            // Loyalty program enabled
    inventoryManagement: boolean;       // Inventory management enabled
  };
  
  // Payment Settings
  payment: {
    supportedMethods: string[];         // Supported payment methods
    taxRate: number;                    // Default tax rate
    currency: string;                   // Default currency
  };
  
  // Notification Settings
  notifications: {
    emailEnabled: boolean;              // Email notifications enabled
    pushEnabled: boolean;               // Push notifications enabled
    telegramEnabled: boolean;           // Telegram notifications enabled
  };
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## Security Rules

```javascript
// Firestore Security Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Shop owners can read/write their shops
    match /shops/{shopId} {
      allow read: if true; // Public read for catalog
      allow write: if request.auth != null && 
        request.auth.uid == resource.data.ownerId;
    }
    
    // Products are publicly readable, writable by shop owners
    match /products/{productId} {
      allow read: if true; // Public read for catalog
      allow write: if request.auth != null && 
        exists(/databases/$(database)/documents/shops/$(resource.data.shopId)) &&
        get(/databases/$(database)/documents/shops/$(resource.data.shopId)).data.ownerId == request.auth.uid;
    }
    
    // Categories are readable by authenticated users, writable by owners
    match /categories/{categoryId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    
    // Orders are readable/writable by shop owners and customers
    match /orders/{orderId} {
      allow read, write: if request.auth != null && (
        request.auth.uid == resource.data.customerId ||
        exists(/databases/$(database)/documents/shops/$(resource.data.shopId)) &&
        get(/databases/$(database)/documents/shops/$(resource.data.shopId)).data.ownerId == request.auth.uid
      );
    }
    
    // Customers are readable/writable by shop owners
    match /customers/{customerId} {
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/shops/$(resource.data.shopId)) &&
        get(/databases/$(database)/documents/shops/$(resource.data.shopId)).data.ownerId == request.auth.uid;
    }
    
    // Departments are readable/writable by owners
    match /departments/{departmentId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    
    // Bills are readable/writable by shop owners
    match /bills/{billId} {
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/shops/$(resource.data.shopId)) &&
        get(/databases/$(database)/documents/shops/$(resource.data.shopId)).data.ownerId == request.auth.uid;
    }
    
    // Notifications are readable/writable by owners
    match /notifications/{notificationId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    
    // Analytics are readable/writable by shop owners
    match /analytics/{analyticsId} {
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/shops/$(resource.data.shopId)) &&
        get(/databases/$(database)/documents/shops/$(resource.data.shopId)).data.ownerId == request.auth.uid;
    }
    
    // Settings are readable by all, writable by admins only
    match /settings/{settingId} {
      allow read: if true;
      allow write: if request.auth != null && 
        request.auth.token.admin == true;
    }
  }
}
```

## Indexes

```javascript
// Composite Indexes (add to Firebase Console)
// Collection: products
// Fields: shopId (Ascending), isActive (Ascending), createdAt (Descending)

// Collection: orders  
// Fields: shopId (Ascending), status (Ascending), createdAt (Descending)

// Collection: orders
// Fields: customerId (Ascending), createdAt (Descending)

// Collection: customers
// Fields: shopId (Ascending), totalSpent (Descending)

// Collection: categories
// Fields: userId (Ascending), shopId (Ascending), order (Ascending)

// Collection: departments
// Fields: userId (Ascending), shopId (Ascending), role (Ascending)

// Collection: notifications
// Fields: userId (Ascending), read (Ascending), createdAt (Descending)

// Collection: analytics
// Fields: shopId (Ascending), date (Descending)
```

## Cloud Functions Triggers

```javascript
// Suggested Cloud Functions for data consistency and automation

// 1. Update customer statistics when order is created/updated
// Trigger: orders/{orderId} onCreate, onUpdate

// 2. Update product stock when order is confirmed
// Trigger: orders/{orderId} onUpdate (status change to confirmed)

// 3. Send notifications for low stock
// Trigger: products/{productId} onUpdate (stock change)

// 4. Generate daily analytics
// Trigger: Scheduled function (daily)

// 5. Clean up expired notifications
// Trigger: Scheduled function (daily)

// 6. Update shop statistics
// Trigger: orders/{orderId} onCreate, onUpdate

// 7. Send Telegram notifications
// Trigger: orders/{orderId} onCreate, onUpdate
// Trigger: notifications/{notificationId} onCreate
```

## Data Migration Scripts

```javascript
// Example migration script for existing data
// Run these in Firebase Functions or Admin SDK

// 1. Migrate existing orders to include source field
// 2. Generate customer records from existing orders
// 3. Set default settings for existing shops
// 4. Create default categories for shops
// 5. Initialize analytics collections
```

This comprehensive database structure supports:

- ✅ Multi-shop management
- ✅ Product catalog with categories
- ✅ Order management with multiple statuses
- ✅ Customer relationship management
- ✅ Telegram integration with departments
- ✅ Restaurant table service with bills
- ✅ Analytics and reporting
- ✅ Notification system
- ✅ User settings and preferences
- ✅ Security rules for data protection
- ✅ Scalable architecture for growth

The structure is designed to be flexible, scalable, and secure while supporting all the features of your multi-shop platform with Telegram integration.