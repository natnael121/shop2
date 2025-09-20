import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAFZNP_u-9liUsLpcyZ_s2J11GGRWPHENQ",
  authDomain: "shop-9a928.firebaseapp.com",
  projectId: "shop-9a928",
  storageBucket: "shop-9a928.firebasestorage.app",
  messagingSenderId: "99251699558",
  appId: "1:99251699558:web:9e0ad0870a8fdd2aef12a7",
  measurementId: "G-GKFH71GC48"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;