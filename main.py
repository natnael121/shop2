#!/usr/bin/env python3
"""
Multi-Shop Telegram Bot with Firebase Backend
Handles user caching, shop tracking, and menu navigation
"""

import os
import json
import logging
from datetime import datetime
from typing import Dict, Optional, Any
import asyncio
from collections import defaultdict
from dotenv import load_dotenv
load_dotenv()
# ✅ Removed keep_alive to prevent port conflicts and multiple instances
import firebase_admin
from firebase_admin import credentials, firestore
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, ChatMember
from telegram.ext import (
    Application, CommandHandler, CallbackQueryHandler, 
    ChatMemberHandler, ContextTypes, MessageHandler, filters,
    ConversationHandler
)

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# ✅ Reduce httpx logging to prevent bot token exposure in logs
logging.getLogger("httpx").setLevel(logging.WARNING)

# ✅ Find serviceAccountKey.json in the same folder as main.py
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
cred_path = os.path.join(BASE_DIR, "serviceAccountKey.json")

# ✅ Initialize Firebase with the correct path
cred = credentials.Certificate(cred_path)
firebase_admin.initialize_app(cred)

# ✅ Firestore client
db = firestore.client()

# Conversation states for product creation
PRODUCT_NAME, PRODUCT_DESCRIPTION, PRODUCT_PRICE, PRODUCT_STOCK, PRODUCT_CATEGORY, PRODUCT_IMAGES = range(6)

class UserCache:
    """In-memory cache for user data"""
    def __init__(self):
        self.users: Dict[int, Dict] = {}
        self.user_sessions: Dict[int, Dict] = {}
        self.shop_members: Dict[str, set] = defaultdict(set)

    def add_user(self, telegram_id: int, user_data: Dict):
        """Add user to cache"""
        self.users[telegram_id] = user_data
        logger.info(f"Added user {telegram_id} to cache")

    def get_user(self, telegram_id: int) -> Optional[Dict]:
        """Get user from cache"""
        return self.users.get(telegram_id)

    def update_user_shop(self, telegram_id: int, shop_id: str):
        """Update user's last shop interaction"""
        if telegram_id in self.users:
            self.users[telegram_id]['last_shop_id'] = shop_id
            if 'shops' not in self.users[telegram_id]:
                self.users[telegram_id]['shops'] = {}
            self.users[telegram_id]['shops'][shop_id] = {
                'last_interacted': datetime.now().isoformat()
            }

    def set_user_session(self, telegram_id: int, session_data: Dict):
        """Set user session data for navigation"""
        self.user_sessions[telegram_id] = session_data

    def get_user_session(self, telegram_id: int) -> Dict:
        """Get user session data"""
        return self.user_sessions.get(telegram_id, {})

    def add_shop_member(self, shop_id: str, telegram_id: int):
        """Add member to shop cache"""
        self.shop_members[shop_id].add(telegram_id)

# Global cache instance
user_cache = UserCache()

