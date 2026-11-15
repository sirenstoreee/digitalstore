// Khusus server: jangan di-import dari komponen "use client".
import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function clean(value?: string) {
  return (value ?? "").trim().replace(/^"|"$/g, "");
}

export function firebaseAdminConfigured() {
  return Boolean(
    clean(process.env.FIREBASE_PROJECT_ID) &&
      clean(process.env.FIREBASE_CLIENT_EMAIL) &&
      clean(process.env.FIREBASE_PRIVATE_KEY),
  );
}

function app() {
  if (getApps().length) return getApp();
  return initializeApp({
    credential: cert({
      projectId: clean(process.env.FIREBASE_PROJECT_ID),
      clientEmail: clean(process.env.FIREBASE_CLIENT_EMAIL),
      privateKey: clean(process.env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, "\n"),
    }),
  });
}

let firestore: ReturnType<typeof getFirestore> | undefined;

export function adminDb() {
  if (!firestore) {
    firestore = getFirestore(app());
    try {
      // Hanya boleh dipasang sekali. Bila sudah pernah (mis. server dev dimuat ulang),
      // pengaturan lama tetap berlaku dan error ini aman diabaikan.
      firestore.settings({ ignoreUndefinedProperties: true });
    } catch {}
  }
  return firestore;
}

export function adminAuth() {
  return getAuth(app());
}
