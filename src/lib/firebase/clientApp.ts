// src/lib/firebase/clientApp.ts

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

// --- ENVIRONMENT VALIDATION (Warn for missing variables) ---
const requiredEnvVars = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID",
];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.warn(`[Firebase Config Warning] Missing environment variable: ${key}`);
  }
}

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: "printflow-x947t", // Ensure your actual projectId
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID!,
};

// --- INITIALIZE OR GET EXISTING APP ---
let clientApp: FirebaseApp;
if (getApps().length === 0) {
  clientApp = initializeApp(firebaseConfig);
  console.info("[Firebase] Initialized new app instance.");
} else {
  clientApp = getApp();
}

// --- FIRESTORE AND AUTH EXPORTS ---
export const db: Firestore = getFirestore(clientApp, "macroprintflow");
export const auth: Auth = getAuth(clientApp);

// --- COMPATIBILITY HELPERS (for legacy code) ---
/** Returns Firestore instance. Prefer `db` for new code. */
export function getDB(): Firestore {
  return db;
}

/** Returns Auth instance. Prefer `auth` for new code. */
export function getAuthInstance(): Auth {
  return auth;
}

// --- EXPORT APP IF NEEDED (rarely used directly) ---
export { clientApp };
