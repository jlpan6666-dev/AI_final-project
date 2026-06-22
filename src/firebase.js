// ==========================================
// Firebase 初始化（集中管理，供全站匯入）
// ==========================================
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCh2PByMUxJCY3cmg36WvTE_3PXOyCxNBY",
  authDomain: "ai-final-project-a69b4.firebaseapp.com",
  projectId: "ai-final-project-a69b4",
  storageBucket: "ai-final-project-a69b4.firebasestorage.app",
  messagingSenderId: "1011815467681",
  appId: "1:1011815467681:web:fb282cdaf87a0ab385bee0",
  measurementId: "G-PJRKHDNJDG"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
