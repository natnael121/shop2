import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Shop } from '../types';

export function useShops(userId: string | undefined) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setShops([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'shops'),
      where('ownerId', '==', userId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const shopsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as Shop[];
      
      setShops(shopsData);
      setLoading(false);
    });

    return unsubscribe;
  }, [userId]);

  const createShop = async (shopData: Omit<Shop, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>) => {
    if (!userId) throw new Error('User not authenticated');

    try {
      const docRef = await addDoc(collection(db, 'shops'), {
        ...shopData,
        ownerId: userId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return docRef.id;
    } catch (error) {
      throw error;
    }
  };

  const updateShop = async (shopId: string, updates: Partial<Shop>) => {
    try {
      await updateDoc(doc(db, 'shops', shopId), {
        ...updates,
        updatedAt: new Date()
      });
    } catch (error) {
      throw error;
    }
  };

  return {
    shops,
    loading,
    createShop,
    updateShop
  };
}