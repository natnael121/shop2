import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, Save, MessageSquare, TestTube } from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../lib/firebase';
import { TelegramService } from '../../services/telegram';

interface Department {
  id: string;
  name: string;
  telegramChatId: string;
  adminChatId?: string;
  role: 'kitchen' | 'cashier' | 'admin' | 'shop';
  order: number;
  icon: string;
  userId: string;
  shopId?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DepartmentManagementProps {
  selectedShopId?: string;
}

const DepartmentManagement: React.FC<DepartmentManagementProps> = ({ selectedShopId }) => {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDepartment, setShowAddDepartment] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [telegramBotToken, setTelegramBotToken] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;

    // Load bot token
    loadBotToken();

    const q = query(
      collection(db, 'departments'),
      where('userId', '==', user.uid),
      ...(selectedShopId ? [where('shopId', '==', selectedShopId)] : [])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const departmentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as Department[];
      
      setDepartments(departmentsData.sort((a, b) => a.order - b.order));
      setLoading(false);
    });

    return unsubscribe;
  }, [user?.uid, selectedShopId]);

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

  const handleDeleteDepartment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this department?')) return;
    
    try {
      await deleteDoc(doc(db, 'departments', id));
    } catch (error) {
      console.error('Error deleting department:', error);
      alert('Failed to delete department');
    }
  };

  const testTelegramConnection = async (chatId: string, departmentName: string) => {
    if (!chatId || !telegramBotToken) {
      alert('Please enter a Telegram Chat ID first');
      return;
    }

    try {
      // Send a test message using the telegram service
      const telegram = new TelegramService(telegramBotToken);
      await telegram.sendMessage({
        chat_id: chatId,
        text: `🧪 Test message from ${departmentName} department!\n\nThis is a test to verify the Telegram connection is working properly.`,
        parse_mode: 'HTML'
      });
      alert(`Test message sent to ${departmentName} chat! Check your Telegram.`);
    } catch (error) {
      console.error('Error testing Telegram connection:', error);
      alert('Failed to send test message. Please check your Chat ID.');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Department Management</h2>
          <p className="text-gray-600">Manage your shop departments and their Telegram notifications</p>
        </div>
        <button
          onClick={() => setShowAddDepartment(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Department
        </button>
      </div>

      {/* Departments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((department) => (
          <div key={department.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">{department.icon || '🏢'}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{department.name}</h3>
                  <p className="text-sm text-gray-500 capitalize">{department.role}</p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setEditingDepartment(department)}
                  className="text-blue-600 hover:text-blue-700 p-1 transition-colors duration-200"
                  title="Edit Department"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteDepartment(department.id)}
                  className="text-red-600 hover:text-red-700 p-1 transition-colors duration-200"
                  title="Delete Department"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Telegram Chat ID
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={department.telegramChatId}
                    readOnly
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded bg-gray-50 text-gray-600"
                  />
                  <button
                    onClick={() => testTelegramConnection(department.telegramChatId, department.name)}
                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-1"
                    title="Test Connection"
                  >
                    <TestTube className="w-3 h-3" />
                    <span>Test</span>
                  </button>
                </div>
              </div>

              {department.adminChatId && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Admin Chat ID
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={department.adminChatId}
                      readOnly
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded bg-gray-50 text-gray-600"
                    />
                    <button
                      onClick={() => testTelegramConnection(department.adminChatId!, 'Admin')}
                      className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors duration-200 flex items-center space-x-1"
                      title="Test Admin Connection"
                    >
                      <TestTube className="w-3 h-3" />
                      <span>Test</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t">
                <p className="text-xs text-gray-500">
                  Created: {department.createdAt?.toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        ))}

        {departments.length === 0 && (
          <div className="col-span-full text-center py-12">
            <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No departments yet</h3>
            <p className="text-gray-600 mb-4">Create your first department to organize order routing</p>
            <button
              onClick={() => setShowAddDepartment(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Department
            </button>
          </div>
        )}
      </div>

      {/* Add/Edit Department Modal */}
      {(showAddDepartment || editingDepartment) && (
        <DepartmentModal
          department={editingDepartment}
          userId={user?.uid || ''}
          shopId={selectedShopId}
          onClose={() => {
            setShowAddDepartment(false);
            setEditingDepartment(null);
          }}
          onSave={() => {
            setShowAddDepartment(false);
            setEditingDepartment(null);
          }}
        />
      )}
    </div>
  );
};

// Department Modal Component
interface DepartmentModalProps {
  department: Department | null;
  userId: string;
  shopId?: string;
  onClose: () => void;
  onSave: () => void;
}

const DepartmentModal: React.FC<DepartmentModalProps> = ({ 
  department, 
  userId, 
  shopId,
  onClose, 
  onSave 
}) => {
  const [name, setName] = useState(department?.name || '');
  const [telegramChatId, setTelegramChatId] = useState(department?.telegramChatId || '');
  const [adminChatId, setAdminChatId] = useState(department?.adminChatId || '');
  const [role, setRole] = useState<'cashier' | 'delivery' | 'admin' | 'sales' | 'shop'>(department?.role || 'cashier');
  const [order, setOrder] = useState(department?.order || 0);
  const [icon, setIcon] = useState(department?.icon || '');
  const [saving, setSaving] = useState(false);

  const DEPARTMENT_EMOJIS = [
    '🏢', '👨‍🍳', '🍹', '💰', '👨‍💼', '👑', '🍕', '🥗', '🍰', '☕', '🍽️', '📋',
    '🔧', '🧹', '💰', '📞', '🚚', '🛒', '📦', '🎯', '⚡', '🔥'
  ];

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return '👑';
      case 'cashier': return '💰';
      case 'delivery': return '🚚';
      case 'admin': return '👨‍💼';
      case 'sales': return '🛍️';
      case 'shop': return '🏪';
      default: return '🏢';
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'owner': return 'Shop Owner';
      case 'cashier': return 'Cashier';
      case 'delivery': return 'Delivery';
      case 'admin': return 'Admin';
      case 'sales': return 'Sales';
      case 'shop': return 'Shop Channel';
      default: return 'Department';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      alert('Please enter a department name');
      return;
    }
    
    if (!telegramChatId.trim()) {
      alert('Please enter a Telegram Chat ID');
      return;
    }
    
    if (role === 'cashier' && !adminChatId.trim()) {
      alert('Please enter an Admin Chat ID for the cashier department');
      return;
    }

    setSaving(true);

    try {
      const departmentData = {
        name: name.trim(),
        telegramChatId: telegramChatId.trim(),
        role,
        order,
        icon: icon || getRoleIcon(role),
        userId,
        ...(shopId && { shopId }),
        ...(role === 'cashier' && adminChatId.trim() && { adminChatId: adminChatId.trim() }),
        updatedAt: new Date(),
        ...(department ? {} : { createdAt: new Date() })
      };

      if (department) {
        await updateDoc(doc(db, 'departments', department.id), departmentData);
      } else {
        await addDoc(collection(db, 'departments'), departmentData);
      }

      onSave();
    } catch (error) {
      console.error('Error saving department:', error);
      alert('Failed to save department');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (!telegramChatId.trim()) {
      alert('Please enter a Telegram Chat ID first');
      return;
    }

    try {
      await telegramService.sendMessage({
        chat_id: telegramChatId.trim(),
        text: '🧪 Test message from department setup!\n\nThis is a test to verify the Telegram connection is working properly.',
        parse_mode: 'HTML'
      });
      alert('Test message sent successfully! Check your Telegram.');
    } catch (error) {
      console.error('Error testing connection:', error);
      alert('Failed to send test message. Please check your Chat ID.');
    }
  };

  const testAdminConnection = async () => {
    if (!adminChatId.trim()) {
      alert('Please enter an Admin Chat ID first');
      return;
    }

    try {
      await telegramService.sendMessage({
        chat_id: adminChatId.trim(),
        text: '🧪 Test message from admin chat setup!\n\nThis is a test to verify the admin Telegram connection is working properly.',
        parse_mode: 'HTML'
      });
      alert('Test message sent to admin chat successfully! Check your Telegram.');
    } catch (error) {
      console.error('Error testing admin connection:', error);
      alert('Failed to send test message to admin chat. Please check your Chat ID.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {department ? 'Edit Department' : 'Add New Department'}
            </h2>
            <button 
              onClick={onClose} 
              className="text-gray-500 hover:text-gray-700 transition-colors duration-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Department Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
              placeholder="e.g., Kitchen, Bar, Pastry"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Department Role *
            </label>
            <select
              value={role}
              onChange={(e) => {
                const newRole = e.target.value as 'owner' | 'cashier' | 'delivery' | 'admin' | 'sales';
                setRole(newRole);
                setName(getRoleName(newRole));
                setIcon(getRoleIcon(newRole));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
              required
            >
              <option value="owner">Shop Owner</option>
              <option value="cashier">Cashier</option>
              <option value="delivery">Delivery</option>
              <option value="admin">Admin</option>
              <option value="sales">Sales</option>
              <option value="shop">Shop Channel</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {role === 'owner' && 'Personal Telegram ID for shop owner admin panel access'}
              {role === 'cashier' && 'Receives payment confirmations, order approvals, and waiter calls'}
              {role === 'delivery' && 'Receives delivery assignments and notifications'}
              {role === 'admin' && 'Receives day reports and administrative notifications'}
              {role === 'sales' && 'Receives sales notifications and customer inquiries'}
              {role === 'shop' && 'Shop channel/group for product promotions and announcements'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {role === 'owner' ? 'Personal Telegram ID' : role === 'cashier' ? 'Cashier' : role === 'admin' ? 'Admin' : role === 'shop' ? 'Shop Channel' : 'Department'} Telegram {role === 'owner' ? 'ID' : 'Chat ID'} *
            </label>
            <div className="space-y-2">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                  placeholder={role === 'owner' ? 'e.g., 650966545' : 'e.g., -1002701066037'}
                  required
                />
                <button
                  type="button"
                  onClick={testConnection}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm"
                >
                  Test
                </button>
              </div>
              <p className="text-xs text-gray-500">
                {role === 'owner' && 'Personal Telegram ID for admin panel access (get from @userinfobot)'}
                {role === 'cashier' && 'This chat will receive payment confirmations, order approvals, and waiter calls'}
                {role === 'delivery' && 'This chat will receive delivery assignments and notifications'}
                {role === 'admin' && 'This chat will receive day reports and administrative notifications'}
                {role === 'sales' && 'This chat will receive sales notifications and customer inquiries'}
                {role === 'shop' && 'This channel/group will receive product promotions and shop announcements'}
              </p>
            </div>
          </div>

          {role === 'cashier' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Admin Chat ID *
              </label>
              <div className="space-y-2">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={adminChatId}
                    onChange={(e) => setAdminChatId(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                    placeholder="e.g., -1002701066037"
                    required
                  />
                  <button
                    type="button"
                    onClick={testAdminConnection}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 text-sm"
                  >
                    Test
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Admin chat will receive day reports and administrative notifications
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Display Order
            </label>
            <input
              type="number"
              value={order}
              onChange={(e) => setOrder(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
              min="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Department Icon (Emoji)
            </label>
            <div className="space-y-3">
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                placeholder="🏢"
                maxLength={2}
              />
              <div className="grid grid-cols-10 gap-2">
                {DEPARTMENT_EMOJIS.map((emoji, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setIcon(emoji)}
                    className={`p-2 text-lg rounded border hover:bg-gray-50 transition-colors duration-200 ${
                      icon === emoji ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-1">How to get Telegram Chat ID:</h4>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• <strong>For Owner Role:</strong> Message @userinfobot and copy your personal ID (e.g., 650966545)</li>
              <li>• Create a Telegram group for this department</li>
              <li>• Add @userinfobot to the group</li>
              <li>• Send /start command in the group</li>
              <li>• Copy the Chat ID (starts with minus sign)</li>
              <li>• For cashier role: Also set up a separate admin chat for reports</li>
            </ul>
          </div>

          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:bg-gray-400 flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Department'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DepartmentManagement;