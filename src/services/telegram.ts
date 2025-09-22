interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode?: 'HTML' | 'Markdown';
}

interface TelegramConfig {
  botToken: string;
  shopGroupId: string;
  cashierGroupId: string;
  deliveryGroupId: string;
}

interface UserCacheData {
  telegram_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  last_shop_id?: string;
  shops: { [shopId: string]: { last_interacted: string } };
  created_at: string;
}

interface ShopData {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  ownerId: string;
}

interface CategoryData {
  id: string;
  name: string;
  description?: string;
  icon: string;
  order: number;
  shopId: string;
}

interface ProductData {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  images: string[];
  isActive: boolean;
  shopId: string;
}

class TelegramService {
  private botToken: string;
  private userCache: Map<number, UserCacheData> = new Map();
  private shopMembersCache: Map<string, Set<number>> = new Map();

  constructor(botToken: string) {
    this.botToken = botToken;
  }

  async sendMessage(message: TelegramMessage): Promise<void> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send Telegram message:', error);
      throw error;
    }
  }

  // User Cache Management
  async cacheUser(userData: UserCacheData): Promise<void> {
    try {
      this.userCache.set(userData.telegram_id, userData);
      
      // Also save to Firebase
      const response = await fetch('/api/users/cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to cache user: ${response.status}`);
      }
      
      console.log(`Cached user ${userData.telegram_id}`);
    } catch (error) {
      console.error('Error caching user:', error);
      throw error;
    }
  }

  getCachedUser(telegramId: number): UserCacheData | undefined {
    return this.userCache.get(telegramId);
  }

  async updateUserShopInteraction(telegramId: number, shopId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      
      // Update cache
      const cachedUser = this.userCache.get(telegramId);
      if (cachedUser) {
        cachedUser.last_shop_id = shopId;
        if (!cachedUser.shops) {
          cachedUser.shops = {};
        }
        cachedUser.shops[shopId] = { last_interacted: now };
        this.userCache.set(telegramId, cachedUser);
      }
      
      // Update Firebase
      const response = await fetch('/api/users/shop-interaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telegramId,
          shopId,
          timestamp: now
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update shop interaction: ${response.status}`);
      }
      
      console.log(`Updated shop interaction: user ${telegramId} -> shop ${shopId}`);
    } catch (error) {
      console.error('Error updating user shop interaction:', error);
      throw error;
    }
  }

  async getUserLastShop(telegramId: number): Promise<ShopData | null> {
    try {
      const cachedUser = this.userCache.get(telegramId);
      
      if (!cachedUser || !cachedUser.last_shop_id) {
        return null;
      }
      
      // Fetch shop data
      const response = await fetch(`/api/shops/${cachedUser.last_shop_id}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch shop: ${response.status}`);
      }
      
      const shopData = await response.json();
      return shopData;
    } catch (error) {
      console.error('Error getting user last shop:', error);
      return null;
    }
  }

  // Shop Member Cache Management
  addShopMember(shopId: string, telegramId: number): void {
    if (!this.shopMembersCache.has(shopId)) {
      this.shopMembersCache.set(shopId, new Set());
    }
    this.shopMembersCache.get(shopId)!.add(telegramId);
  }

  getShopMembers(shopId: string): number[] {
    const members = this.shopMembersCache.get(shopId);
    return members ? Array.from(members) : [];
  }

  // Menu Navigation Methods
  async sendShopMenu(chatId: string, shopData: ShopData): Promise<void> {
    try {
      const categories = await this.getShopCategories(shopData.id);
      
      let text = `🏪 **${shopData.name}**\n\n`;
      
      if (shopData.description) {
        text += `${shopData.description}\n\n`;
      }
      
      if (categories.length === 0) {
        text += '❌ No categories available yet.';
        
        await this.sendMessage({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown'
        });
        return;
      }
      
      text += '📂 Choose a category:';
      
      // Create inline keyboard
      const keyboard = categories.map(category => [{
        text: `${category.icon || '📦'} ${category.name}`,
        callback_data: `category_${shopData.id}_${category.id}`
      }]);
      
      keyboard.push([{
        text: '🔄 Refresh Menu',
        callback_data: `shop_${shopData.id}`
      }]);
      
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`);
      }
    } catch (error) {
      console.error('Error sending shop menu:', error);
      throw error;
    }
  }

  async sendCategoryProducts(chatId: string, shopId: string, categoryId: string): Promise<void> {
    try {
      const category = await this.getCategoryData(categoryId);
      const products = await this.getCategoryProducts(shopId, categoryId);
      
      if (!category) {
        await this.sendMessage({
          chat_id: chatId,
          text: '❌ Category not found.',
        });
        return;
      }
      
      let text = `📂 **${category.name}**\n\n`;
      
      if (category.description) {
        text += `${category.description}\n\n`;
      }
      
      if (products.length === 0) {
        text += '❌ No products available in this category.';
        
        const keyboard = [[{
          text: '⬅️ Back to Categories',
          callback_data: `shop_${shopId}`
        }]];
        
        const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: keyboard
            }
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Telegram API error: ${response.status}`);
        }
        return;
      }
      
      text += '🛍️ Choose a product:';
      
      // Create product buttons
      const keyboard = products
        .filter(product => product.isActive && product.stock > 0)
        .map(product => {
          const priceText = `$${product.price.toFixed(2)}`;
          const stockText = product.stock <= 10 ? ` (${product.stock} left)` : '';
          
          return [{
            text: `${product.name} - ${priceText}${stockText}`,
            callback_data: `product_${shopId}_${product.id}`
          }];
        });
      
      if (keyboard.length === 0) {
        text = `📂 **${category.name}**\n\n❌ No products available in stock.`;
      }
      
      keyboard.push([{
        text: '⬅️ Back to Categories',
        callback_data: `shop_${shopId}`
      }]);
      
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`);
      }
    } catch (error) {
      console.error('Error sending category products:', error);
      throw error;
    }
  }

  async sendProductDetails(chatId: string, shopId: string, productId: string, categoryId?: string): Promise<void> {
    try {
      const product = await this.getProductData(productId);
      
      if (!product) {
        await this.sendMessage({
          chat_id: chatId,
          text: '❌ Product not found.',
        });
        return;
      }
      
      let text = `🛍️ **${product.name}**\n\n`;
      
      if (product.description) {
        text += `📝 ${product.description}\n\n`;
      }
      
      text += `💰 **Price:** $${product.price.toFixed(2)}\n`;
      text += `📦 **Stock:** ${product.stock} available\n`;
      
      const isAvailable = product.isActive && product.stock > 0;
      
      if (!isAvailable) {
        text += '\n❌ **Currently unavailable**';
      }
      
      // Create keyboard
      const keyboard = [];
      
      if (isAvailable) {
        keyboard.push([{
          text: '🛒 Order This Item',
          callback_data: `order_${shopId}_${productId}`
        }]);
      }
      
      // Back button
      if (categoryId) {
        keyboard.push([{
          text: '⬅️ Back to Products',
          callback_data: `category_${shopId}_${categoryId}`
        }]);
      } else {
        keyboard.push([{
          text: '⬅️ Back to Categories',
          callback_data: `shop_${shopId}`
        }]);
      }
      
      // Send with image if available
      if (product.images && product.images.length > 0) {
        const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendPhoto`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            photo: product.images[0],
            caption: text,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: keyboard
            }
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Telegram API error: ${response.status}`);
        }
      } else {
        const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: keyboard
            }
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Telegram API error: ${response.status}`);
        }
      }
    } catch (error) {
      console.error('Error sending product details:', error);
      throw error;
    }
  }

  async sendOrderConfirmation(chatId: string, shopId: string, productId: string, userInfo: any): Promise<void> {
    try {
      const product = await this.getProductData(productId);
      const shop = await this.getShopData(shopId);
      
      if (!product || !shop) {
        await this.sendMessage({
          chat_id: chatId,
          text: '❌ Product or shop not found.',
        });
        return;
      }
      
      const confirmationText = `
