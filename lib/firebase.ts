import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

let auth: Auth | undefined;

const publicFirebaseDefaults: FirebaseOptions = {
  apiKey: "AIzaSyDnmJgsdmMHFe0TgBBlBsjuIpc8_rFQEuo",
  authDomain: "minimystics-eb9e2.firebaseapp.com",
  projectId: "minimystics-eb9e2",
  storageBucket: "minimystics-eb9e2.firebasestorage.app",
  messagingSenderId: "917896607047",
  appId: "1:917896607047:web:6ddd72c56cfad9d03dc862",
  measurementId: "G-H7XZ64CTJT",
};

export function getFirebaseApp(): FirebaseApp {
  const firebaseConfig: FirebaseOptions = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || publicFirebaseDefaults.apiKey,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || publicFirebaseDefaults.authDomain,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || publicFirebaseDefaults.projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || publicFirebaseDefaults.storageBucket,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || publicFirebaseDefaults.messagingSenderId,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || publicFirebaseDefaults.appId,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || publicFirebaseDefaults.measurementId,
  };

  if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId || !firebaseConfig.appId) {
    throw Object.assign(new Error("Firebase is not configured for this deployment."), { code: "auth/missing-config" });
  }

  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseAuth() {
  if (auth) return auth;
  auth = getAuth(getFirebaseApp());
  return auth;
}
