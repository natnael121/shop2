import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, Eye, Filter, Download, MessageSquare, AlertCircle, Truck, Package, MapPin } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useOrders } from '../../hooks/useOrders';
import { Order, OrderStatus } from '../../types';
import { format } from 'date-fns';
import { TelegramService } from '../../services/telegram';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface OrderManagementProps {
  selectedShopId?: string;
}

interface Department {
  id: string;
  name: string;
  telegramChatId: string;
  adminChatId?: string;
  role: 'kitchen' | 'cashier' | 'admin';
  userId: string;
  shopId?: string;
}

export const OrderManagement: React.FC<OrderManagementProps> = ({ selectedShopId }) => {
  const { user } = useAuth();
  const { orders, loading, updateOrderStatus } = useOrders(selectedShopId);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [processingOrders, setProcessingOrders] = useState<Set<string>>(new Set());
  const [telegramBotToken, setTelegramBotToken] = useState<string | null>(null);
  const [telegram, setTelegram] = useState<TelegramService | null>(null);

  useEffect(() => {
    if (user?.uid && selectedShopId) {
      loadDepartments();
      loadBotToken();
    }
  }, [user?.uid, selectedShopId]);

  useEffect(() => {
    if (telegramBotToken) {
      setTelegram(new TelegramService(telegramBotToken));
    }
  }, [telegramBotToken]);

  const loadBotToken = async () => {
    if (!user?.uid) return;
    
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setTelegramBotToken(userData.telegramBotToken || null);
      }
    } catch (error) {
      console.error('Error loading bot token:', error);
    }
  };

  const loadDepartments = async () => {
    if (!user?.uid) return;
    
    try {
      const q = query(
        collection(db, 'departments'),
        where('userId', '==', user.uid),
        ...(selectedShopId ? [where('shopId', '==', selectedShopId)] : [])
      );
      
      const snapshot = await getDocs(q);
      const departmentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Department[];
      
      setDepartments(departmentsData);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const handleOrderAction = async (orderId: string, action: 'approve' | 'reject', status: OrderStatus) => {
    if (processingOrders.has(orderId)) return;
    
    setProcessingOrders(prev => new Set(prev).add(orderId));
    
    try {
      await updateOrderStatus(orderId, status);
      
      const order = orders.find(o => o.id === orderId);
      if (order) {
        if (action === 'approve') {
          // Send to sales and delivery groups
          if (telegram) {
            const salesDept = departments.find(d => d.role === 'cashier');
            const deliveryDept = departments.find(d => d.role === 'admin');
            
            if (salesDept?.telegramChatId) {
              await telegram.sendApprovedOrderToGroups(
                order, 
                salesDept.telegramChatId,
                deliveryDept?.telegramChatId
              );
            }
          }
        }
        await sendTelegramNotification(order, action, status);
      }
      
      // Show success message
      const actionText = action === 'approve' ? 'approved' : 'rejected';
      alert(`Order ${actionText} successfully!`);
      
    } catch (error) {
      console.error(`Error ${action}ing order:`, error);
      alert(`Failed to ${action} order. Please try again.`);
    } finally {
      setProcessingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const sendTelegramNotification = async (order: Order, action: 'approve' | 'reject', status: OrderStatus) => {
    if (!telegram) return;
    
    try {
      const cashierDept = departments.find(d => d.role === 'cashier');
      const adminDept = departments.find(d => d.role === 'admin');
      
      const itemsList = order.items.map(item => 
        `• ${item.productName} × ${item.quantity} = $${item.total.toFixed(2)}`
      ).join('\n');

      if (action === 'approve') {
        // Notify cashier about approved order
        if (cashierDept?.telegramChatId) {
          const approvalMessage = `
✅ <b>Order Approved</b>

📋 Order ID: #${order.id.slice(-6)}
👤 Customer: ${order.customerId}
💰 Total: $${order.total.toFixed(2)}
📅 Date: ${format(order.createdAt, 'MMM dd, yyyy HH:mm')}

📦 <b>Items:</b>
${itemsList}

🔄 Status: ${status.toUpperCase()}
⏰ Approved at: ${new Date().toLocaleString()}

<i>Order is now being processed</i>
          `.trim();

          await telegram.sendMessage({
            chat_id: cashierDept.telegramChatId,
            text: approvalMessage,
            parse_mode: 'HTML'
          });
        }

        // Notify admin if different from cashier
        if (adminDept?.telegramChatId && adminDept.telegramChatId !== cashierDept?.telegramChatId) {
          const adminMessage = `
📊 <b>Order Status Update</b>

Order #${order.id.slice(-6)} has been approved
Total: $${order.total.toFixed(2)}
Status: ${status.toUpperCase()}
          `.trim();

          await telegram.sendMessage({
            chat_id: adminDept.telegramChatId,
            text: adminMessage,
            parse_mode: 'HTML'
          });
        }
      } else {
        // Notify about rejected order
        const rejectionMessage = `
❌ <b>Order Rejected</b>

📋 Order ID: #${order.id.slice(-6)}
👤 Customer: ${order.customerId}
💰 Total: $${order.total.toFixed(2)}
📅 Date: ${format(order.createdAt, 'MMM dd, yyyy HH:mm')}

📦 <b>Items:</b>
${itemsList}

⏰ Rejected at: ${new Date().toLocaleString()}

<i>Customer should be notified about the cancellation</i>
        `.trim();

        // Send to both cashier and admin
        const chatIds = [
          cashierDept?.telegramChatId,
          adminDept?.telegramChatId
        ].filter(Boolean);

        for (const chatId of chatIds) {
          if (chatId) {
            await telegram.sendMessage({
              chat_id: chatId,
              text: rejectionMessage,
              parse_mode: 'HTML'
            });
          }
        }
      }
    } catch (error) {
      console.error('Error sending Telegram notification:', error);
    }
  };

  const statusConfig = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    payment_pending: { label: 'Payment Pending', color: 'bg-orange-100 text-orange-800', icon: Clock },
    confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
    processing: { label: 'Processing', color: 'bg-orange-100 text-orange-800', icon: Package },
    shipped: { label: 'Shipped', color: 'bg-indigo-100 text-indigo-800', icon: Truck },
    delivered: { label: 'Delivered', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: XCircle }
  };

  const getStatusColor = (status: OrderStatus) => {
    return statusConfig[status]?.color || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: OrderStatus) => {
    return statusConfig[status]?.icon || AlertCircle;
  };

  const filteredOrders = orders.filter(order => {
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    
    if (dateFilter !== 'all') {
      const orderDate = new Date(order.createdAt);
      const today = new Date();
      
      switch (dateFilter) {
        case 'today':
          return orderDate.toDateString() === today.toDateString();
        case 'week':
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          return orderDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
          return orderDate >= monthAgo;
      }
    }
    
    return true;
  });

  const exportOrders = () => {
    const csvContent = [
      ['Order ID', 'Customer', 'Items', 'Total', 'Status', 'Date'].join(','),
      ...filteredOrders.map(order => [
        order.id.slice(-6),
        order.customerId,
        order.items.map(item => `${item.productName} x${item.quantity}`).join('; '),
        order.total.toFixed(2),
        order.status,
        format(order.createdAt, 'yyyy-MM-dd HH:mm')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!selectedShopId) {
    return (
      <div className="text-center py-12">
        <Package className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No Shop Selected</h3>
        <p className="mt-1 text-sm text-gray-500">
          Please select a shop to view and manage orders.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Order Management</h2>
          <p className="text-gray-600">Manage and track all your orders with Telegram integration</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={exportOrders}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Export Orders</span>
          </button>
          {departments.length === 0 && (
            <div className="bg-yellow-100 text-yellow-800 px-3 py-2 rounded-lg text-sm flex items-center space-x-2">
              <AlertCircle className="w-4 h-4" />
              <span>Setup Telegram departments for notifications</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
            </div>
            <Package className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Orders</p>
              <p className="text-2xl font-bold text-yellow-600">
                {orders.filter(o => ['pending', 'payment_pending'].includes(o.status)).length}
              </p>
            </div>
            <Clock className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Processing</p>
              <p className="text-2xl font-bold text-blue-600">
                {orders.filter(o => ['confirmed', 'processing'].includes(o.status)).length}
              </p>
            </div>
            <Package className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">
                {orders.filter(o => o.status === 'delivered').length}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="payment_pending">Payment Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>

          <div className="text-sm text-gray-600">
            Showing {filteredOrders.length} of {orders.length} orders
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.map((order) => {
                const StatusIcon = getStatusIcon(order.status);
                const isProcessing = processingOrders.has(order.id);
                
                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          #{order.id.slice(-6)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {format(order.createdAt, 'MMM dd, yyyy HH:mm')}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{order.customerId}</div>
                      {order.source === 'telegram' && (
                        <div className="text-xs text-blue-600 flex items-center mt-1">
                          <MessageSquare className="w-3 h-3 mr-1" />
                          Telegram Order
                        </div>
                      )}
                      {order.telegramUsername && (
                        <div className="text-xs text-gray-500">@{order.telegramUsername}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {order.items.slice(0, 2).map((item, index) => (
                          <div key={index}>
                            {item.productName} x{item.quantity}
                          </div>
                        ))}
                        {order.items.length > 2 && (
                          <div className="text-xs text-gray-500">
                            +{order.items.length - 2} more items
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ${order.total.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {order.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleOrderAction(order.id, 'approve', 'confirmed')}
                              disabled={isProcessing}
                              className="text-green-600 hover:text-green-900 p-1 rounded disabled:opacity-50"
                              title="Approve Order"
                            >
                              {isProcessing ? (
                                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleOrderAction(order.id, 'reject', 'cancelled')}
                              disabled={isProcessing}
                              className="text-red-600 hover:text-red-900 p-1 rounded disabled:opacity-50"
                              title="Reject Order"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        
                        {order.status === 'payment_pending' && (
                          <>
                            <button
                              onClick={() => handleOrderAction(order.id, 'approve', 'confirmed')}
                              disabled={isProcessing}
                              className="text-green-600 hover:text-green-900 p-1 rounded disabled:opacity-50"
                              title="Confirm Payment & Approve"
                            >
                              {isProcessing ? (
                                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleOrderAction(order.id, 'reject', 'cancelled')}
                              disabled={isProcessing}
                              className="text-red-600 hover:text-red-900 p-1 rounded disabled:opacity-50"
                              title="Reject Payment"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        
                        {order.status === 'confirmed' && (
                          <button
                            onClick={() => handleOrderAction(order.id, 'approve', 'processing')}
                            disabled={isProcessing}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded disabled:opacity-50"
                            title="Start Processing"
                          >
                            <Package className="w-4 h-4" />
                          </button>
                        )}
                        
                        {order.status === 'processing' && (
                          <button
                            onClick={() => handleOrderAction(order.id, 'approve', 'shipped')}
                            disabled={isProcessing}
                            className="text-indigo-600 hover:text-indigo-900 p-1 rounded disabled:opacity-50"
                            title="Mark as Shipped"
                          >
                            <Truck className="w-4 h-4" />
                          </button>
                        )}
                        
                        {order.status === 'shipped' && (
                          <button
                            onClick={() => handleOrderAction(order.id, 'approve', 'delivered')}
                            disabled={isProcessing}
                            className="text-green-600 hover:text-green-900 p-1 rounded disabled:opacity-50"
                            title="Mark as Delivered"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {orders.length === 0 ? 'No orders yet' : 'No orders match your filters'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {orders.length === 0 
                ? 'Orders will appear here once customers start placing them.'
                : 'Try adjusting your filter criteria.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdateStatus={(orderId, status) => handleOrderAction(orderId, 'approve', status)}
          departments={departments}
          telegram={telegram}
        />
      )}
    </div>
  );
};

// Order Detail Modal Component
interface OrderDetailModalProps {
  order: Order;
  onClose: () => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  departments: Department[];
  telegram: TelegramService | null;
}

const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ 
  order, 
  onClose, 
  onUpdateStatus, 
  departments,
  telegram
}) => {
  const statusOptions: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

  const sendTestNotification = async () => {
    if (!telegram) {
      alert('Telegram integration not configured');
      return;
    }
    
    try {
      const cashierDept = departments.find(d => d.role === 'cashier');
      if (!cashierDept?.telegramChatId) {
        alert('No cashier department configured for Telegram notifications');
        return;
      }

      const testMessage = `
🧪 <b>Test Notification</b>

This is a test message for Order #${order.id.slice(-6)}
Total: $${order.total.toFixed(2)}
Status: ${order.status.toUpperCase()}

⏰ Sent at: ${new Date().toLocaleString()}
      `.trim();

      await telegram.sendMessage({
        chat_id: cashierDept.telegramChatId,
        text: testMessage,
        parse_mode: 'HTML'
      });

      alert('Test notification sent successfully!');
    } catch (error) {
      console.error('Error sending test notification:', error);
      alert('Failed to send test notification');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              Order Details - #{order.id.slice(-6)}
            </h2>
            <button 
              onClick={onClose} 
              className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Order Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Order Information</h3>
              <div className="space-y-2 text-sm bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Order ID:</span>
                  <span className="text-gray-900">#{order.id.slice(-6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Customer:</span>
                  <span className="text-gray-900">{order.customerId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Date:</span>
                  <span className="text-gray-900">{format(order.createdAt, 'MMM dd, yyyy HH:mm')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Total:</span>
                  <span className="text-gray-900 font-bold">${order.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Delivery:</span>
                  <span className="text-gray-900 capitalize">{order.deliveryMethod}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Status Management</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Order Status
                  </label>
                  <select
                    value={order.status}
                    onChange={(e) => onUpdateStatus(order.id, e.target.value as OrderStatus)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {statusOptions.map(status => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Status
                  </label>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    order.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                    order.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {order.paymentStatus}
                  </span>
                </div>

                {departments.length > 0 && (
                  <button
                    onClick={sendTestNotification}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Send Test Notification</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          {order.deliveryAddress && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Delivery Address</h3>
              <div className="bg-blue-50 p-4 rounded-lg">
                {(() => {
                  const coordMatch = order.deliveryAddress.match(/Lat:\s*([-\d.]+),\s*Lng:\s*([-\d.]+)/);
                  if (coordMatch) {
                    const lat = coordMatch[1];
                    const lng = coordMatch[2];
                    const mapLink = `https://www.google.com/maps?q=${lat},${lng}`;
                    return (
                      <div>
                        <p className="text-sm text-blue-800 mb-2">{order.deliveryAddress}</p>
                        <a
                          href={mapLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                        >
                          <MapPin className="w-4 h-4 mr-1" />
                          View on Map
                        </a>
                      </div>
                    );
                  } else {
                    return <p className="text-sm text-blue-800">{order.deliveryAddress}</p>;
                  }
                })()}
              </div>
            </div>
          )}

          {/* Payment Photo */}
          {order.paymentPhotoUrl && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Payment Proof</h3>
              <div className="bg-green-50 p-4 rounded-lg">
                <img
                  src={order.paymentPhotoUrl}
                  alt="Payment Proof"
                  className="max-w-full h-auto rounded-lg border border-green-200"
                />
                <p className="text-sm text-green-700 mt-2">
                  Payment method: {order.paymentPreference}
                </p>
              </div>
            </div>
          )}

          {/* Order Items */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Order Items</h3>
            <div className="bg-gray-50 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Item</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Qty</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Price</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, index) => (
                    <tr key={index} className="border-t border-gray-200">
                      <td className="px-4 py-3 text-sm text-gray-900">{item.productName}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">${item.price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">${item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-300 bg-gray-100">
                    <td colSpan={3} className="px-4 py-3 text-sm font-medium text-gray-900">Total</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">${order.total.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Customer Notes */}
          {order.customerNotes && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Customer Notes</h3>
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <p className="text-sm text-yellow-800">{order.customerNotes}</p>
              </div>
            </div>
          )}

          {/* Telegram Integration Status */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Telegram Integration</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {departments.map(dept => (
                <div key={dept.id} className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center space-x-2 mb-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-900 capitalize">{dept.role}</span>
                  </div>
                  <p className="text-xs text-gray-600">{dept.name}</p>
                  <p className="text-xs text-gray-500">Chat ID: {dept.telegramChatId.slice(0, 10)}...</p>
                </div>
              ))}
              {departments.length === 0 && (
                <div className="col-span-3 text-center py-4">
                  <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">No Telegram departments configured</p>
                  <p className="text-xs text-gray-500">Set up departments in Telegram Setup to enable notifications</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};