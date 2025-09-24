#!/usr/bin/env python3
"""
Multi-Shop Telegram Bot with User Caching and Shop Navigation
Enhanced with proper product and category management and order processing
"""

import os
import sys
import logging
import asyncio
from datetime import datetime, timezone
from typing import Dict, Set, Optional, List, Any
import json

# Telegram Bot imports
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, BotCommand
from telegram.ext import (
    Application, CommandHandler, CallbackQueryHandler, 
    MessageHandler, filters, ContextTypes
)

# Firebase imports
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

class UserCache:
    """In-memory cache for user data and shop interactions"""
    
    def __init__(self):
        self.users: Dict[int, Dict] = {}
        self.shop_members: Dict[str, Set[int]] = {}
        self.user_sessions: Dict[int, Dict] = {}
    
    def add_user(self, telegram_id: int, user_data: Dict):
        """Add or update user in cache"""
        self.users[telegram_id] = {
            'telegram_id': telegram_id,
            'username': user_data.get('username'),
            'first_name': user_data.get('first_name'),
            'last_name': user_data.get('last_name'),
            'created_at': datetime.now(timezone.utc).isoformat(),
            'last_shop_id': user_data.get('last_shop_id'),
            'shops': user_data.get('shops', {}),
            **user_data
        }
        logger.info(f"Cached user {telegram_id}: {user_data.get('first_name', 'Unknown')}")
    
    def get_user(self, telegram_id: int) -> Optional[Dict]:
        """Get user from cache"""
        return self.users.get(telegram_id)
    
    def update_shop_interaction(self, telegram_id: int, shop_id: str):
        """Update user's last shop interaction"""
        if telegram_id in self.users:
            now = datetime.now(timezone.utc).isoformat()
            self.users[telegram_id]['last_shop_id'] = shop_id
            if 'shops' not in self.users[telegram_id]:
                self.users[telegram_id]['shops'] = {}
            self.users[telegram_id]['shops'][shop_id] = {'last_interacted': now}
    
    def add_shop_member(self, shop_id: str, telegram_id: int):
        """Add user to shop members"""
        if shop_id not in self.shop_members:
            self.shop_members[shop_id] = set()
        self.shop_members[shop_id].add(telegram_id)
    
    def get_shop_members(self, shop_id: str) -> List[int]:
        """Get all members of a shop"""
        return list(self.shop_members.get(shop_id, set()))
    
    def set_user_session(self, telegram_id: int, key: str, value: Any):
        """Set session data for user"""
        if telegram_id not in self.user_sessions:
            self.user_sessions[telegram_id] = {}
        self.user_sessions[telegram_id][key] = value
    
    def get_user_session(self, telegram_id: int, key: str, default=None):
        """Get session data for user"""
        return self.user_sessions.get(telegram_id, {}).get(key, default)
    
    def clear_user_session(self, telegram_id: int, key: str = None):
        """Clear session data for user"""
        if telegram_id in self.user_sessions:
            if key:
                self.user_sessions[telegram_id].pop(key, None)
            else:
                self.user_sessions[telegram_id].clear()

