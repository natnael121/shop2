#!/usr/bin/env python3
"""
Bot runner script with environment loading
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import and run the main bot
from main import main

if __name__ == '__main__':
    print("🤖 Starting Multi-Shop Telegram Bot...")
    print("📱 Bot will handle user caching and shop navigation")
    print("🔄 Press Ctrl+C to stop the bot")
    print("-" * 50)
    
    try:
        main()
    except KeyboardInterrupt:
        print("\n🛑 Bot stopped by user")
    except Exception as e:
        print(f"❌ Bot crashed: {e}")
        sys.exit(1)