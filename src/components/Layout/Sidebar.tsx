import React from 'react';
import {
  Home,
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  Settings,
  Store,
  MessageSquare,
  Tag,
  Image,
  Printer
} from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'shops', label: 'My Shops', icon: Store },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'categories', label: 'Categories', icon: Tag },
  { id: 'banners', label: 'Banners', icon: Image },
  { id: 'orders', label: 'Orders', icon: ShoppingCart },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'telegram', label: 'Telegram Setup', icon: MessageSquare },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'print', label: 'Print Catalog', icon: Printer },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  return (
    <div className="w-64 bg-white shadow-lg border-r border-gray-200 h-full flex flex-col">
      <div className="p-6">
        <div className="flex items-center space-x-2">
          <Store className="h-8 w-8 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">ShopManager</h1>
        </div>
      </div>
      
      <nav className="mt-8 px-4 flex-1 overflow-y-auto">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onSectionChange(item.id)}
                  className={clsx(
                    'w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200',
                    activeSection === item.id
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}