class TelegramBot:
    def __init__(self, bot_token: str):
        self.bot_token = bot_token
        self.application = Application.builder().token(bot_token).build()
        # Don't call setup_handlers here - wait until all methods are defined
        # self.setup_handlers()  # REMOVE THIS LINE

    def setup_handlers(self):
        """Setup handlers after all methods are defined"""
        self.application.add_handler(CommandHandler("start", self.start_command))
        self.application.add_handler(CallbackQueryHandler(self.button_callback))
        self.application.add_handler(ChatMemberHandler(self.track_chat_members, ChatMemberHandler.CHAT_MEMBER))
        self.application.add_handler(MessageHandler(filters.StatusUpdate.NEW_CHAT_MEMBERS, self.new_chat_members))
        
        # Add product creation conversation handler
        conv_handler = ConversationHandler(
            entry_points=[CallbackQueryHandler(self.start_add_product, pattern=r'^add_product_')],
            states={
                PRODUCT_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, self.get_product_name)],
                PRODUCT_DESCRIPTION: [MessageHandler(filters.TEXT & ~filters.COMMAND, self.get_product_description)],
                PRODUCT_PRICE: [MessageHandler(filters.TEXT & ~filters.COMMAND, self.get_product_price)],
                PRODUCT_STOCK: [MessageHandler(filters.TEXT & ~filters.COMMAND, self.get_product_stock)],
                PRODUCT_CATEGORY: [CallbackQueryHandler(self.handle_category_selection, pattern=r'^category_select_|^create_new_category$')],
                PRODUCT_IMAGES: [
                    MessageHandler(filters.PHOTO, self.get_product_images),
                    MessageHandler(filters.TEXT & ~filters.COMMAND, self.skip_images)
                ]
            },
            fallbacks=[CommandHandler('cancel', self.cancel_product_creation)],
            per_chat=True
        )
        self.application.add_handler(conv_handler)
        
        # ✅ Add global error handler to prevent unhandled exceptions
        self.application.add_error_handler(self.error_handler)

    async def error_handler(self, update: object, context: ContextTypes.DEFAULT_TYPE):
        """Handle errors occurred in the dispatcher"""
        logger.error(f"Exception while handling an update: {context.error}")
        
        # Try to notify user if update is available
        if isinstance(update, Update) and update.effective_chat:
            try:
                await context.bot.send_message(
                    chat_id=update.effective_chat.id,
                    text="⚠️ Something went wrong. Please try again."
                )
            except Exception:
                pass  # If we can't send message, just log

    def run(self):
        """Run the bot"""
        logger.info("Starting Telegram bot...")
        # Call setup_handlers here instead, after all methods are defined
        self.setup_handlers()
        self.application.run_polling(allowed_updates=Update.ALL_TYPES)

    async def send_error_message(self, update: Update, message: str):
        """Send error message safely, handling image messages too"""
        try:
            if update.callback_query:
                # Check if callback message has text
                if update.callback_query.message.text:
                    await update.callback_query.edit_message_text(f"❌ {message}")
                else:
                    await update.callback_query.message.reply_text(f"❌ {message}")
            elif update.message:
                if update.message.text:
                    await update.message.reply_text(f"❌ {message}")
                else:
                    await update.message.reply_text(f"❌ {message}")
        except Exception as e:
            logger.error(f"Error sending error message: {e}")

    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /start command - show last interacted shop"""
        try:
            user = update.effective_user
            telegram_id = user.id

            logger.info(f"Start command from user {telegram_id}")

            # Get or create user data
            user_data = await self.get_or_create_user(user)

            # Get last interacted shop
            last_shop = await self.get_user_last_shop(telegram_id)

            if not last_shop:
                await update.message.reply_text(
                    "👋 Welcome! You haven't interacted with any shops yet.\n"
                    "Join a shop's Telegram channel to start ordering!"
                )
                return

            # Show shop menu
            await self.show_shop_menu(update, context, last_shop['id'], last_shop)

        except Exception as e:
            logger.error(f"Error in start_command: {e}")
            await update.message.reply_text("❌ Sorry, something went wrong. Please try again.")

    async def is_admin_user(self, telegram_id: int, shop_id: str) -> bool:
        """Check if user is admin for the given shop"""
        try:
            # Query departments to find admin chat IDs for this shop
            departments_ref = db.collection('departments').where('shopId', '==', shop_id).where('role', 'in', ['admin', 'cashier'])
            departments = departments_ref.stream()
            
            for dept in departments:
                dept_data = dept.to_dict()
                # Check both telegramChatId and adminChatId for cashier role
                chat_ids_to_check = []
                
                # For cashier role, check both telegramChatId and adminChatId
                if dept_data.get('role') == 'cashier':
                    if dept_data.get('telegramChatId'):
                        chat_ids_to_check.append(dept_data.get('telegramChatId'))
                    if dept_data.get('adminChatId'):
                        chat_ids_to_check.append(dept_data.get('adminChatId'))
                # For admin role, check adminChatId
                elif dept_data.get('role') == 'admin':
                    if dept_data.get('adminChatId'):
                        chat_ids_to_check.append(dept_data.get('adminChatId'))
                
                # Check if telegram_id matches any of the chat IDs
                for chat_id in chat_ids_to_check:
                    if chat_id:
                        # For private chats, chat_id equals user_id
                        # For groups, we need to check if user is admin in that group
                        if str(telegram_id) == str(chat_id) or str(telegram_id) == str(chat_id).replace('-', ''):
                            return True
                        
                        # If it's a group chat (negative ID), check if user is admin in that group
                        if str(chat_id).startswith('-'):
                            try:
                                # Get chat administrators
                                from telegram import Bot
                                bot = Bot(token=self.bot_token)
                                admins = await bot.get_chat_administrators(chat_id)
                                for admin in admins:
                                    if admin.user.id == telegram_id:
                                        return True
                            except Exception as e:
                                logger.warning(f"Could not check group admin status: {e}")
                                # Fallback: if we can't check group admin status, allow access
                        return True
            
            return False
        except Exception as e:
            logger.error(f"Error checking admin status: {e}")
            return False

    async def get_or_create_user(self, user) -> Dict:
        """Get user from cache or create new user record"""
        telegram_id = user.id

        # Check cache first
        cached_user = user_cache.get_user(telegram_id)
        if cached_user:
            return cached_user

        # Check Firebase
        user_ref = db.collection('users').document(str(telegram_id))
        user_doc = user_ref.get()

        if user_doc.exists:
            user_data = user_doc.to_dict()
            user_cache.add_user(telegram_id, user_data)
            return user_data

        # Create new user
        user_data = {
            'telegram_id': telegram_id,
            'username': user.username,
            'first_name': user.first_name,
            'customerId': user.first_name or user.username or str(telegram_id),
            'customerName': user.first_name or user.username or str(telegram_id),
            'telegramId': str(telegram_id),
            'telegramUsername': user.username,
            'source': 'telegram',
            'last_name': user.last_name,
            'created_at': datetime.now().isoformat(),
            'last_shop_id': None,
            'shops': {}
        }

        user_ref.set(user_data)
        user_cache.add_user(telegram_id, user_data)

        logger.info(f"Created new user: {telegram_id}")
        return user_data

    async def get_user_last_shop(self, telegram_id: int) -> Optional[Dict]:
        """Get user's last interacted shop"""
        user_data = user_cache.get_user(telegram_id)

        if not user_data or not user_data.get('last_shop_id'):
            return None

        shop_id = user_data['last_shop_id']

        # Get shop data from Firebase
        shop_ref = db.collection('shops').document(shop_id)
        shop_doc = shop_ref.get()

        if not shop_doc.exists:
            logger.warning(f"Shop {shop_id} not found")
            return None

        shop_data = shop_doc.to_dict()
        shop_data['id'] = shop_id

        return shop_data

    async def show_shop_menu(self, update: Update, context: ContextTypes.DEFAULT_TYPE, shop_id: str, shop_data: Dict):
        """Show shop categories menu"""
        try:
            # Update user's last shop interaction
            telegram_id = update.effective_user.id
            await self.update_user_shop_interaction(telegram_id, shop_id)
            
            # Check if user is admin for this shop
            is_admin = await self.is_admin_user(telegram_id, shop_id)

            # Get categories for this shop
            categories = await self.get_shop_categories(shop_id)
            logger.info(f"Found {len(categories)} categories for shop {shop_id}")

            if not categories:
                text = f"🏪 **{shop_data['name']}**\n\n❌ No categories available yet."
                keyboard = []
                if is_admin:
                    keyboard.append([InlineKeyboardButton("➕ Add Product", callback_data=f"add_product_{shop_id}")])
                keyboard.append([InlineKeyboardButton("🔄 Refresh", callback_data=f"shop_{shop_id}")])
                logger.info(f"No categories found, showing refresh button for shop {shop_id}")
            else:
                text = f"🏪 **{shop_data['name']}**\n\n📂 Choose a category:"

                keyboard = []
                for category in categories:
                    keyboard.append([InlineKeyboardButton(
                        f"{category.get('icon', '📦')} {category['name']}", 
                        callback_data=f"category_{shop_id}_{category['id']}"
                    )])
                    logger.info(f"Added category button: {category['name']} with ID {category['id']}")

                if is_admin:
                    keyboard.append([InlineKeyboardButton("➕ Add Product", callback_data=f"add_product_{shop_id}")])
                keyboard.append([InlineKeyboardButton("🔄 Refresh Menu", callback_data=f"shop_{shop_id}")])

            reply_markup = InlineKeyboardMarkup(keyboard)
            logger.info(f"Created keyboard with {len(keyboard)} buttons for shop {shop_id}")

            # Set user session
            user_cache.set_user_session(telegram_id, {
                'current_shop': shop_id,
                'current_view': 'shop_menu'
            })

            if update.callback_query:
                await update.callback_query.edit_message_text(
                    text=text, 
                    reply_markup=reply_markup,
                    parse_mode='Markdown'
                )
            else:
                await update.message.reply_text(
                    text=text, 
                    reply_markup=reply_markup,
                    parse_mode='Markdown'
                )

        except Exception as e:
            logger.error(f"Error showing shop menu: {e}")
            await self.send_error_message(update, "Failed to load shop menu")

    async def show_category_products(self, update: Update, context: ContextTypes.DEFAULT_TYPE, shop_id: str, category_id: str):
        """Show products in a category"""
        try:
            telegram_id = update.effective_user.id

            # Get category and products
            category_data = await self.get_category_data(category_id)
            products = await self.get_category_products(shop_id, category_id)

            if not category_data:
                await self.send_error_message(update, "Category not found")
                return

            category_name = category_data.get('name', 'Category')

            if not products:
                text = f"📂 **{category_name}**\n\n❌ No products available in this category."
                keyboard = [[InlineKeyboardButton("⬅️ Back to Categories", callback_data=f"shop_{shop_id}")]]
            else:
                text = f"📂 **{category_name}**\n\n🛍️ Choose a product:"

                keyboard = []
                for product in products:
                    if product.get('isActive', True) and product.get('stock', 0) > 0:
                        price_text = f"${product['price']:.2f}"
                        stock_text = f" ({product['stock']} left)" if product['stock'] <= 10 else ""

                        keyboard.append([InlineKeyboardButton(
                            f"{product['name']} - {price_text}{stock_text}",
                            callback_data=f"product_{shop_id}_{product['id']}"
                        )])

                if not keyboard:
                    text = f"📂 **{category_name}**\n\n❌ No products available in stock."

                keyboard.append([InlineKeyboardButton("⬅️ Back to Categories", callback_data=f"shop_{shop_id}")])

            reply_markup = InlineKeyboardMarkup(keyboard)

            # Update user session
            user_cache.set_user_session(telegram_id, {
                'current_shop': shop_id,
                'current_view': 'category',
                'current_category': category_id
            })

            # Handle different message types safely
            try:
                await update.callback_query.edit_message_text(
                    text=text,
                    reply_markup=reply_markup,
                    parse_mode='Markdown'
                )
            except Exception as edit_error:
                # If edit fails (photo messages), delete and send new
                try:
                    await update.callback_query.message.delete()
                except:
                    pass
                await context.bot.send_message(
                    chat_id=update.effective_chat.id,
                    text=text,
                    reply_markup=reply_markup,
                    parse_mode='Markdown'
                )

        except Exception as e:
            logger.error(f"Error showing category products: {e}")
            await self.send_error_message(update, "Failed to load products")

    async def show_product_details(self, update: Update, context: ContextTypes.DEFAULT_TYPE, shop_id: str, product_id: str):
        """Show product details safely (works with photos)"""
        try:
            telegram_id = update.effective_user.id
            session = user_cache.get_user_session(telegram_id)

            # Get product data
            product_data = await self.get_product_data(product_id)
            if not product_data:
                await self.send_error_message(update, "Product not found")
                return

            # ✅ Find the product's category to ensure proper navigation
            current_category = session.get('current_category')
            if not current_category and product_data.get('category'):
                # If no category in session, try to find it from the product's category name
                category_name = product_data['category']
                categories = await self.get_shop_categories(shop_id)
                for cat in categories:
                    if cat['name'] == category_name:
                        current_category = cat['id']
                        break

            # Format text
            text = f"🛍️ **{product_data['name']}**\n\n"
            if product_data.get('description'):
                text += f"📝 {product_data['description']}\n\n"
            text += f"💰 **Price:** ${product_data['price']:.2f}\n"
            text += f"📦 **Stock:** {product_data['stock']} available\n"
            if product_data.get('sku'):
                text += f"🏷️ **SKU:** {product_data['sku']}\n"
            if not (product_data.get('isActive', True) and product_data.get('stock', 0) > 0):
                text += "\n❌ **Currently unavailable**"

            # Keyboard
            keyboard = []
            if product_data.get('isActive', True) and product_data.get('stock', 0) > 0:
                keyboard.append([InlineKeyboardButton("🛒 Order This Item", callback_data=f"order_{shop_id}_{product_id}")])

            # ✅ Always try to provide a Back to Products button if we can find the category
            if current_category:
                keyboard.append([InlineKeyboardButton("⬅️ Back to Products", callback_data=f"category_{shop_id}_{current_category}")])
            else:
                keyboard.append([InlineKeyboardButton("⬅️ Back to Categories", callback_data=f"shop_{shop_id}")])

            reply_markup = InlineKeyboardMarkup(keyboard)

            # Update user session
            user_cache.set_user_session(telegram_id, {
                'current_shop': shop_id,
                'current_view': 'product',
                'current_product': product_id,
                'current_category': current_category  # ✅ This will now be set even if it wasn't before
            })

            # ✅ Send photo if available, otherwise send text
            if product_data.get('images') and len(product_data['images']) > 0:
                # Delete old callback message safely
                try:
                    await update.callback_query.message.delete()
                except:
                    pass  # Ignore if already deleted

                await context.bot.send_photo(
                    chat_id=update.effective_chat.id,
                    photo=product_data['images'][0],
                    caption=text,
                    reply_markup=reply_markup,
                    parse_mode='Markdown'
                )
            else:
                # Text-only
                if update.callback_query:
                    await update.callback_query.edit_message_text(
                        text=text,
                        reply_markup=reply_markup,
                        parse_mode='Markdown'
                    )
                else:
                    await update.message.reply_text(
                        text=text,
                        reply_markup=reply_markup,
                        parse_mode='Markdown'
                    )

        except Exception as e:
            logger.error(f"Error showing product details: {e}")
            await self.send_error_message(update, "Failed to load product details")

    async def handle_order(self, update: Update, context: ContextTypes.DEFAULT_TYPE, shop_id: str, product_id: str):
        """Handle product order safely with photos"""
        try:
            telegram_id = update.effective_user.id
            user = update.effective_user

            product_data = await self.get_product_data(product_id)
            shop_data = await self.get_shop_data(shop_id)
            if not product_data or not shop_data:
                await self.send_error_message(update, "Product or shop not found")
                return

            # Create order data for Firebase
            order_data = {
                'shopId': shop_id,
                'customerId': user.username or f'user_{telegram_id}',
                'customerName': user.first_name or user.username or f'User {telegram_id}',
                'telegramId': str(telegram_id),
                'telegramUsername': user.username,
                'items': [{
                    'productId': product_id,
                    'productName': product_data['name'],
                    'quantity': 1,
                    'price': product_data['price'],
                    'total': product_data['price']
                }],
                'total': product_data['price'],
                'status': 'pending',
                'paymentStatus': 'pending',
                'deliveryMethod': 'pickup',
                'paymentPreference': 'cash',
                'tableNumber': f'TG-{telegram_id}',
                'source': 'telegram',
                'createdAt': datetime.now(),
                'updatedAt': datetime.now()
            }

            # Add order to Firebase
            try:
                order_ref = db.collection('orders')
                doc_ref = order_ref.document()  # Generate document reference
                order_id = doc_ref.id
                
                # Add the ID to the order data
                order_data['id'] = order_id
                
                # Set the document with the data
                doc_ref.set(order_data)
                
                logger.info(f"Order saved to Firebase with ID: {order_id}")
            except Exception as firebase_error:
                logger.error(f"Failed to save order to Firebase: {firebase_error}")
                await self.send_error_message(update, "Failed to save order. Please try again.")
                return

            # Send order for approval to admin chat
            try:
                # Get cashier department for approval
                departments_ref = db.collection('departments').where('role', '==', 'cashier')
                departments = departments_ref.stream()
                
                approval_chat_id = None
                for dept in departments:
                    dept_data = dept.to_dict()
                    if dept_data.get('shopId') == shop_id:
                        approval_chat_id = dept_data.get('telegramChatId')
                        break
                
                if approval_chat_id:
                    # Send order for approval
                    approval_message = f"""
🛍️ <b>New Telegram Order Pending Approval</b>

📋 Order ID: #{order_id[-6:]}
👤 Customer: {order_data['customerName']}
📱 Telegram: @{user.username or 'N/A'} (ID: {telegram_id})
🏪 Shop: {shop_data['name']}
💰 Total: ${product_data['price']:.2f}

📦 <b>Items:</b>
• {product_data['name']} × 1 = ${product_data['price']:.2f}

⏰ Ordered: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
📱 Source: Telegram Bot

<i>Please approve or reject this order</i>
                    """.strip()
                    
                    # Send approval message
                    import requests
                    bot_token = None
                    
                    # Get bot token from user settings
                    try:
                        # Find shop owner
                        shop_ref = db.collection('shops').document(shop_id)
                        shop_doc = shop_ref.get()
                        if shop_doc.exists:
                            owner_id = shop_doc.to_dict().get('ownerId')
                            if owner_id:
                                user_ref = db.collection('users').document(owner_id)
                                user_doc = user_ref.get()
                                if user_doc.exists:
                                    bot_token = user_doc.to_dict().get('telegramBotToken')
                    except Exception as e:
                        logger.error(f"Error getting bot token: {e}")
                    
                    if bot_token:
                        telegram_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                        telegram_data = {
                            'chat_id': approval_chat_id,
                            'text': approval_message,
                            'parse_mode': 'HTML'
                        }
                        
                        response = requests.post(telegram_url, json=telegram_data)
                        if response.status_code == 200:
                            logger.info(f"Order approval message sent for order {order_id}")
                        else:
                            logger.error(f"Failed to send approval message: {response.text}")
            
            except Exception as approval_error:
                logger.error(f"Error sending order for approval: {approval_error}")

            # Confirmation text
            confirmation_text = f"""
✅ **Order Request Sent!**

🛍️ **Product:** {product_data['name']}
💰 **Price:** ${product_data['price']:.2f}
🏪 **Shop:** {shop_data['name']}
🆔 **Order ID:** {order_id}

📞 The shop owner will contact you shortly to confirm your order.
            """.strip()

            keyboard = [[InlineKeyboardButton("⬅️ Back to Product", callback_data=f"product_{shop_id}_{product_id}")]]
            reply_markup = InlineKeyboardMarkup(keyboard)

            # Delete old message safely (photo or text)
            try:
                await update.callback_query.message.delete()
            except:
                pass

            # Send as new message
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text=confirmation_text,
                reply_markup=reply_markup,
                parse_mode='Markdown'
            )

            logger.info(f"Order request: User {telegram_id} ordered {product_data['name']} from shop {shop_id} - Order ID: {order_id}")

        except Exception as e:
            logger.error(f"Error handling order: {e}")
            await self.send_error_message(update, "Failed to process order")

    async def button_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle inline keyboard button callbacks"""
        try:
            query = update.callback_query
            await query.answer()

            data = query.data
            telegram_id = update.effective_user.id

            logger.info(f"Button callback: {data} from user {telegram_id}")

            if data.startswith('shop_'):
                shop_id = data.split('_')[1]
                shop_data = await self.get_shop_data(shop_id)
                if shop_data:
                    await self.show_shop_menu(update, context, shop_id, shop_data)

            elif data.startswith('category_'):
                parts = data.split('_')
                shop_id, category_id = parts[1], parts[2]
                await self.show_category_products(update, context, shop_id, category_id)

            elif data.startswith('product_'):
                parts = data.split('_')
                shop_id, product_id = parts[1], parts[2]
                await self.show_product_details(update, context, shop_id, product_id)

            elif data.startswith('order_'):
                parts = data.split('_')
                shop_id, product_id = parts[1], parts[2]
                await self.handle_order(update, context, shop_id, product_id)

        except Exception as e:
            logger.error(f"Error in button callback: {e}")
            await self.send_error_message(update, "Something went wrong")

    # Product Management Methods
    async def start_add_product(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        """Start the add product conversation"""
        query = update.callback_query
        await query.answer()
        
        shop_id = query.data.split('_')[2]
        telegram_id = update.effective_user.id
        
        # Verify admin status
        if not await self.is_admin_user(telegram_id, shop_id):
            await query.edit_message_text("❌ You don't have permission to add products.")
            return ConversationHandler.END
        
        # Store shop_id in context
        context.user_data['shop_id'] = shop_id
        context.user_data['product_data'] = {}
        
        await query.edit_message_text(
            "➕ **Add New Product**\n\nPlease enter the product name:",
            parse_mode='Markdown'
        )
        
        return PRODUCT_NAME
    
    async def get_product_name(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        """Get product name from user"""
        product_name = update.message.text.strip()
        
        if len(product_name) < 2:
            await update.message.reply_text("❌ Product name must be at least 2 characters long. Please try again:")
            return PRODUCT_NAME
        
        context.user_data['product_data']['name'] = product_name
        
        await update.message.reply_text(
            f"✅ Product name: **{product_name}**\n\nNow enter the product description:",
            parse_mode='Markdown'
        )
        
        return PRODUCT_DESCRIPTION
    
    async def get_product_description(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        """Get product description from user"""
        description = update.message.text.strip()
        context.user_data['product_data']['description'] = description
        
        await update.message.reply_text(
            f"✅ Description: **{description}**\n\nNow enter the product price (numbers only, e.g., 25.99):",
            parse_mode='Markdown'
        )
        
        return PRODUCT_PRICE
    
    async def get_product_price(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        """Get product price from user"""
        try:
            price = float(update.message.text.strip())
            if price <= 0:
                raise ValueError("Price must be positive")
            
            context.user_data['product_data']['price'] = price
            
            await update.message.reply_text(
                f"✅ Price: **${price:.2f}**\n\nNow enter the stock quantity (whole number):",
                parse_mode='Markdown'
            )
            
            return PRODUCT_STOCK
            
        except ValueError:
            await update.message.reply_text("❌ Please enter a valid price (e.g., 25.99):")
            return PRODUCT_PRICE
    
    async def get_product_stock(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        """Get product stock from user"""
        try:
            stock = int(update.message.text.strip())
            if stock < 0:
                raise ValueError("Stock cannot be negative")
            
            context.user_data['product_data']['stock'] = stock
            
            await update.message.reply_text(
                f"✅ Stock: **{stock}**\n\nNow choose a category for your product:",
                parse_mode='Markdown'
            )
            
            # Show category selection
            await self.show_category_selection(update, context)
            
            return PRODUCT_CATEGORY
            
        except ValueError:
            await update.message.reply_text("❌ Please enter a valid stock quantity (whole number):")
            return PRODUCT_STOCK
    
    async def show_category_selection(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Show available categories for selection"""
        shop_id = context.user_data['shop_id']
        
        try:
            categories = await self.get_shop_categories(shop_id)
            
            keyboard = []
            
            # Add existing categories
            for category in categories:
                keyboard.append([InlineKeyboardButton(
                    f"{category.get('icon', '📦')} {category['name']}", 
                    callback_data=f"category_select_{category['id']}"
                )])
            
            # Add option to create new category
            keyboard.append([InlineKeyboardButton("➕ Create New Category", callback_data="create_new_category")])
            
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await update.message.reply_text(
                "📂 **Select a category:**",
                reply_markup=reply_markup,
                parse_mode='Markdown'
            )
            
        except Exception as e:
            logger.error(f"Error showing category selection: {e}")
            await update.message.reply_text("❌ Error loading categories. Please try again.")
    
    async def handle_category_selection(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        """Handle category selection or creation"""
        query = update.callback_query
        await query.answer()
        
        if query.data == "create_new_category":
            await query.edit_message_text(
                "➕ **Create New Category**\n\nPlease enter the new category name:",
                parse_mode='Markdown'
            )
            context.user_data['creating_category'] = True
            return PRODUCT_CATEGORY
        
        elif query.data.startswith("category_select_"):
            category_id = query.data.split('_')[2]
            
            # Get category name
            try:
                category_data = await self.get_category_data(category_id)
                if category_data:
                    context.user_data['product_data']['category'] = category_data['name']
                    context.user_data['product_data']['category_id'] = category_id
                    
                    await query.edit_message_text(
                        f"✅ Category: **{category_data['name']}**\n\n📸 Now send product images (or type 'skip' to continue without images):",
                        parse_mode='Markdown'
                    )
                    
                    return PRODUCT_IMAGES
                else:
                    await query.edit_message_text("❌ Category not found. Please try again.")
                    await self.show_category_selection(update, context)
                    return PRODUCT_CATEGORY
                    
            except Exception as e:
                logger.error(f"Error getting category data: {e}")
                await query.edit_message_text("❌ Error loading category. Please try again.")
                return PRODUCT_CATEGORY
        
        # Handle new category creation
        elif context.user_data.get('creating_category'):
            category_name = update.message.text.strip()
            
            if len(category_name) < 2:
                await update.message.reply_text("❌ Category name must be at least 2 characters long. Please try again:")
                return PRODUCT_CATEGORY
            
            try:
                # Create new category
                shop_id = context.user_data['shop_id']
                
                # Get shop owner ID
                shop_data = await self.get_shop_data(shop_id)
                if not shop_data:
                    await update.message.reply_text("❌ Shop not found. Please try again.")
                    return ConversationHandler.END
                
                # Create category document
                category_data = {
                    'name': category_name,
                    'description': f'Category for {category_name}',
                    'color': '#3B82F6',
                    'icon': '📦',
                    'order': 0,
                    'userId': shop_data.get('ownerId'),
                    'shopId': shop_id,
                    'createdAt': datetime.now(),
                    'updatedAt': datetime.now()
                }
                
                doc_ref = db.collection('categories').document()
                doc_ref.set(category_data)
                
                context.user_data['product_data']['category'] = category_name
                context.user_data['product_data']['category_id'] = doc_ref.id
                context.user_data['creating_category'] = False
                
                await update.message.reply_text(
                    f"✅ Created new category: **{category_name}**\n\n📸 Now send product images (or type 'skip' to continue without images):",
                    parse_mode='Markdown'
                )
                
                return PRODUCT_IMAGES
                
            except Exception as e:
                logger.error(f"Error creating category: {e}")
                await update.message.reply_text("❌ Error creating category. Please try again:")
                return PRODUCT_CATEGORY
    
    async def get_product_images(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        """Get product images from user"""
        if 'product_images' not in context.user_data:
            context.user_data['product_images'] = []
        
        # Get the largest photo size
        photo = update.message.photo[-1]
        file = await context.bot.get_file(photo.file_id)
        
        # Download and upload to ImgBB (you'll need to implement this)
        try:
            # For now, we'll use the Telegram file URL directly
            # In production, you should download and upload to a permanent storage
            image_url = f"https://api.telegram.org/file/bot{self.bot_token}/{file.file_path}"
            context.user_data['product_images'].append(image_url)
            
            image_count = len(context.user_data['product_images'])
            
            await update.message.reply_text(
                f"✅ Added image {image_count}\n\n📸 Send more images or type 'done' to finish:",
                parse_mode='Markdown'
            )
            
            return PRODUCT_IMAGES
            
        except Exception as e:
            logger.error(f"Error processing image: {e}")
            await update.message.reply_text("❌ Error processing image. Please try again or type 'skip':")
            return PRODUCT_IMAGES
    
    async def skip_images(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        """Skip images or finish product creation"""
        text = update.message.text.strip().lower()
        
        if text in ['skip', 'done', 'finish']:
            # Finalize product creation
            await self.create_product(update, context)
            return ConversationHandler.END
        else:
            await update.message.reply_text("📸 Send an image or type 'skip' to continue without images, or 'done' to finish:")
            return PRODUCT_IMAGES
    
    async def create_product(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Create the product in Firebase"""
        try:
            shop_id = context.user_data['shop_id']
            product_data = context.user_data['product_data']
            images = context.user_data.get('product_images', [])
            
            # Create product document
            product_doc = {
                'shopId': shop_id,
                'name': product_data['name'],
                'description': product_data['description'],
                'price': product_data['price'],
                'stock': product_data['stock'],
                'category': product_data['category'],
                'images': images,
                'isActive': True,
                'lowStockAlert': 5,
                'createdAt': datetime.now(),
                'updatedAt': datetime.now()
            }
            
            # Add to Firebase
            doc_ref = db.collection('products').document()
            doc_ref.set(product_doc)
            
            # Success message
            success_text = f"""
✅ **Product Created Successfully!**

🛍️ **Name:** {product_data['name']}
📝 **Description:** {product_data['description']}
💰 **Price:** ${product_data['price']:.2f}
📦 **Stock:** {product_data['stock']}
📂 **Category:** {product_data['category']}
📸 **Images:** {len(images)} uploaded

The product is now available in your shop! 🎉
            """.strip()
            
            await update.message.reply_text(success_text, parse_mode='Markdown')
            
            # Clear context data
            context.user_data.clear()
            
        except Exception as e:
            logger.error(f"Error creating product: {e}")
            await update.message.reply_text("❌ Error creating product. Please try again later.")
    
    async def cancel_product_creation(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        """Cancel product creation"""
        context.user_data.clear()
        await update.message.reply_text("❌ Product creation cancelled.")
        return ConversationHandler.END

    async def new_chat_members(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle new chat members"""
        try:
            chat_id = str(update.effective_chat.id)

            # Check if this is a shop channel
            shop_data = await self.get_shop_by_chat_id(chat_id)
            if not shop_data:
                return

            shop_id = shop_data['id']

            for member in update.message.new_chat_members:
                if member.is_bot:
                    continue

                telegram_id = member.id

                # Create or update user
                await self.get_or_create_user(member)

                # Update user's shop interaction
                await self.update_user_shop_interaction(telegram_id, shop_id)

                # Add to cache
                user_cache.add_shop_member(shop_id, telegram_id)

                logger.info(f"New member {telegram_id} joined shop {shop_id}")

        except Exception as e:
            logger.error(f"Error handling new chat members: {e}")

    async def track_chat_members(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Track chat member updates"""
        try:
            chat_member_update = update.chat_member
            if not chat_member_update:
                return

            chat_id = str(chat_member_update.chat.id)
            user = chat_member_update.new_chat_member.user

            if user.is_bot:
                return

            # Check if this is a shop channel
            shop_data = await self.get_shop_by_chat_id(chat_id)
            if not shop_data:
                return

            shop_id = shop_data['id']
            telegram_id = user.id

            # Handle member status changes
            old_status = chat_member_update.old_chat_member.status
            new_status = chat_member_update.new_chat_member.status

            if new_status in [ChatMember.MEMBER, ChatMember.ADMINISTRATOR, ChatMember.OWNER]:
                # User joined or became active
                await self.get_or_create_user(user)
                await self.update_user_shop_interaction(telegram_id, shop_id)
                user_cache.add_shop_member(shop_id, telegram_id)

                logger.info(f"User {telegram_id} joined/activated in shop {shop_id}")

        except Exception as e:
            logger.error(f"Error tracking chat members: {e}")

    async def update_user_shop_interaction(self, telegram_id: int, shop_id: str):
        """Update user's last shop interaction in Firebase and cache"""
        try:
            now = datetime.now().isoformat()

            # Update Firebase
            user_ref = db.collection('users').document(str(telegram_id))
            user_ref.update({
                'last_shop_id': shop_id,
                f'shops.{shop_id}.last_interacted': now
            })

            # Update cache
            user_cache.update_user_shop(telegram_id, shop_id)

            logger.info(f"Updated shop interaction: user {telegram_id} -> shop {shop_id}")

        except Exception as e:
            logger.error(f"Error updating user shop interaction: {e}")

    # Firebase query methods
    async def get_shop_categories(self, shop_id: str) -> list:
        """Get categories for a shop"""
        try:
            categories_ref = db.collection('categories').where('shopId', '==', shop_id)
            categories = categories_ref.stream()

            result = []
            for cat in categories:
                cat_data = cat.to_dict()
                cat_data['id'] = cat.id
                result.append(cat_data)

            # Sort by order
            result.sort(key=lambda x: x.get('order', 0))
            return result

        except Exception as e:
            logger.error(f"Error getting shop categories: {e}")
            return []

    async def get_category_data(self, category_id: str) -> Optional[Dict]:
        """Get category data"""
        try:
            cat_ref = db.collection('categories').document(category_id)
            cat_doc = cat_ref.get()

            if cat_doc.exists:
                return cat_doc.to_dict()
            return None

        except Exception as e:
            logger.error(f"Error getting category data: {e}")
            return None

    async def get_category_products(self, shop_id: str, category_id: str) -> list:
        """Get products in a category"""
        try:
            # Get category name first
            category_data = await self.get_category_data(category_id)
            if not category_data:
                return []

            category_name = category_data['name']

            # Query products by category name and shop
            products_ref = db.collection('products').where('shopId', '==', shop_id).where('category', '==', category_name)
            products = products_ref.stream()

            result = []
            for prod in products:
                prod_data = prod.to_dict()
                prod_data['id'] = prod.id
                result.append(prod_data)

            return result

        except Exception as e:
            logger.error(f"Error getting category products: {e}")
            return []

    async def get_product_data(self, product_id: str) -> Optional[Dict]:
        """Get product data"""
        try:
            prod_ref = db.collection('products').document(product_id)
            prod_doc = prod_ref.get()

            if prod_doc.exists:
                return prod_doc.to_dict()
            return None

        except Exception as e:
            logger.error(f"Error getting product data: {e}")
            return None

    async def get_shop_data(self, shop_id: str) -> Optional[Dict]:
        """Get shop data"""
        try:
            shop_ref = db.collection('shops').document(shop_id)
            shop_doc = shop_ref.get()

            if shop_doc.exists:
                shop_data = shop_doc.to_dict()
                shop_data['id'] = shop_id
                return shop_data
            return None

        except Exception as e:
            logger.error(f"Error getting shop data: {e}")
            return None

    async def get_shop_by_chat_id(self, chat_id: str) -> Optional[Dict]:
        """Get shop by Telegram chat ID"""
        try:
            # Query departments to find shop by chat ID
            departments_ref = db.collection('departments').where('telegramChatId', '==', chat_id)
            departments = departments_ref.stream()

            for dept in departments:
                dept_data = dept.to_dict()
                shop_id = dept_data.get('shopId')
                if shop_id:
                    return await self.get_shop_data(shop_id)

            return None

        except Exception as e:
            logger.error(f"Error getting shop by chat ID: {e}")
            return None

def main():
    """Main function"""
    # Get bot token from environment or config
    bot_token = os.getenv('TELEGRAM_BOT_TOKEN')

    if not bot_token:
        logger.error("TELEGRAM_BOT_TOKEN environment variable not set")
        return

    # Create and run bot
    bot = TelegramBot(bot_token)
    bot.run()

if __name__ == '__main__':
    main()