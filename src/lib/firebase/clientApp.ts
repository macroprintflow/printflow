
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore"; // Added Firestore

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Log the loaded configuration to help debug
console.log("[Firebase ClientApp] Loaded Firebase Config:", firebaseConfig);

if (!firebaseConfig.projectId) {
  console.error("[Firebase ClientApp] CRITICAL: Firebase projectId is missing in the configuration. Firestore operations will likely fail or hang. Check your .env file and Next.js setup.");
}

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  console.log("[Firebase ClientApp] Firebase app initialized.");
} else {
  app = getApps()[0];
  console.log("[Firebase ClientApp] Using existing Firebase app instance.");
}

const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app); 
console.log("[Firebase ClientApp] Firestore instance initialized:", db ? "Successfully obtained Firestore instance." : "Failed to obtain Firestore instance.");

export { app, auth, db };
