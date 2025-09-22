# Multi-Shop Telegram Bot Setup Guide

## Overview
This Telegram bot system allows multiple shops to have their own bot interface while sharing the same bot instance. Users are cached when they join shop channels, and the bot tracks their last-interacted shop to provide a personalized experience.

## Features

### 🔄 User Caching System
- **Automatic Detection**: Bot detects when users join shop Telegram channels
- **Firebase Storage**: User data stored in `users/{telegram_id}` collection
- **In-Memory Cache**: Fast access to user data during bot operations
- **Shop Tracking**: Tracks which shops each user has interacted with

### 📱 Last-Shop Logic
- **Smart Memory**: Bot remembers the last shop each user interacted with
- **Personalized Experience**: `/start` command shows only the last-interacted shop
- **Automatic Updates**: Shop interaction updates whenever user navigates menus

### 🛍️ Shop Navigation
- **Category Browsing**: Users can browse shop categories with emoji icons
- **Product Catalog**: View products with images, prices, and stock levels
- **Order System**: Simple order request system with shop owner notification
- **Back Navigation**: Intuitive back buttons for easy menu navigation

## Installation

### 1. Python Dependencies
```bash
pip install -r requirements.txt
```

### 2. Environment Setup
```bash
cp .env.example .env
# Edit .env with your bot token and configuration
```

### 3. Firebase Setup
- Ensure `serviceAccountKey.json` is in the project root
- Firebase collections should be set up as per your existing schema:
  - `users/` - User data and shop interactions
  - `shops/` - Shop information
  - `categories/` - Product categories
  - `products/` - Product catalog
  - `departments/` - Telegram chat mappings

### 4. Bot Token Configuration
1. Create a bot with @BotFather on Telegram
2. Get your bot token
3. Add the token to your `.env` file
4. Set up bot commands in BotFather:
   ```
   start - Start shopping with your last visited shop
   ```

## Usage

### 1. Shop Channel Setup
1. Add your bot to the shop's Telegram channel/group
2. Make sure the bot has admin permissions to read member updates
3. Configure the channel ID in your `departments` collection with role 'shop'

### 2. User Flow
1. **User joins shop channel** → Bot caches user data
2. **User types `/start`** → Bot shows last-interacted shop menu
3. **User browses categories** → Bot updates shop interaction timestamp
4. **User views products** → Bot shows product details with images
5. **User places order** → Bot sends order request to shop owner

### 3. Data Structure

#### User Document (`users/{telegram_id}`)
```json
{
  "telegram_id": 123456789,
  "username": "john_doe",
  "first_name": "John",
  "last_name": "Doe",
  "created_at": "2024-01-01T00:00:00Z",
  "last_shop_id": "shop123",
  "shops": {
    "shop123": {
      "last_interacted": "2024-01-01T12:00:00Z"
    }
  }
}
```

#### Shop Interaction Tracking
- `last_shop_id`: ID of the most recently interacted shop
- `shops.{shop_id}.last_interacted`: Timestamp of last interaction with specific shop

## Bot Commands

### User Commands
- `/start` - Show last-interacted shop menu or welcome message

### Admin Commands (can be added)
- `/stats` - Show bot usage statistics
- `/cache` - Show cache status
- `/refresh` - Refresh shop data

## File Structure

```
├── main.py                 # Main bot application
├── requirements.txt        # Python dependencies
├── .env.example           # Environment variables template
├── serviceAccountKey.json # Firebase service account key
└── src/
    └── services/
        └── telegram.ts    # Enhanced TypeScript service
```

## Key Components

### 1. UserCache Class (`main.py`)
- In-memory storage for user data
- Shop member tracking
- Session management for navigation

### 2. TelegramBot Class (`main.py`)
- Bot command handlers
- Menu navigation logic
- Firebase integration
- Error handling and logging

### 3. Enhanced TelegramService (`telegram.ts`)
- User caching methods
- Shop interaction tracking
- Menu generation functions
- API integration helpers

## Error Handling

### Bot Resilience
- Graceful handling of missing shop/product data
- Fallback messages for unavailable content
- Comprehensive logging for debugging

### User Experience
- Clear error messages
- Automatic retry mechanisms
- Consistent navigation flow

## Monitoring & Logging

### Log Levels
- `INFO`: User interactions, cache updates
- `WARNING`: Missing data, API issues
- `ERROR`: Critical failures, exceptions

### Key Metrics to Monitor
- User cache hit/miss rates
- Shop interaction frequencies
- Order request volumes
- Error rates by operation type

## Scaling Considerations

### Performance
- In-memory cache for fast user lookups
- Efficient Firebase queries with proper indexing
- Async operations for non-blocking performance

### Multi-Shop Support
- Isolated shop data and navigation
- Shared user cache across all shops
- Configurable per-shop settings

## Security

### Data Protection
- User data encrypted in Firebase
- Secure bot token handling
- Input validation and sanitization

### Access Control
- Shop-specific data isolation
- Admin permission checks
- Rate limiting (can be added)

## Troubleshooting

### Common Issues
1. **Bot not responding**: Check bot token and permissions
2. **Users not cached**: Verify bot has admin rights in shop channels
3. **Shop data missing**: Ensure Firebase collections are properly set up
4. **Navigation broken**: Check callback data format and handlers

### Debug Mode
Set logging level to DEBUG for detailed operation logs:
```python
logging.basicConfig(level=logging.DEBUG)
```

## Future Enhancements

### Planned Features
- Multi-language support
- Order history tracking
- Payment integration
- Advanced analytics
- Shop owner dashboard
- Automated inventory alerts

### API Extensions
- RESTful API for shop management
- Webhook support for real-time updates
- Third-party integrations
- Mobile app compatibility

## Support

For issues and questions:
1. Check the logs for error details
2. Verify Firebase configuration
3. Test bot permissions in Telegram
4. Review the troubleshooting section

The bot is designed to be robust and scalable, handling multiple shops and users efficiently while providing a smooth shopping experience through Telegram.