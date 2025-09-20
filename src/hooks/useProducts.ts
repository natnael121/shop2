import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from '../types';

export function useProducts(shopId: string | undefined) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopId) {
      setProducts([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'products'),
      where('shopId', '==', shopId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as Product[];
      
      setProducts(productsData);
      setLoading(false);
    });

    return unsubscribe;
  }, [shopId]);

  const createProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const docRef = await addDoc(collection(db, 'products'), {
        ...productData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return docRef.id;
    } catch (error) {
      throw error;
    }
  };

  const updateProduct = async (productId: string, updates: Partial<Product>) => {
    try {
      await updateDoc(doc(db, 'products', productId), {
        ...updates,
        updatedAt: new Date()
      });
    } catch (error) {
      throw error;
    }
  };

  const deleteProduct = async (productId: string) => {
    try {
      await deleteDoc(doc(db, 'products', productId));
    } catch (error) {
      throw error;
    }
  };

  return {
    products,
    loading,
    createProduct,
    updateProduct,
    deleteProduct
  };
}