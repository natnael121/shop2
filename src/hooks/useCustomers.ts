import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Customer } from '../types';

export function useCustomers(shopId: string | undefined) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shopId) {
      setCustomers([]);
      setLoading(false);
      setError(null);
      return;
    }

    setError(null);
    
    // Query all users who have placed orders in this shop
    const ordersQuery = query(
      collection(db, 'orders'),
      where('shopId', '==', shopId)
    );

    const unsubscribe = onSnapshot(ordersQuery, 
      async (ordersSnapshot) => {
        try {
          const customerMap = new Map<string, Customer>();
          
          // Process orders to extract customer information
          ordersSnapshot.docs.forEach(orderDoc => {
            const orderData = orderDoc.data();
            const customerId = orderData.customerId || orderData.customerName || 'Unknown';
            
            if (customerMap.has(customerId)) {
              const existing = customerMap.get(customerId)!;
              existing.totalOrders += 1;
              existing.totalSpent += orderData.total || 0;
              
              const orderDate = orderData.createdAt?.toDate();
              if (orderDate && (!existing.lastOrderDate || orderDate > existing.lastOrderDate)) {
                existing.lastOrderDate = orderDate;
              }
            } else {
              const customer: Customer = {
                id: customerId,
                shopId: shopId,
                name: orderData.customerName || customerId,
                email: orderData.customerEmail || undefined,
                phone: orderData.customerPhone || undefined,
                telegramUsername: orderData.telegramUsername || undefined,
                telegramId: orderData.telegramId || undefined,
                tags: [],
                totalOrders: 1,
                totalSpent: orderData.total || 0,
                lastOrderDate: orderData.createdAt?.toDate(),
                createdAt: orderData.createdAt?.toDate() || new Date(),
                updatedAt: new Date()
              };
              
              // Assign tags based on order history
              if (customer.totalSpent > 500) {
                customer.tags.push('VIP');
              } else if (customer.totalSpent > 200) {
                customer.tags.push('Regular');
              } else {
                customer.tags.push('New');
              }
              
              customerMap.set(customerId, customer);
            }
          });
          
          // Update tags for existing customers
          customerMap.forEach(customer => {
            customer.tags = [];
            if (customer.totalSpent > 500) {
              customer.tags.push('VIP');
            } else if (customer.totalSpent > 200) {
              customer.tags.push('Regular');
            } else {
              customer.tags.push('New');
            }
            
            if (customer.totalSpent > 1000) {
              customer.tags.push('Wholesale');
            }
          });
          
          const customersArray = Array.from(customerMap.values());
          customersArray.sort((a, b) => (b.lastOrderDate?.getTime() || 0) - (a.lastOrderDate?.getTime() || 0));
          
          setCustomers(customersArray);
          setLoading(false);
        } catch (error) {
          console.error('Error processing customers:', error);
          setError('Failed to load customers');
          setLoading(false);
        }
      },
      (error) => {
        console.error('Error fetching customers:', error);
        setError(error.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [shopId]);

  const createCustomer = async (customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const docRef = await addDoc(collection(db, 'customers'), {
        ...customerData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return docRef.id;
    } catch (error) {
      throw error;
    }
  };

  const updateCustomer = async (customerId: string, updates: Partial<Customer>) => {
    try {
      await updateDoc(doc(db, 'customers', customerId), {
        ...updates,
        updatedAt: new Date()
      });
    } catch (error) {
      throw error;
    }
  };

  const deleteCustomer = async (customerId: string) => {
    try {
      await deleteDoc(doc(db, 'customers', customerId));
    } catch (error) {
      throw error;
    }
  };

  return {
    customers,
    loading,
    error,
    createCustomer,
    updateCustomer,
    deleteCustomer
  };
}