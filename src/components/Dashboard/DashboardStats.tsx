import React from 'react';
import { Store, Package, ShoppingCart, Users, TrendingUp, AlertTriangle } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<any>;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color: string;
}

function StatsCard({ title, value, icon: Icon, trend, color }: StatsCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {trend && (
            <div className="flex items-center mt-2">
              <TrendingUp className={`h-4 w-4 ${trend.isPositive ? 'text-emerald-500' : 'text-red-500 rotate-180'}`} />
              <span className={`text-sm font-medium ml-1 ${trend.isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                {trend.value}% vs last month
              </span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );
}

interface DashboardStatsProps {
  stats: {
    totalShops: number;
    totalProducts: number;
    totalOrders: number;
    totalCustomers: number;
    revenue: number;
    lowStockItems: number;
  };
}

export default function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <StatsCard
        title="Active Shops"
        value={stats.totalShops}
        icon={Store}
        color="bg-blue-500"
        trend={{ value: 12, isPositive: true }}
      />
      
      <StatsCard
        title="Total Products"
        value={stats.totalProducts}
        icon={Package}
        color="bg-emerald-500"
        trend={{ value: 8, isPositive: true }}
      />
      
      <StatsCard
        title="Total Orders"
        value={stats.totalOrders}
        icon={ShoppingCart}
        color="bg-amber-500"
        trend={{ value: 23, isPositive: true }}
      />
      
      <StatsCard
        title="Customers"
        value={stats.totalCustomers}
        icon={Users}
        color="bg-purple-500"
        trend={{ value: 15, isPositive: true }}
      />
      
      <StatsCard
        title="Revenue"
        value={`$${stats.revenue.toFixed(2)}`}
        icon={TrendingUp}
        color="bg-indigo-500"
        trend={{ value: 31, isPositive: true }}
      />
      
      <StatsCard
        title="Low Stock Alert"
        value={stats.lowStockItems}
        icon={AlertTriangle}
        color="bg-red-500"
      />
    </div>
  );
}