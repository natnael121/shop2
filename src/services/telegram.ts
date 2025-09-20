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

class TelegramService {
  private botToken: string;

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

  async sendBillPhoto(photoUrl: string, tableNumber: string, totalAmount: number, userId?: string): Promise<void> {
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
          chat_id: '-1002701066037', // Default chat ID for bills
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
  }): Promise<void> {
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
          chat_id: '-1002701066037', // Default chat ID for payments
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
}

// Default instance using the provided bot token
export const telegramService = new TelegramService("7141155447:AAGU2K74kX3ICzSIPB566tly3LUDo423JrU");

export default TelegramService;