import React from 'react';
import { User, Crown, Globe } from 'lucide-react';

interface TelegramUserInfoProps {
  user: {
    id: number;
    firstName: string;
    lastName?: string;
    username?: string;
    languageCode?: string;
    isPremium?: boolean;
    photoUrl?: string;
  };
  className?: string;
}

export const TelegramUserInfo: React.FC<TelegramUserInfoProps> = ({ user, className = '' }) => {
  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <div className="relative">
        {user.photoUrl ? (
          <img
            src={user.photoUrl}
            alt={user.firstName}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-white" />
          </div>
        )}
        {user.isPremium && (
          <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-1">
            <Crown className="w-3 h-3 text-yellow-800" />
          </div>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium text-gray-900 truncate">
            {user.firstName} {user.lastName}
          </p>
          {user.isPremium && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              Premium
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          {user.username && (
            <span>@{user.username}</span>
          )}
          {user.languageCode && (
            <div className="flex items-center space-x-1">
              <Globe className="w-3 h-3" />
              <span>{user.languageCode.toUpperCase()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};