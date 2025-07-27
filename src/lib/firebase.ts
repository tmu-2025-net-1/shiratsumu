// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD6GHG92HJKNbgZSFMRsmWLAsAyW43qpDE",
  authDomain: "ascii-qr.firebaseapp.com",
  databaseURL: "https://ascii-qr-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ascii-qr",
  storageBucket: "ascii-qr.firebasestorage.app",
  messagingSenderId: "212035282109",
  appId: "1:212035282109:web:d3a1513df6180336cb03d4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Export the Firestore instance
export const db = getFirestore(app);