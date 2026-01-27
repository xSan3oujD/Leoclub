import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyCBr6rBhlTcdQFLInJM5lBkKV_j0ueyCmE",
    authDomain: "leo-stock-53886.firebaseapp.com",
    projectId: "leo-stock-53886",
    storageBucket: "leo-stock-53886.firebasestorage.app",
    messagingSenderId: "477588655477",
    appId: "1:477588655477:web:e52a11b46358d5fe05973c",
    measurementId: "G-0555TQQ17R"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
