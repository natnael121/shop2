import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order, OrderStatus } from '../types';

export function useOrders(shopId: string | undefined) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shopId) {
      setOrders([]);
      setLoading(false);
      setError(null);
      return;
    }

    setError(null);
    const q = query(
      collection(db, 'orders'),
      where('shopId', '==', shopId)
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const ordersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate()
        })) as Order[];
        
        // Sort orders by createdAt in descending order (client-side)
        ordersData.sort((a, b) => {
          if (!a.createdAt || !b.createdAt) return 0;
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
        
        setOrders(ordersData);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching orders:', error);
        setError(error.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [shopId]);

  const createOrder = async (orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const docRef = await addDoc(collection(db, 'orders'), {
        ...orderData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return docRef.id;
    } catch (error) {
      throw error;
    }
  };

  const createPendingOrder = async (orderData: {
    shopId: string;
    customerId: string;
    customerName: string;
    items: any[];
    total: number;
    deliveryMethod: 'pickup' | 'delivery';
    deliveryAddress?: string;
    customerNotes?: string;
    paymentPreference: string;
    tableNumber: string;
  }) => {
    try {
      const docRef = await addDoc(collection(db, 'orders'), {
        ...orderData,
        status: 'pending',
        paymentStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return docRef.id;
    } catch (error) {
      throw error;
    }
  };
  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status,
        updatedAt: new Date()
      });
    } catch (error) {
      throw error;
    }
  };

  return {
    orders,
    loading,
    error,
    createOrder,
    createPendingOrder,
    updateOrderStatus
  };
}