class TelegramBot:
    """Main Telegram Bot class with Firebase integration"""
    
    def __init__(self, bot_token: str):
        self.bot_token = bot_token
        self.user_cache = UserCache()
        self.db = None
        self.shop_owners = {}  # Cache for shop owners: {shop_id: owner_telegram_id}
        self.initialize_firebase()
        asyncio.create_task(self.load_shop_owners())
    
    def initialize_firebase(self):
        """Initialize Firebase connection"""
        try:
            # Initialize Firebase Admin SDK
            if not firebase_admin._apps:
                cred = credentials.Certificate('serviceAccountKey.json')
                firebase_admin.initialize_app(cred)
            
            self.db = firestore.client()
            logger.info("Firebase initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Firebase: {e}")
            sys.exit(1)
    
    async def load_shop_owners(self):
        """Load shop owners from departments collection"""
        try:
            # Get all owner departments
            departments_ref = self.db.collection('departments').where('role', '==', 'owner')
            departments = departments_ref.stream()
            
            for dept in departments:
                dept_data = dept.to_dict()
                shop_id = dept_data.get('shopId')
                telegram_id = dept_data.get('telegramChatId')  # For owner role, this is personal ID
                
                if shop_id and telegram_id:
                    try:
                        # Convert to int and store
                        self.shop_owners[shop_id] = int(telegram_id)
                        logger.info(f"Loaded shop owner: shop {shop_id} -> owner {telegram_id}")
                    except ValueError:
                        logger.warning(f"Invalid owner Telegram ID: {telegram_id}")
            
            logger.info(f"Loaded {len(self.shop_owners)} shop owners")
        except Exception as e:
            logger.error(f"Error loading shop owners: {e}")
    
    async def is_shop_owner_by_telegram_id(self, telegram_id: int, shop_id: str) -> bool:
        """Check if Telegram user is the owner of the shop"""
        return self.shop_owners.get(shop_id) == telegram_id
    
    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /start command"""
        user = update.effective_user
        chat_id = update.effective_chat.id
        
        # Cache user data
        user_data = {
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
        }
        self.user_cache.add_user(user.id, user_data)
        
        # Save user to Firebase
        await self.save_user_to_firebase(user.id, user_data)
        
        # Check if user has a last interacted shop
        cached_user = self.user_cache.get_user(user.id)
        if cached_user and cached_user.get('last_shop_id'):
            shop_data = await self.get_shop_data(cached_user['last_shop_id'])
            if shop_data:
                await self.send_shop_menu(chat_id, shop_data, user.id, context)
                return
        
        # Show welcome message with available shops
        await self.send_welcome_message(chat_id, user.first_name, context)
    
    async def save_user_to_firebase(self, telegram_id: int, user_data: Dict):
        """Save user data to Firebase"""
        try:
            user_ref = self.db.collection('users').document(str(telegram_id))
            user_doc = user_ref.get()
            
            if user_doc.exists:
                # Update existing user
                user_ref.update({
                    'username': user_data.get('username'),
                    'first_name': user_data.get('first_name'),
                    'last_name': user_data.get('last_name'),
                    'updated_at': datetime.now(timezone.utc)
                })
            else:
                # Create new user
                user_ref.set({
                    'telegram_id': telegram_id,
                    'username': user_data.get('username'),
                    'first_name': user_data.get('first_name'),
                    'last_name': user_data.get('last_name'),
                    'created_at': datetime.now(timezone.utc),
                    'updated_at': datetime.now(timezone.utc),
                    'shops': {},
                    'last_shop_id': None
                })
            
            logger.info(f"Saved user {telegram_id} to Firebase")
        except Exception as e:
            logger.error(f"Error saving user to Firebase: {e}")
    
    async def send_welcome_message(self, chat_id: int, first_name: str, context: ContextTypes.DEFAULT_TYPE):
        """Send welcome message with available shops"""
        try:
            # Get all active shops
            shops_ref = self.db.collection('shops').where('isActive', '==', True)
            shops = shops_ref.stream()
            
            text = f"👋 Welcome {first_name}!\n\n"
            text += "🏪 Choose a shop to browse:\n\n"
            
            keyboard = []
            shop_count = 0
            
            for shop in shops:
                shop_data = shop.to_dict()
                shop_count += 1
                keyboard.append([InlineKeyboardButton(
                    f"🏪 {shop_data['name']}", 
                    callback_data=f"shop_{shop.id}"
                )])
            
            if shop_count == 0:
                text += "❌ No shops available at the moment."
                keyboard = []
            else:
                keyboard.append([InlineKeyboardButton("🔄 Refresh", callback_data="refresh_shops")])
            
            reply_markup = InlineKeyboardMarkup(keyboard) if keyboard else None
            
            await context.bot.send_message(
                chat_id=chat_id,
                text=text,
                reply_markup=reply_markup
            )
            
        except Exception as e:
            logger.error(f"Error sending welcome message: {e}")
            await context.bot.send_message(
                chat_id=chat_id,
                text="❌ Error loading shops. Please try again later."
            )
    
    async def get_shop_data(self, shop_id: str) -> Optional[Dict]:
        """Get shop data from Firebase"""
        try:
            shop_ref = self.db.collection('shops').document(shop_id)
            shop_doc = shop_ref.get()
            
            if shop_doc.exists:
                return {'id': shop_id, **shop_doc.to_dict()}
            return None
        except Exception as e:
            logger.error(f"Error getting shop data: {e}")
            return None
    
    async def send_shop_menu(self, chat_id: int, shop_data: Dict, user_id: int, context: ContextTypes.DEFAULT_TYPE):
        """Send shop menu with categories"""
        try:
            # Update user's shop interaction
            self.user_cache.update_shop_interaction(user_id, shop_data['id'])
            await self.update_user_shop_interaction(user_id, shop_data['id'])
            
            # Get shop categories
            categories = await self.get_shop_categories(shop_data['id'])
            
            text = f"🏪 **{shop_data['name']}**\n\n"
            
            if shop_data.get('description'):
                text += f"{shop_data['description']}\n\n"
            
            # Check if user is shop owner for admin functions
            is_owner = await self.is_shop_owner(user_id, shop_data['id'])
            is_telegram_owner = await self.is_shop_owner_by_telegram_id(user_id, shop_data['id'])
            
            if is_owner or is_telegram_owner:
                text += "👑 **Admin Panel**\n\n"
            
            if not categories:
                text += "📂 No categories available yet."
                if is_owner or is_telegram_owner:
                    text += "\n\n➕ Use the buttons below to add categories and products."
            else:
                text += "📂 Choose a category:"
            
            keyboard = []
            
            # Add category buttons
            for category in categories:
                keyboard.append([InlineKeyboardButton(
                    f"{category.get('icon', '📦')} {category['name']}", 
                    callback_data=f"category_{shop_data['id']}_{category['id']}"
                )])
            
            # Admin buttons for shop owners
            if is_owner or is_telegram_owner:
                admin_row = []
                admin_row.append(InlineKeyboardButton("➕ Add Category", callback_data=f"add_category_{shop_data['id']}"))
                admin_row.append(InlineKeyboardButton("➕ Add Product", callback_data=f"add_product_{shop_data['id']}"))
                keyboard.append(admin_row)
                
                keyboard.append([InlineKeyboardButton("📊 Shop Stats", callback_data=f"shop_stats_{shop_data['id']}")])
                keyboard.append([InlineKeyboardButton("⚙️ Shop Settings", callback_data=f"shop_settings_{shop_data['id']}")])
                keyboard.append([InlineKeyboardButton("👥 Manage Staff", callback_data=f"manage_staff_{shop_data['id']}")])
                keyboard.append([InlineKeyboardButton("📈 View Analytics", callback_data=f"view_analytics_{shop_data['id']}")])
                keyboard.append([InlineKeyboardButton("🔔 Send Announcement", callback_data=f"send_announcement_{shop_data['id']}")])
            
            keyboard.append([InlineKeyboardButton("🔄 Refresh Menu", callback_data=f"shop_{shop_data['id']}")])
            keyboard.append([InlineKeyboardButton("⬅️ Back to Shops", callback_data="refresh_shops")])
            
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await context.bot.send_message(
                chat_id=chat_id,
                text=text,
                reply_markup=reply_markup,
                parse_mode='Markdown'
            )
            
        except Exception as e:
            logger.error(f"Error sending shop menu: {e}")
            await context.bot.send_message(
                chat_id=chat_id,
                text="❌ Error loading shop menu. Please try again."
            )
    
    async def is_shop_owner(self, user_id: int, shop_id: str) -> bool:
        """Check if user is the owner of the shop"""
        try:
            # Get user document from Firebase to find their UID
            user_ref = self.db.collection('users').document(str(user_id))
            user_doc = user_ref.get()
            
            if not user_doc.exists:
                return False
            
            user_data = user_doc.to_dict()
            firebase_uid = user_data.get('firebase_uid')
            
            if not firebase_uid:
                return False
            
            # Check if this Firebase UID owns the shop
            shop_ref = self.db.collection('shops').document(shop_id)
            shop_doc = shop_ref.get()
            
            if shop_doc.exists:
                shop_data = shop_doc.to_dict()
                return shop_data.get('ownerId') == firebase_uid
            
            return False
        except Exception as e:
            logger.error(f"Error checking shop ownership: {e}")
            return False
    
    async def update_user_shop_interaction(self, telegram_id: int, shop_id: str):
        """Update user's shop interaction in Firebase"""
        try:
            user_ref = self.db.collection('users').document(str(telegram_id))
            now = datetime.now(timezone.utc)
            
            user_ref.update({
                'last_shop_id': shop_id,
                f'shops.{shop_id}.last_interacted': now,
                'updated_at': now
            })
            
        except Exception as e:
            logger.error(f"Error updating user shop interaction: {e}")
    
    async def get_shop_categories(self, shop_id: str) -> List[Dict]:
        """Get categories for a shop"""
        try:
            categories_ref = self.db.collection('categories').where('shopId', '==', shop_id)
            categories = categories_ref.stream()
            
            category_list = []
            for category in categories:
                category_data = category.to_dict()
                category_data['id'] = category.id
                category_list.append(category_data)
            
            # Sort by order
            category_list.sort(key=lambda x: x.get('order', 0))
            return category_list
            
        except Exception as e:
            logger.error(f"Error getting shop categories: {e}")
            return []
    
    async def send_category_products(self, chat_id: int, shop_id: str, category_id: str, user_id: int, context: ContextTypes.DEFAULT_TYPE):
        """Send products in a category"""
        try:
            # Get category data
            category_ref = self.db.collection('categories').document(category_id)
            category_doc = category_ref.get()
            
            if not category_doc.exists:
                await context.bot.send_message(chat_id, "❌ Category not found.")
                return
            
            category_data = category_doc.to_dict()
            
            # Get products in this category
            products_ref = self.db.collection('products').where('shopId', '==', shop_id).where('category', '==', category_data['name'])
            products = products_ref.stream()
            
            text = f"📂 **{category_data['name']}**\n\n"
            
            if category_data.get('description'):
                text += f"{category_data['description']}\n\n"
            
            keyboard = []
            product_count = 0
            
            for product in products:
                product_data = product.to_dict()
                if product_data.get('isActive', True) and product_data.get('stock', 0) > 0:
                    product_count += 1
                    price_text = f"${product_data['price']:.2f}"
                    stock_text = f" ({product_data['stock']} left)" if product_data['stock'] <= 10 else ""
                    
                    keyboard.append([InlineKeyboardButton(
                        f"{product_data['name']} - {price_text}{stock_text}",
                        callback_data=f"product_{shop_id}_{product.id}"
                    )])
            
            if product_count == 0:
                text += "❌ No products available in this category."
            else:
                text += f"🛍️ Choose a product ({product_count} available):"
            
            # Check if user is shop owner
            is_owner = await self.is_shop_owner(user_id, shop_id)
            is_telegram_owner = await self.is_shop_owner_by_telegram_id(user_id, shop_id)
            if is_owner or is_telegram_owner:
                keyboard.append([InlineKeyboardButton("➕ Add Product to Category", callback_data=f"add_product_category_{shop_id}_{category_id}")])
            
            keyboard.append([InlineKeyboardButton("⬅️ Back to Categories", callback_data=f"shop_{shop_id}")])
            
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await context.bot.send_message(
                chat_id=chat_id,
                text=text,
                reply_markup=reply_markup,
                parse_mode='Markdown'
            )
            
        except Exception as e:
            logger.error(f"Error sending category products: {e}")
            await context.bot.send_message(chat_id, "❌ Error loading products.")
    
    async def send_product_details(self, chat_id: int, shop_id: str, product_id: str, user_id: int, context: ContextTypes.DEFAULT_TYPE):
        """Send product details with order option"""
        try:
            # Get product data
            product_ref = self.db.collection('products').document(product_id)
            product_doc = product_ref.get()
            
            if not product_doc.exists:
                await context.bot.send_message(chat_id, "❌ Product not found.")
                return
            
            product_data = product_doc.to_dict()
            
            # Check if product is available
            is_available = product_data.get('isActive', True) and product_data.get('stock', 0) > 0
            
            text = f"🛍️ **{product_data['name']}**\n\n"
            
            if product_data.get('description'):
                text += f"📝 {product_data['description']}\n\n"
            
            text += f"💰 **Price:** ${product_data['price']:.2f}\n"
            text += f"📦 **Stock:** {product_data['stock']} available\n"
            text += f"🏷️ **Category:** {product_data.get('category', 'N/A')}\n"
            
            if product_data.get('sku'):
                text += f"🔖 **SKU:** {product_data['sku']}\n"
            
            if not is_available:
                text += "\n❌ **Currently unavailable**"
            
            keyboard = []
            
            # Add order button if available
            if is_available:
                keyboard.append([InlineKeyboardButton(
                    "🛒 Order This Item",
                    callback_data=f"order_{shop_id}_{product_id}"
                )])
            
            # Back button - find the category
            category_name = product_data.get('category')
            if category_name:
                # Find category ID by name
                categories = await self.get_shop_categories(shop_id)
                category_id = None
                for cat in categories:
                    if cat['name'] == category_name:
                        category_id = cat['id']
                        break
                
                if category_id:
                    keyboard.append([InlineKeyboardButton("⬅️ Back to Products", callback_data=f"category_{shop_id}_{category_id}")])
                else:
                    keyboard.append([InlineKeyboardButton("⬅️ Back to Categories", callback_data=f"shop_{shop_id}")])
            else:
                keyboard.append([InlineKeyboardButton("⬅️ Back to Categories", callback_data=f"shop_{shop_id}")])
            
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            # Send with image if available
            if product_data.get('images') and len(product_data['images']) > 0:
                await context.bot.send_photo(
                    chat_id=chat_id,
                    photo=product_data['images'][0],
                    caption=text,
                    reply_markup=reply_markup,
                    parse_mode='Markdown'
                )
            else:
                await context.bot.send_message(
                    chat_id=chat_id,
                    text=text,
                    reply_markup=reply_markup,
                    parse_mode='Markdown'
                )
            
        except Exception as e:
            logger.error(f"Error sending product details: {e}")
            await context.bot.send_message(chat_id, "❌ Error loading product details.")
    
    async def handle_order_request(self, chat_id: int, shop_id: str, product_id: str, user_id: int, context: ContextTypes.DEFAULT_TYPE):
        """Handle order request for a product"""
        try:
            # Get product data
            product_ref = self.db.collection('products').document(product_id)
            product_doc = product_ref.get()
            
            if not product_doc.exists:
                await context.bot.send_message(chat_id, "❌ Product not found.")
                return
            
            product_data = product_doc.to_dict()
            
            # Check if product is available
            if not product_data.get('isActive', True) or product_data.get('stock', 0) <= 0:
                await context.bot.send_message(chat_id, "❌ This product is currently unavailable.")
                return
            
            # Get user data
            user = await context.bot.get_chat(user_id)
            customer_name = f"{user.first_name} {user.last_name or ''}".strip()
            
            # Create order in Firebase
            order_data = {
                'shopId': shop_id,
                'customerId': user.username or f"user_{user_id}",
                'customerName': customer_name,
                'telegramId': str(user_id),
                'telegramUsername': user.username,
                'items': [{
                    'productId': product_id,
                    'productName': product_data['name'],
                    'quantity': 1,
                    'price': product_data['price'],
                    'total': product_data['price']
                }],
                'total': product_data['price'],
                'deliveryMethod': 'pickup',
                'paymentPreference': 'cash',
                'tableNumber': f"TG-{user_id}",
                'source': 'telegram',
                'status': 'pending',
                'paymentStatus': 'pending',
                'createdAt': datetime.now(timezone.utc),
                'updatedAt': datetime.now(timezone.utc)
            }
            
            # Save order to Firebase
            order_ref = self.db.collection('orders').add(order_data)
            order_id = order_ref[1].id
            
            # Send confirmation to user
            confirmation_text = f"✅ **Order Request Sent!**\n\n"
            confirmation_text += f"🛍️ **Product:** {product_data['name']}\n"
            confirmation_text += f"💰 **Price:** ${product_data['price']:.2f}\n"
            confirmation_text += f"📋 **Order ID:** #{order_id[-6:]}\n\n"
            confirmation_text += "📞 **Next Steps:**\n"
            confirmation_text += "The shop owner will contact you shortly to confirm your order and arrange payment/delivery.\n\n"
            confirmation_text += "Thank you for your order! 🙏"
            
            keyboard = [[InlineKeyboardButton("⬅️ Back to Product", callback_data=f"product_{shop_id}_{product_id}")]]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await context.bot.send_message(
                chat_id=chat_id,
                text=confirmation_text,
                reply_markup=reply_markup,
                parse_mode='Markdown'
            )
            
            # Send order notification to shop owner/cashier
            await self.notify_shop_about_order(shop_id, order_data, order_id, context)
            
            logger.info(f"Order created: {order_id} by user {user_id} for product {product_id}")
            
        except Exception as e:
            logger.error(f"Error handling order request: {e}")
            await context.bot.send_message(chat_id, "❌ Error processing order. Please try again.")
    
    async def notify_shop_about_order(self, shop_id: str, order_data: Dict, order_id: str, context: ContextTypes.DEFAULT_TYPE):
        """Notify shop about new order"""
        try:
            # Get cashier department for this shop
            departments_ref = self.db.collection('departments').where('shopId', '==', shop_id).where('role', '==', 'cashier')
            departments = departments_ref.stream()
            
            cashier_chat_id = None
            for dept in departments:
                dept_data = dept.to_dict()
                cashier_chat_id = dept_data.get('telegramChatId')
                break
            
            if not cashier_chat_id:
                logger.warning(f"No cashier department found for shop {shop_id}")
                return
            
            # Create order notification message
            items_list = []
            for item in order_data['items']:
                items_list.append(f"• {item['productName']} × {item['quantity']} = ${item['total']:.2f}")
            
            items_text = '\n'.join(items_list)
            
            message = f"""
🛍️ <b>New Telegram Order</b>

📋 Order ID: #{order_id[-6:]}
👤 Customer: {order_data['customerName']}
📱 Telegram: @{order_data.get('telegramUsername', 'N/A')}
🆔 User ID: {order_data['telegramId']}
💰 Total: ${order_data['total']:.2f}
🚚 Method: {order_data['deliveryMethod'].title()}
💳 Payment: {order_data['paymentPreference'].title()}

📦 <b>Items:</b>
{items_text}

⏰ Ordered: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

<i>Please approve or reject this order</i>
            """.strip()
            
            # Send notification to cashier
            await context.bot.send_message(
                chat_id=cashier_chat_id,
                text=message,
                parse_mode='HTML'
            )
            
            logger.info(f"Order notification sent to cashier chat {cashier_chat_id}")
            
        except Exception as e:
            logger.error(f"Error notifying shop about order: {e}")
    
    async def handle_add_category(self, chat_id: int, shop_id: str, user_id: int, context: ContextTypes.DEFAULT_TYPE):
        """Handle add category request"""
        try:
            # Verify user is shop owner
            is_owner = await self.is_shop_owner(user_id, shop_id)
            is_telegram_owner = await self.is_shop_owner_by_telegram_id(user_id, shop_id)
            
            if not (is_owner or is_telegram_owner):
                await context.bot.send_message(chat_id, "❌ You don't have permission to add categories to this shop.")
                return
            
            # Set user session for category creation
            self.user_cache.set_user_session(user_id, 'adding_category', {
                'shop_id': shop_id,
                'step': 'name'
            })
            
            text = "➕ **Add New Category**\n\n"
            text += "📝 Please send the category name:"
            
            keyboard = [[InlineKeyboardButton("❌ Cancel", callback_data=f"shop_{shop_id}")]]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await context.bot.send_message(
                chat_id=chat_id,
                text=text,
                reply_markup=reply_markup,
                parse_mode='Markdown'
            )
            
        except Exception as e:
            logger.error(f"Error handling add category: {e}")
            await context.bot.send_message(chat_id, "❌ Error starting category creation.")
    
    async def handle_add_product(self, chat_id: int, shop_id: str, user_id: int, context: ContextTypes.DEFAULT_TYPE, category_id: str = None):
        """Handle add product request"""
        try:
            # Verify user is shop owner
            is_owner = await self.is_shop_owner(user_id, shop_id)
            is_telegram_owner = await self.is_shop_owner_by_telegram_id(user_id, shop_id)
            
            if not (is_owner or is_telegram_owner):
                await context.bot.send_message(chat_id, "❌ You don't have permission to add products to this shop.")
                return
            
            # Get available categories
            categories = await self.get_shop_categories(shop_id)
            
            if not categories:
                text = "❌ **No Categories Available**\n\n"
                text += "You need to create at least one category before adding products.\n\n"
                text += "Would you like to create a category first?"
                
                keyboard = [
                    [InlineKeyboardButton("➕ Create Category", callback_data=f"add_category_{shop_id}")],
                    [InlineKeyboardButton("⬅️ Back", callback_data=f"shop_{shop_id}")]
                ]
                reply_markup = InlineKeyboardMarkup(keyboard)
                
                await context.bot.send_message(
                    chat_id=chat_id,
                    text=text,
                    reply_markup=reply_markup,
                    parse_mode='Markdown'
                )
                return
            
            if category_id:
                # Adding product to specific category
                category_data = None
                for cat in categories:
                    if cat['id'] == category_id:
                        category_data = cat
                        break
                
                if not category_data:
                    await context.bot.send_message(chat_id, "❌ Category not found.")
                    return
                
                # Set user session for product creation
                self.user_cache.set_user_session(user_id, 'adding_product', {
                    'shop_id': shop_id,
                    'category_id': category_id,
                    'category_name': category_data['name'],
                    'step': 'name'
                })
                
                text = f"➕ **Add Product to {category_data['name']}**\n\n"
                text += "📝 Please send the product name:"
                
            else:
                # Show category selection for product
                text = "➕ **Add New Product**\n\n"
                text += "📂 Choose a category for the product:"
                
                keyboard = []
                for category in categories:
                    keyboard.append([InlineKeyboardButton(
                        f"{category.get('icon', '📦')} {category['name']}", 
                        callback_data=f"add_product_category_{shop_id}_{category['id']}"
                    )])
                
                keyboard.append([InlineKeyboardButton("⬅️ Back", callback_data=f"shop_{shop_id}")])
                reply_markup = InlineKeyboardMarkup(keyboard)
                
                await context.bot.send_message(
                    chat_id=chat_id,
                    text=text,
                    reply_markup=reply_markup,
                    parse_mode='Markdown'
                )
                return
            
            keyboard = [[InlineKeyboardButton("❌ Cancel", callback_data=f"shop_{shop_id}")]]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await context.bot.send_message(
                chat_id=chat_id,
                text=text,
                reply_markup=reply_markup,
                parse_mode='Markdown'
            )
            
        except Exception as e:
            logger.error(f"Error handling add product: {e}")
            await context.bot.send_message(chat_id, "❌ Error starting product creation.")
    
    async def handle_text_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle text messages for category/product creation"""
        user_id = update.effective_user.id
        chat_id = update.effective_chat.id
        text = update.message.text.strip()
        
        # Check if user is adding a category
        adding_category = self.user_cache.get_user_session(user_id, 'adding_category')
        if adding_category:
            await self.process_category_creation(chat_id, user_id, text, adding_category, context)
            return
        
        # Check if user is adding a product
        adding_product = self.user_cache.get_user_session(user_id, 'adding_product')
        if adding_product:
            await self.process_product_creation(chat_id, user_id, text, adding_product, context)
            return
        
        # Default response for unrecognized text
        await context.bot.send_message(
            chat_id=chat_id,
            text="👋 Use /start to begin shopping or browse available shops!"
        )
    
    async def process_category_creation(self, chat_id: int, user_id: int, text: str, session_data: Dict, context: ContextTypes.DEFAULT_TYPE):
        """Process category creation steps"""
        try:
            step = session_data.get('step')
            shop_id = session_data.get('shop_id')
            
            if step == 'name':
                # Store category name and ask for description
                session_data['name'] = text
                session_data['step'] = 'description'
                self.user_cache.set_user_session(user_id, 'adding_category', session_data)
                
                response_text = f"✅ Category name: **{text}**\n\n"
                response_text += "📝 Please send a description for this category (or send 'skip' to skip):"
                
                keyboard = [[InlineKeyboardButton("⏭️ Skip Description", callback_data=f"skip_category_desc_{shop_id}")]]
                reply_markup = InlineKeyboardMarkup(keyboard)
                
                await context.bot.send_message(
                    chat_id=chat_id,
                    text=response_text,
                    reply_markup=reply_markup,
                    parse_mode='Markdown'
                )
                
            elif step == 'description':
                # Store description and ask for icon
                if text.lower() != 'skip':
                    session_data['description'] = text
                
                session_data['step'] = 'icon'
                self.user_cache.set_user_session(user_id, 'adding_category', session_data)
                
                response_text = f"✅ Category: **{session_data['name']}**\n"
                if session_data.get('description'):
                    response_text += f"📝 Description: {session_data['description']}\n\n"
                else:
                    response_text += "\n"
                
                response_text += "🎨 Please send an emoji icon for this category (or send 'skip' for default 📦):"
                
                keyboard = [[InlineKeyboardButton("📦 Use Default Icon", callback_data=f"skip_category_icon_{shop_id}")]]
                reply_markup = InlineKeyboardMarkup(keyboard)
                
                await context.bot.send_message(
                    chat_id=chat_id,
                    text=response_text,
                    reply_markup=reply_markup,
                    parse_mode='Markdown'
                )
                
            elif step == 'icon':
                # Create the category
                if text.lower() != 'skip':
                    session_data['icon'] = text
                else:
                    session_data['icon'] = '📦'
                
                await self.create_category(chat_id, user_id, session_data, context)
                
        except Exception as e:
            logger.error(f"Error processing category creation: {e}")
            await context.bot.send_message(chat_id, "❌ Error creating category. Please try again.")
            self.user_cache.clear_user_session(user_id, 'adding_category')
    
    async def process_product_creation(self, chat_id: int, user_id: int, text: str, session_data: Dict, context: ContextTypes.DEFAULT_TYPE):
        """Process product creation steps"""
        try:
            step = session_data.get('step')
            shop_id = session_data.get('shop_id')
            
            if step == 'name':
                # Store product name and ask for description
                session_data['name'] = text
                session_data['step'] = 'description'
                self.user_cache.set_user_session(user_id, 'adding_product', session_data)
                
                response_text = f"✅ Product name: **{text}**\n\n"
                response_text += "📝 Please send a description for this product (or send 'skip' to skip):"
                
                keyboard = [[InlineKeyboardButton("⏭️ Skip Description", callback_data=f"skip_product_desc_{shop_id}")]]
                reply_markup = InlineKeyboardMarkup(keyboard)
                
                await context.bot.send_message(
                    chat_id=chat_id,
                    text=response_text,
                    reply_markup=reply_markup,
                    parse_mode='Markdown'
                )
                
            elif step == 'description':
                # Store description and ask for price
                if text.lower() != 'skip':
                    session_data['description'] = text
                
                session_data['step'] = 'price'
                self.user_cache.set_user_session(user_id, 'adding_product', session_data)
                
                response_text = f"✅ Product: **{session_data['name']}**\n"
                if session_data.get('description'):
                    response_text += f"📝 Description: {session_data['description']}\n\n"
                else:
                    response_text += "\n"
                
                response_text += "💰 Please send the price (numbers only, e.g., 25.99):"
                
                await context.bot.send_message(
                    chat_id=chat_id,
                    text=response_text,
                    parse_mode='Markdown'
                )
                
            elif step == 'price':
                # Validate and store price, ask for stock
                try:
                    price = float(text)
                    if price <= 0:
                        raise ValueError("Price must be positive")
                    
                    session_data['price'] = price
                    session_data['step'] = 'stock'
                    self.user_cache.set_user_session(user_id, 'adding_product', session_data)
                    
                    response_text = f"✅ Product: **{session_data['name']}**\n"
                    response_text += f"💰 Price: ${price:.2f}\n\n"
                    response_text += "📦 Please send the stock quantity (whole numbers only, e.g., 50):"
                    
                    await context.bot.send_message(
                        chat_id=chat_id,
                        text=response_text,
                        parse_mode='Markdown'
                    )
                    
                except ValueError:
                    await context.bot.send_message(
                        chat_id=chat_id,
                        text="❌ Invalid price. Please send a valid number (e.g., 25.99):"
                    )
                
            elif step == 'stock':
                # Validate and store stock, create product
                try:
                    stock = int(text)
                    if stock < 0:
                        raise ValueError("Stock cannot be negative")
                    
                    session_data['stock'] = stock
                    await self.create_product(chat_id, user_id, session_data, context)
                    
                except ValueError:
                    await context.bot.send_message(
                        chat_id=chat_id,
                        text="❌ Invalid stock quantity. Please send a whole number (e.g., 50):"
                    )
                
        except Exception as e:
            logger.error(f"Error processing product creation: {e}")
            await context.bot.send_message(chat_id, "❌ Error creating product. Please try again.")
            self.user_cache.clear_user_session(user_id, 'adding_product')
    
    async def create_category(self, chat_id: int, user_id: int, session_data: Dict, context: ContextTypes.DEFAULT_TYPE):
        """Create category in Firebase"""
        try:
            shop_id = session_data['shop_id']
            
            # Get next order number
            categories = await self.get_shop_categories(shop_id)
            next_order = len(categories)
            
            # Create category document
            category_data = {
                'name': session_data['name'],
                'description': session_data.get('description', ''),
                'icon': session_data.get('icon', '📦'),
                'order': next_order,
                'shopId': shop_id,
                'userId': await self.get_user_firebase_uid(user_id),
                'createdAt': datetime.now(timezone.utc),
                'updatedAt': datetime.now(timezone.utc)
            }
            
            # Add to Firebase
            doc_ref = self.db.collection('categories').add(category_data)
            
            # Clear session
            self.user_cache.clear_user_session(user_id, 'adding_category')
            
            # Send success message
            text = f"✅ **Category Created Successfully!**\n\n"
            text += f"📂 **Name:** {session_data['name']}\n"
            text += f"🎨 **Icon:** {session_data.get('icon', '📦')}\n"
            if session_data.get('description'):
                text += f"📝 **Description:** {session_data['description']}\n"
            text += f"\n🎉 Category is now available in your shop!"
            
            keyboard = [
                [InlineKeyboardButton("➕ Add Product to Category", callback_data=f"add_product_category_{shop_id}_{doc_ref[1].id}")],
                [InlineKeyboardButton("🏪 Back to Shop", callback_data=f"shop_{shop_id}")]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await context.bot.send_message(
                chat_id=chat_id,
                text=text,
                reply_markup=reply_markup,
                parse_mode='Markdown'
            )
            
        except Exception as e:
            logger.error(f"Error creating category: {e}")
            await context.bot.send_message(chat_id, "❌ Error creating category. Please try again.")
            self.user_cache.clear_user_session(user_id, 'adding_category')
    
    async def create_product(self, chat_id: int, user_id: int, session_data: Dict, context: ContextTypes.DEFAULT_TYPE):
        """Create product in Firebase"""
        try:
            shop_id = session_data['shop_id']
            
            # Create product document
            product_data = {
                'name': session_data['name'],
                'description': session_data.get('description', ''),
                'price': session_data['price'],
                'stock': session_data['stock'],
                'category': session_data['category_name'],
                'subcategory': '',
                'images': [],
                'sku': '',
                'isActive': True,
                'lowStockAlert': 5,
                'shopId': shop_id,
                'createdAt': datetime.now(timezone.utc),
                'updatedAt': datetime.now(timezone.utc)
            }
            
            # Add to Firebase
            doc_ref = self.db.collection('products').add(product_data)
            
            # Clear session
            self.user_cache.clear_user_session(user_id, 'adding_product')
            
            # Send success message
            text = f"✅ **Product Created Successfully!**\n\n"
            text += f"🛍️ **Name:** {session_data['name']}\n"
            text += f"📂 **Category:** {session_data['category_name']}\n"
            text += f"💰 **Price:** ${session_data['price']:.2f}\n"
            text += f"📦 **Stock:** {session_data['stock']}\n"
            if session_data.get('description'):
                text += f"📝 **Description:** {session_data['description']}\n"
            text += f"\n🎉 Product is now available in your shop!"
            
            keyboard = [
                [InlineKeyboardButton("➕ Add Another Product", callback_data=f"add_product_{shop_id}")],
                [InlineKeyboardButton("📂 View Category", callback_data=f"category_{shop_id}_{session_data['category_id']}")],
                [InlineKeyboardButton("🏪 Back to Shop", callback_data=f"shop_{shop_id}")]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await context.bot.send_message(
                chat_id=chat_id,
                text=text,
                reply_markup=reply_markup,
                parse_mode='Markdown'
            )
            
        except Exception as e:
            logger.error(f"Error creating product: {e}")
            await context.bot.send_message(chat_id, "❌ Error creating product. Please try again.")
            self.user_cache.clear_user_session(user_id, 'adding_product')
    
    async def get_user_firebase_uid(self, telegram_id: int) -> str:
        """Get Firebase UID for telegram user"""
        try:
            user_ref = self.db.collection('users').document(str(telegram_id))
            user_doc = user_ref.get()
            
            if user_doc.exists:
                user_data = user_doc.to_dict()
                return user_data.get('firebase_uid', str(telegram_id))
            
            return str(telegram_id)
        except Exception as e:
            logger.error(f"Error getting user Firebase UID: {e}")
            return str(telegram_id)
    
    async def handle_shop_stats(self, chat_id: int, shop_id: str, user_id: int, context: ContextTypes.DEFAULT_TYPE):
        """Handle shop statistics request"""
        try:
            # Verify user is shop owner
            is_owner = await self.is_shop_owner(user_id, shop_id)
            is_telegram_owner = await self.is_shop_owner_by_telegram_id(user_id, shop_id)
            
            if not (is_owner or is_telegram_owner):
                await context.bot.send_message(chat_id, "❌ You don't have permission to view shop statistics.")
                return
            
            # Get shop statistics
            products_count = len(await self.get_shop_products(shop_id))
            categories_count = len(await self.get_shop_categories(shop_id))
            orders_count = await self.get_shop_orders_count(shop_id)
            
            text = f"📊 **Shop Statistics**\n\n"
            text += f"📂 Categories: {categories_count}\n"
            text += f"🛍️ Products: {products_count}\n"
            text += f"📦 Total Orders: {orders_count}\n"
            text += f"📅 Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            
            keyboard = [[InlineKeyboardButton("⬅️ Back to Shop", callback_data=f"shop_{shop_id}")]]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await context.bot.send_message(
                chat_id=chat_id,
                text=text,
                reply_markup=reply_markup,
                parse_mode='Markdown'
            )
            
        except Exception as e:
            logger.error(f"Error handling shop stats: {e}")
            await context.bot.send_message(chat_id, "❌ Error loading shop statistics.")
    
    async def get_shop_products(self, shop_id: str) -> List[Dict]:
        """Get all products for a shop"""
        try:
            products_ref = self.db.collection('products').where('shopId', '==', shop_id)
            products = products_ref.stream()
            
            product_list = []
            for product in products:
                product_data = product.to_dict()
                product_data['id'] = product.id
                product_list.append(product_data)
            
            return product_list
            
        except Exception as e:
            logger.error(f"Error getting shop products: {e}")
            return []
    
    async def get_shop_orders_count(self, shop_id: str) -> int:
        """Get total orders count for a shop"""
        try:
            orders_ref = self.db.collection('orders').where('shopId', '==', shop_id)
            orders = orders_ref.stream()
            
            return len(list(orders))
            
        except Exception as e:
            logger.error(f"Error getting shop orders count: {e}")
            return 0
    
    async def handle_shop_settings(self, chat_id: int, shop_id: str, user_id: int, context: ContextTypes.DEFAULT_TYPE):
        """Handle shop settings request"""
        await context.bot.send_message(chat_id, "⚙️ Shop settings feature coming soon!")
    
    async def handle_manage_staff(self, chat_id: int, shop_id: str, user_id: int, context: ContextTypes.DEFAULT_TYPE):
        """Handle manage staff request"""
        await context.bot.send_message(chat_id, "👥 Staff management feature coming soon!")
    
    async def handle_view_analytics(self, chat_id: int, shop_id: str, user_id: int, context: ContextTypes.DEFAULT_TYPE):
        """Handle view analytics request"""
        await context.bot.send_message(chat_id, "📈 Analytics feature coming soon!")
    
    async def handle_send_announcement(self, chat_id: int, shop_id: str, user_id: int, context: ContextTypes.DEFAULT_TYPE):
        """Handle send announcement request"""
        await context.bot.send_message(chat_id, "🔔 Announcement feature coming soon!")
    
    async def reload_shop_owners(self):
        """Reload shop owners cache"""
        await self.load_shop_owners()
    
    async def button_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle button callbacks"""
        query = update.callback_query
        await query.answer()
        
        user_id = update.effective_user.id
        chat_id = update.effective_chat.id
        data = query.data
        
        try:
            if data == "refresh_shops":
                await self.send_welcome_message(chat_id, update.effective_user.first_name, context)
                
            elif data.startswith("shop_"):
                shop_id = data.split("_", 1)[1]
                shop_data = await self.get_shop_data(shop_id)
                if shop_data:
                    await self.send_shop_menu(chat_id, shop_data, user_id, context)
                else:
                    await context.bot.send_message(chat_id, "❌ Shop not found.")
                    
            elif data.startswith("category_"):
                parts = data.split("_")
                if len(parts) >= 3:
                    shop_id = parts[1]
                    category_id = parts[2]
                    await self.send_category_products(chat_id, shop_id, category_id, user_id, context)
                    
            elif data.startswith("product_"):
                parts = data.split("_")
                if len(parts) >= 3:
                    shop_id = parts[1]
                    product_id = parts[2]
                    await self.send_product_details(chat_id, shop_id, product_id, user_id, context)
                    
            elif data.startswith("order_"):
                parts = data.split("_")
                if len(parts) >= 3:
                    shop_id = parts[1]
                    product_id = parts[2]
                    await self.handle_order_request(chat_id, shop_id, product_id, user_id, context)
                    
            elif data.startswith("add_category_"):
                shop_id = data.split("_", 2)[2]
                await self.handle_add_category(chat_id, shop_id, user_id, context)
                
            elif data.startswith("add_product_category_"):
                parts = data.split("_")
                if len(parts) >= 4:
                    shop_id = parts[3]
                    category_id = parts[4]
                    await self.handle_add_product(chat_id, shop_id, user_id, context, category_id)
                    
            elif data.startswith("add_product_"):
                shop_id = data.split("_", 2)[2]
                await self.handle_add_product(chat_id, shop_id, user_id, context)
                
            elif data.startswith("shop_stats_"):
                shop_id = data.split("_", 2)[2]
                await self.handle_shop_stats(chat_id, shop_id, user_id, context)
                
            elif data.startswith("shop_settings_"):
                shop_id = data.split("_", 2)[2]
                await self.handle_shop_settings(chat_id, shop_id, user_id, context)
                
            elif data.startswith("manage_staff_"):
                shop_id = data.split("_", 2)[2]
                await self.handle_manage_staff(chat_id, shop_id, user_id, context)
                
            elif data.startswith("view_analytics_"):
                shop_id = data.split("_", 2)[2]
                await self.handle_view_analytics(chat_id, shop_id, user_id, context)
                
            elif data.startswith("send_announcement_"):
                shop_id = data.split("_", 2)[2]
                await self.handle_send_announcement(chat_id, shop_id, user_id, context)
                
            elif data.startswith("skip_category_desc_"):
                shop_id = data.split("_", 3)[3]
                adding_category = self.user_cache.get_user_session(user_id, 'adding_category')
                if adding_category:
                    adding_category['step'] = 'icon'
                    self.user_cache.set_user_session(user_id, 'adding_category', adding_category)
                    
                    response_text = f"✅ Category: **{adding_category['name']}**\n\n"
                    response_text += "🎨 Please send an emoji icon for this category (or send 'skip' for default 📦):"
                    
                    keyboard = [[InlineKeyboardButton("📦 Use Default Icon", callback_data=f"skip_category_icon_{shop_id}")]]
                    reply_markup = InlineKeyboardMarkup(keyboard)
                    
                    await context.bot.send_message(
                        chat_id=chat_id,
                        text=response_text,
                        reply_markup=reply_markup,
                        parse_mode='Markdown'
                    )
                    
            elif data.startswith("skip_category_icon_"):
                shop_id = data.split("_", 3)[3]
                adding_category = self.user_cache.get_user_session(user_id, 'adding_category')
                if adding_category:
                    adding_category['icon'] = '📦'
                    await self.create_category(chat_id, user_id, adding_category, context)
                    
            elif data.startswith("skip_product_desc_"):
                shop_id = data.split("_", 3)[3]
                adding_product = self.user_cache.get_user_session(user_id, 'adding_product')
                if adding_product:
                    adding_product['step'] = 'price'
                    self.user_cache.set_user_session(user_id, 'adding_product', adding_product)
                    
                    response_text = f"✅ Product: **{adding_product['name']}**\n\n"
                    response_text += "💰 Please send the price (numbers only, e.g., 25.99):"
                    
                    await context.bot.send_message(
                        chat_id=chat_id,
                        text=response_text,
                        parse_mode='Markdown'
                    )
                    
        except Exception as e:
            logger.error(f"Error handling button callback: {e}")
            await context.bot.send_message(chat_id, "❌ Error processing request. Please try again.")
    
    async def setup_bot_commands(self, application):
        """Setup bot commands"""
        commands = [
            BotCommand("start", "Start shopping and browse shops"),
        ]
        
        await application.bot.set_my_commands(commands)
        logger.info("Bot commands set up successfully")
    
    def run(self):
        """Run the bot"""
        try:
            # Create application
            application = Application.builder().token(self.bot_token).build()
            
            # Add handlers
            application.add_handler(CommandHandler("start", self.start_command))
            application.add_handler(CallbackQueryHandler(self.button_callback))
            application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_text_message))
            
            # Setup commands
            asyncio.create_task(self.setup_bot_commands(application))
            
            logger.info("🤖 Multi-Shop Telegram Bot started successfully!")
            logger.info("📱 Bot will handle user caching and shop navigation")
            logger.info("🛒 Order processing is now enabled")
            logger.info("🔄 Press Ctrl+C to stop the bot")
            
            # Run the bot
            application.run_polling(allowed_updates=Update.ALL_TYPES)
            
        except Exception as e:
            logger.error(f"Error running bot: {e}")
            sys.exit(1)

def main():
    """Main function"""
    bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
    
    if not bot_token:
        logger.error("TELEGRAM_BOT_TOKEN not found in environment variables")
        sys.exit(1)
    
    # Create and run bot
    bot = TelegramBot(bot_token)
    bot.run()

if __name__ == '__main__':
    main()