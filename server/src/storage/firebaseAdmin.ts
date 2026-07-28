import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { config } from "../config.js";

function firebaseApp() {
  if (!config.firebaseProjectId) {
    throw new Error("FIREBASE_PROJECT_ID or GOOGLE_CLOUD_PROJECT is required for Firebase storage.");
  }

  return getApps()[0] ?? initializeApp({
    credential: applicationDefault(),
    projectId: config.firebaseProjectId,
    storageBucket: config.firebaseStorageBucket || undefined
  });
}

export function usesFirestore() {
  return config.persistenceProvider === "firestore";
}

export function usesCloudStorage() {
  return config.assetStorageProvider === "gcs";
}

export function firestoreDb() {
  if (!usesFirestore()) return undefined;
  return getFirestore(firebaseApp());
}

export function storageBucket() {
  if (!usesCloudStorage()) return undefined;
  if (!config.firebaseStorageBucket) {
    throw new Error("FIREBASE_STORAGE_BUCKET is required when ASSET_STORAGE_PROVIDER=gcs.");
  }
  return getStorage(firebaseApp()).bucket(config.firebaseStorageBucket);
}
