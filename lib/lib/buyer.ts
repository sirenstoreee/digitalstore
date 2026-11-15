// Pengganti pb.authStore: data pembeli yang sedang login (dibaca realtime dari Firestore).
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";

export type Buyer = {
  id: string;
  username?: string;
  name?: string;
  phone?: string;
  email?: string;
  verified?: boolean;
  avatar?: string;
};

// Memanggil callback dengan data pembeli (atau null kalau belum login),
// dan memanggilnya lagi setiap profil berubah. Mengembalikan fungsi berhenti.
export function subscribeBuyer(callback: (buyer: Buyer | null) => void) {
  let stopProfile: (() => void) | undefined;

  const stopAuth = onAuthStateChanged(auth, (user) => {
    stopProfile?.();
    stopProfile = undefined;

    if (!user) {
      callback(null);
      return;
    }

    stopProfile = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => callback({ ...(snap.data() as Omit<Buyer, "id">), id: user.uid }),
      () => callback({ id: user.uid }),
    );
  });

  return () => {
    stopProfile?.();
    stopAuth();
  };
}

// Token login untuk dikirim ke API server ("" kalau belum login).
export async function authToken() {
  await auth.authStateReady();
  return auth.currentUser ? await auth.currentUser.getIdToken() : "";
}

export function logoutBuyer() {
  return signOut(auth);
}