✅ **Order Request Sent!**

🛍️ **Product:** ${product.name}
💰 **Price:** $${product.price.toFixed(2)}
🏪 **Shop:** ${shop.name}

📞 **Next Steps:**
The shop owner will contact you shortly to confirm your order and arrange payment/delivery.

Thank you for your order! 🙏
      `.trim();
      
      const keyboard = [[{
        text: '⬅️ Back to Product',
        callback_data: `product_${shopId}_${productId}`
      }]];
      
      await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: confirmationText,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }),
      });
      
      // Log the order (you can extend this to save to database)
      console.log(`Order request: User ${userInfo.id} ordered ${product.name} from shop ${shopId}`);
    } catch (error) {
      console.error('Error sending order confirmation:', error);
      throw error;
    }
  }

  // Data fetching methods (these would typically call your API)
  async getShopCategories(shopId: string): Promise<CategoryData[]> {
    try {
      const response = await fetch(`/api/shops/${shopId}/categories`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch categories: ${response.status}`);
      }
      
      const categories = await response.json();
      return categories.sort((a: CategoryData, b: CategoryData) => a.order - b.order);
    } catch (error) {
      console.error('Error fetching shop categories:', error);
      return [];
    }
  }

  async getCategoryData(categoryId: string): Promise<CategoryData | null> {
    try {
      const response = await fetch(`/api/categories/${categoryId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch category: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching category data:', error);
      return null;
    }
  }

  async getCategoryProducts(shopId: string, categoryId: string): Promise<ProductData[]> {
    try {
      const response = await fetch(`/api/shops/${shopId}/categories/${categoryId}/products`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching category products:', error);
      return [];
    }
  }

  async getProductData(productId: string): Promise<ProductData | null> {
    try {
      const response = await fetch(`/api/products/${productId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch product: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching product data:', error);
      return null;
    }
  }

  async getShopData(shopId: string): Promise<ShopData | null> {
    try {
      const response = await fetch(`/api/shops/${shopId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch shop: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching shop data:', error);
      return null;
    }
  }

  async sendBillPhoto(photoUrl: string, tableNumber: string, totalAmount: number, chatId: string, userId?: string): Promise<void> {
    try {
      const message = `
🧾 <b>Bill Request - Table ${tableNumber}</b>

💰 Total Amount: $${totalAmount.toFixed(2)}
📅 Date: ${new Date().toLocaleString()}
${userId ? `👤 User ID: ${userId}` : ''}

<i>Bill photo attached above</i>
      `.trim();

      // Send photo with caption
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendPhoto`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photoUrl,
          caption: message,
          parse_mode: 'HTML'
        }),
      });

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send bill photo to Telegram:', error);
      throw error;
    }
  }

  async sendPaymentProof(paymentData: {
    screenshotUrl: string;
    method: string;
    tableNumber: string;
    totalAmount: number;
    items: any[];
  }, chatId: string): Promise<void> {
    try {
      const itemsList = paymentData.items.map(item => 
        `• ${item.name} × ${item.quantity} = $${item.total.toFixed(2)}`
      ).join('\n');

      const message = `
💳 <b>Payment Proof Submitted</b>

🏪 Table: ${paymentData.tableNumber}
💰 Amount: $${paymentData.totalAmount.toFixed(2)}
💳 Method: ${paymentData.method === 'bank_transfer' ? 'Bank Transfer' : 'Mobile Money'}

📦 <b>Items:</b>
${itemsList}

⏰ Submitted: ${new Date().toLocaleString()}

<i>Please verify payment and confirm order</i>
      `.trim();

      // Send photo with caption
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendPhoto`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          photo: paymentData.screenshotUrl,
          caption: message,
          parse_mode: 'HTML'
        }),
      });

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send payment proof to Telegram:', error);
      throw error;
    }
  }

  async sendOrderForApproval(orderData: any, chatId: string): Promise<void> {
    try {
      // Store order in Firebase first
      await this.storeOrderInFirebase(orderData);
      
      const itemsList = orderData.items.map((item: any) => 
        `• ${item.productName} × ${item.quantity} = $${item.total.toFixed(2)}`
      ).join('\n');

      // Create clickable map link if delivery address contains coordinates
      let deliveryInfo = '';
      if (orderData.deliveryMethod === 'delivery' && orderData.deliveryAddress) {
        const address = orderData.deliveryAddress;
        const coordMatch = address.match(/Lat:\s*([-\d.]+),\s*Lng:\s*([-\d.]+)/);
        if (coordMatch) {
          const lat = coordMatch[1];
          const lng = coordMatch[2];
          const mapLink = `https://www.google.com/maps?q=${lat},${lng}`;
          deliveryInfo = `📍 <a href="${mapLink}">📍 View Location on Map</a>`;
        } else {
          deliveryInfo = `📍 Address: ${address}`;
        }
      }

      const message = `
🛍️ <b>New Order Pending Approval</b>

📋 Order ID: #${Date.now().toString().slice(-6)}
👤 Customer: ${orderData.customerName}
📞 Table/Contact: ${orderData.tableNumber}
🚚 Method: ${orderData.deliveryMethod === 'delivery' ? '🚚 Delivery' : '📦 Pickup'}
${deliveryInfo}
💳 Payment: ${orderData.paymentPreference}
💰 Total: $${orderData.total.toFixed(2)}

📦 <b>Items:</b>
${itemsList}

${orderData.customerNotes ? `📝 <b>Notes:</b> ${orderData.customerNotes}\n` : ''}
⏰ Ordered: ${new Date().toLocaleString()}

<i>Please approve or reject this order</i>
      `.trim();

      // Send to admin chat for approval
      await this.sendMessage({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      });
    } catch (error) {
      console.error('Failed to send order for approval:', error);
      throw error;
    }
  }

  async sendPaymentConfirmationOrder(orderData: any, chatId: string): Promise<void> {
    try {
      // Store order in Firebase first
      await this.storeOrderInFirebase(orderData);
      
      const itemsList = orderData.items.map((item: any) => 
        `• ${item.productName} × ${item.quantity} = $${item.total.toFixed(2)}`
      ).join('\n');

      // Create clickable map link if delivery address contains coordinates
      let deliveryInfo = '';
      if (orderData.deliveryMethod === 'delivery' && orderData.deliveryAddress) {
        const address = orderData.deliveryAddress;
        const coordMatch = address.match(/Lat:\s*([-\d.]+),\s*Lng:\s*([-\d.]+)/);
        if (coordMatch) {
          const lat = coordMatch[1];
          const lng = coordMatch[2];
          const mapLink = `https://www.google.com/maps?q=${lat},${lng}`;
          deliveryInfo = `📍 <a href="${mapLink}">📍 View Location on Map</a>`;
        } else {
          deliveryInfo = `📍 Address: ${address}`;
        }
      }

      const message = `
💳 <b>Payment Confirmation Required</b>

📋 Order ID: #${orderData.id.slice(-6)}
👤 Customer: ${orderData.customerName}
${orderData.customerPhone ? `📞 Phone: ${orderData.customerPhone}` : ''}
📞 Table/Contact: ${orderData.tableNumber}
🚚 Method: ${orderData.deliveryMethod === 'delivery' ? '🚚 Delivery' : '📦 Pickup'}
${deliveryInfo}
💳 Payment: ${orderData.paymentPreference === 'bank_transfer' ? 'Bank Transfer' : 'Mobile Money'}
💰 Total: $${orderData.total.toFixed(2)}

📦 <b>Items:</b>
${itemsList}

${orderData.customerNotes ? `📝 <b>Notes:</b> ${orderData.customerNotes}\n` : ''}
⏰ Ordered: ${new Date().toLocaleString()}

⚠️ <b>Customer has confirmed payment completion</b>
<i>Please verify payment and approve order</i>
      `.trim();

      // Send payment photo if available
      if (orderData.paymentPhotoUrl) {
        await fetch(`https://api.telegram.org/bot${this.botToken}/sendPhoto`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            photo: orderData.paymentPhotoUrl,
            caption: `💳 Payment Proof - Order #${orderData.id.slice(-6)}\n\n👤 ${orderData.customerName}\n📞 ${orderData.customerPhone}\n💰 $${orderData.total.toFixed(2)}`,
            parse_mode: 'HTML'
          }),
        });
      }

      await this.sendMessage({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      });
    } catch (error) {
      console.error('Failed to send payment confirmation order:', error);
      throw error;
    }
  }

  async sendApprovedOrderToGroups(orderData: any, salesChatId: string, deliveryChatId?: string): Promise<void> {
    try {
      const itemsList = orderData.items.map((item: any) => 
        `• ${item.productName} × ${item.quantity} = $${item.total.toFixed(2)}`
      ).join('\n');

      // Message for sales group
      const salesMessage = `
✅ <b>Order Approved - Sales</b>

📋 Order ID: #${orderData.id.slice(-6)}
👤 Customer: ${orderData.customerName}
📞 Contact: ${orderData.tableNumber}
💰 Total: $${orderData.total.toFixed(2)}
💳 Payment: ${orderData.paymentPreference}

📦 <b>Items:</b>
${itemsList}

${orderData.customerNotes ? `📝 <b>Notes:</b> ${orderData.customerNotes}\n` : ''}
⏰ Approved: ${new Date().toLocaleString()}

<i>Order ready for processing</i>
      `.trim();

      // Message for delivery group (if delivery)
      const deliveryMessage = `
🚚 <b>Delivery Order - Ready</b>

📋 Order ID: #${orderData.id.slice(-6)}
👤 Customer: ${orderData.customerName}
📞 Contact: ${orderData.tableNumber}
📍 Address: ${orderData.deliveryAddress}
💰 Total: $${orderData.total.toFixed(2)}
💳 Payment: ${orderData.paymentPreference}

📦 <b>Items:</b>
${itemsList}

${orderData.customerNotes ? `📝 <b>Notes:</b> ${orderData.customerNotes}\n` : ''}
⏰ Ready for delivery: ${new Date().toLocaleString()}

<i>Please prepare for delivery</i>
      `.trim();

      // Send to sales group (using same chat for now, but can be different)
      await this.sendMessage({
        chat_id: salesChatId,
        text: salesMessage,
        parse_mode: 'HTML'
      });

      // Send to delivery group if it's a delivery order
      if (orderData.deliveryMethod === 'delivery' && deliveryChatId) {
        await this.sendMessage({
          chat_id: deliveryChatId,
          text: deliveryMessage,
          parse_mode: 'HTML'
        });
      }
    } catch (error) {
      console.error('Failed to send approved order to groups:', error);
      throw error;
    }
  }

  // Store Telegram orders in Firebase
  async storeOrderInFirebase(orderData: any): Promise<string> {
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...orderData,
          source: 'telegram',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to store order: ${response.status}`);
      }

      const result = await response.json();
      return result.id;
    } catch (error) {
      console.error('Error storing order in Firebase:', error);
      // Don't throw error to prevent Telegram message failure
      return '';
    }
  }

  async notifyNewOrder(config: TelegramConfig, orderData: any): Promise<void> {
    const message = `
🛍️ <b>New Order #${orderData.id}</b>

👤 Customer: ${orderData.customerName}
💰 Total: $${orderData.total.toFixed(2)}
📦 Items: ${orderData.items.length}
🚚 Delivery: ${orderData.deliveryMethod}

<i>Order received at ${new Date().toLocaleString()}</i>
    `.trim();

    // Notify shop group
    await this.sendMessage({
      chat_id: config.shopGroupId,
      text: message,
      parse_mode: 'HTML'
    });

    // Notify cashier group for payment
    await this.sendMessage({
      chat_id: config.cashierGroupId,
      text: `💳 <b>Payment Required</b>\n\nOrder #${orderData.id}\nAmount: $${orderData.total.toFixed(2)}\nCustomer: ${orderData.customerName}`,
      parse_mode: 'HTML'
    });
  }

  async notifyOrderStatusChange(chatId: string, orderData: any, oldStatus: string, newStatus: string): Promise<void> {
    const statusEmojis: { [key: string]: string } = {
      pending: '⏳',
      confirmed: '✅',
      processing: '🔄',
      shipped: '🚚',
      delivered: '📦',
      cancelled: '❌'
    };

    const message = `
${statusEmojis[newStatus] || '📋'} <b>Order Status Updated</b>

📋 Order: #${orderData.id.slice(-6)}
👤 Customer: ${orderData.customerId}
💰 Total: $${orderData.total.toFixed(2)}

🔄 Status: ${oldStatus.toUpperCase()} → <b>${newStatus.toUpperCase()}</b>
⏰ Updated: ${new Date().toLocaleString()}

${newStatus === 'confirmed' ? '✅ <i>Order approved and ready for processing</i>' :
  newStatus === 'processing' ? '🔄 <i>Order is being prepared</i>' :
  newStatus === 'shipped' ? '🚚 <i>Order has been shipped</i>' :
  newStatus === 'delivered' ? '📦 <i>Order delivered successfully</i>' :
  newStatus === 'cancelled' ? '❌ <i>Order has been cancelled</i>' :
  '<i>Order status updated</i>'}
    `.trim();

    await this.sendMessage({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });
  }

  async notifyOrderApproval(chatId: string, orderData: any): Promise<void> {
    const itemsList = orderData.items.map((item: any) => 
      `• ${item.productName} × ${item.quantity} = $${item.total.toFixed(2)}`
    ).join('\n');

    const message = `
✅ <b>Order Approved</b>

📋 Order ID: #${orderData.id.slice(-6)}
👤 Customer: ${orderData.customerId}
💰 Total: $${orderData.total.toFixed(2)}
📅 Date: ${new Date(orderData.createdAt).toLocaleString()}

📦 <b>Items:</b>
${itemsList}

🔄 Status: CONFIRMED
⏰ Approved at: ${new Date().toLocaleString()}

<i>Order is now being processed</i>
    `.trim();

    await this.sendMessage({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });
  }

  async notifyOrderRejection(chatId: string, orderData: any, reason?: string): Promise<void> {
    const itemsList = orderData.items.map((item: any) => 
      `• ${item.productName} × ${item.quantity} = $${item.total.toFixed(2)}`
    ).join('\n');

    const message = `
❌ <b>Order Rejected</b>

📋 Order ID: #${orderData.id.slice(-6)}
👤 Customer: ${orderData.customerId}
💰 Total: $${orderData.total.toFixed(2)}
📅 Date: ${new Date(orderData.createdAt).toLocaleString()}

📦 <b>Items:</b>
${itemsList}

${reason ? `📝 <b>Reason:</b> ${reason}\n` : ''}
⏰ Rejected at: ${new Date().toLocaleString()}

<i>Customer should be notified about the cancellation</i>
    `.trim();

    await this.sendMessage({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });
  }

  async notifyPaymentReceived(config: TelegramConfig, orderData: any): Promise<void> {
    const message = `
✅ <b>Payment Confirmed</b>

Order #${orderData.id}
Amount: $${orderData.total.toFixed(2)}
Customer: ${orderData.customerName}

📦 <b>Ready for processing/delivery</b>
    `.trim();

    // Notify delivery group
    await this.sendMessage({
      chat_id: config.deliveryGroupId,
      text: message,
      parse_mode: 'HTML'
    });
  }

  async notifyLowStock(config: TelegramConfig, product: any): Promise<void> {
    const message = `
⚠️ <b>Low Stock Alert</b>

Product: ${product.name}
Current Stock: ${product.stock}
Alert Threshold: ${product.lowStockAlert}

<i>Please restock soon!</i>
    `.trim();

    await this.sendMessage({
      chat_id: config.shopGroupId,
      text: message,
      parse_mode: 'HTML'
    });
  }

  async postProductToChannel(config: TelegramConfig, product: any): Promise<void> {
    const message = `
🆕 <b>${product.name}</b>

${product.description}

💰 Price: $${product.price.toFixed(2)}
📦 In Stock: ${product.stock}

#${product.category.toLowerCase().replace(/\s+/g, '')}
    `.trim();

    await this.sendMessage({
      chat_id: config.shopGroupId,
      text: message,
      parse_mode: 'HTML'
    });
  }

  async promoteProduct(product: any, chatId: string, shopLink: string): Promise<void> {
    try {
      const categoryTag = product.category ? `#${product.category.toLowerCase().replace(/\s+/g, '')}` : '';
      const subcategoryTag = product.subcategory ? `#${product.subcategory.toLowerCase().replace(/\s+/g, '')}` : '';
      
      const message = `
🔥 <b>Featured Product</b>

🛍️ <b>${product.name}</b>

${product.description}

💰 <b>Price:</b> $${product.price.toFixed(2)}
📦 <b>Available:</b> ${product.stock} in stock
${product.sku ? `🏷️ <b>SKU:</b> ${product.sku}` : ''}

🛒 <b>Order Now:</b> <a href="${shopLink}">Visit Our Shop</a>

📱 <b>Quick Order:</b> Reply with "ORDER ${product.name}" to place an order

${categoryTag} ${subcategoryTag}

<i>🚀 Don't miss out on this amazing product!</i>
      `.trim();

      if (product.images && product.images.length > 0) {
        // Send photo with caption
        const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendPhoto`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            photo: product.images[0],
            caption: message,
            parse_mode: 'HTML'
          }),
        });

        if (!response.ok) {
          throw new Error(`Telegram API error: ${response.status}`);
        }
      } else {
        // Send text message only
        await this.sendMessage({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        });
      }
    } catch (error) {
      console.error('Failed to promote product to Telegram:', error);
      throw error;
    }
  }
}

export { TelegramService };
export default TelegramService;