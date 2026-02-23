import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCMBoABKBWTOx1B6zEBCk7QCeTKogUYgxQ",
  authDomain: "a2z-ipm.firebaseapp.com",
  databaseURL: "https://a2z-ipm-default-rtdb.firebaseio.com",
  projectId: "a2z-ipm",
  storageBucket: "a2z-ipm.firebasestorage.app",
  messagingSenderId: "37433212653",
  appId: "1:37433212653:web:e58af93855931236d456e4"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

export const COMPANY = {
  name: 'A2Z Industrial Solutions',
  address: '30-F, J-1 Market, Wapda Town, Lahore',
  phone: '0307-0430056',
  email: 'info@a2zidsolutions.com',
  whatsapp: '923070430056'
};
