import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAbKV-egZn2ynlgzvjeB2s3QcQ0Y0vmlNM",
  authDomain: "revalidapro-f812e.firebaseapp.com",
  projectId: "revalidapro-f812e",
  storageBucket: "revalidapro-f812e.firebasestorage.app",
  messagingSenderId: "88375395031",
  appId: "1:88375395031:web:44404cb0e5f10973866692",
  measurementId: "G-WRL3HPKQR9"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);