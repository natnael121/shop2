import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Category {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  order: number;
  userId: string;
  shopId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export function useCategories(userId: string | undefined, shopId?: string) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setCategories([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'categories'),
      where('userId', '==', userId),
      ...(shopId ? [where('shopId', '==', shopId)] : [])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const categoriesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as Category[];
      
      setCategories(categoriesData.sort((a, b) => a.order - b.order));
      setLoading(false);
    });

    return unsubscribe;
  }, [userId, shopId]);

  const createCategory = async (categoryData: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const docRef = await addDoc(collection(db, 'categories'), {
        ...categoryData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return docRef.id;
    } catch (error) {
      throw error;
    }
  };

  const updateCategory = async (categoryId: string, updates: Partial<Category>) => {
    try {
      await updateDoc(doc(db, 'categories', categoryId), {
        ...updates,
        updatedAt: new Date()
      });
    } catch (error) {
      throw error;
    }
  };

  const deleteCategory = async (categoryId: string) => {
    try {
      await deleteDoc(doc(db, 'categories', categoryId));
    } catch (error) {
      throw error;
    }
  };

  return {
    categories,
    loading,
    createCategory,
    updateCategory,
    deleteCategory
  };
}