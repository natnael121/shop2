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
    ChatMemberHandler, ContextTypes, MessageHandler, filters
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

            # Get categories for this shop
            categories = await self.get_shop_categories(shop_id)
            logger.info(f"Found {len(categories)} categories for shop {shop_id}")

            if not categories:
                text = f"🏪 **{shop_data['name']}**\n\n❌ No categories available yet."
                keyboard = [[InlineKeyboardButton("🔄 Refresh", callback_data=f"shop_{shop_id}")]]
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

            # ✅ Save order to Firebase
            order_data = {
                'user': {
                    'telegram_id': telegram_id,
                    'username': user.username,
                    'first_name': user.first_name,
                    'last_name': user.last_name
                },
                'shop': {
                    'id': shop_id,
                    'name': shop_data['name']
                },
                'product': {
                    'id': product_id,
                    'name': product_data['name'],
                    'price': product_data['price'],
                    'sku': product_data.get('sku', ''),
                    'category': product_data.get('category', '')
                },
                'order_status': 'pending',
                'created_at': datetime.now().isoformat(),
                'total_amount': product_data['price'],
                'quantity': 1
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