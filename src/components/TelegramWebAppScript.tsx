import { useEffect } from 'react';

interface TelegramWebAppScriptProps {
  onLoad?: () => void;
}

export const TelegramWebAppScript: React.FC<TelegramWebAppScriptProps> = ({ onLoad }) => {
  useEffect(() => {
    // Check if script is already loaded
    if (window.Telegram?.WebApp) {
      onLoad?.();
      return;
    }

    // Create and load the Telegram Web App script
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    script.async = true;
    
    script.onload = () => {
      console.log('Telegram Web App script loaded');
      onLoad?.();
    };
    
    script.onerror = () => {
      console.error('Failed to load Telegram Web App script');
    };
    
    document.head.appendChild(script);
    
    return () => {
      // Cleanup script on unmount
      const existingScript = document.querySelector('script[src="https://telegram.org/js/telegram-web-app.js"]');
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, [onLoad]);

  return null;
};