import { connection } from "next/server";
import { adminDb } from "./firebase-admin";
import { games } from "./games";
import { preferWebpPath } from "./image-path";

export type StoreCategory = {
  id: string;
  slug: string;
  name: string;
  image: string;
  description: string;
};

export type StoreSettings = {
  storeName: string;
  tagline: string;
  heroTitle: string;
  heroDescription: string;
  accentColor: string;
  backgroundColor: string;
};

export const defaultStoreSettings: StoreSettings = {
  storeName: "SIREN OFFICIAL",
  tagline: "JOKI TERPERCAYA, CEPAT, DAN AMAN 100%",
  heroTitle: "Item game favorit,\nlangsung di tangan.",
  heroDescription:
    "Top up dan produk game dengan proses yang jelas, aman, dan praktis.",
  accentColor: "#a78bfa",
  backgroundColor: "#090b10",
};

export const categoryFallback: StoreCategory[] = games.map((game) => ({
  id: game.id,
  slug: game.id,
  name: game.name,
  image: game.image,
  description: game.description,
}));

export async function getStoreCategories(): Promise<StoreCategory[]> {
  await connection(); // selalu baca data terbaru saat halaman dibuka
  try {
    const snap = await adminDb().collection("store_categories").get();
    const categories = snap.docs
      .map((doc) => {
        const data = doc.data() as Omit<StoreCategory, "id">;
        return { ...data, image: preferWebpPath(data.image), id: doc.id };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return categories.length ? categories : categoryFallback;
  } catch {
    return categoryFallback;
  }
}

export async function getStoreCategory(slug: string) {
  const categories = await getStoreCategories();
  return categories.find((category) => category.slug === slug) ?? null;
}

export async function getStoreSettings(): Promise<StoreSettings> {
  await connection();
  try {
    const snap = await adminDb().collection("store_settings").doc("site").get();
    const data = (snap.data()?.data ?? {}) as Partial<StoreSettings>;
    return { ...defaultStoreSettings, ...data };
  } catch {
    return defaultStoreSettings;
  }
}

// Mengisi kategori dan pengaturan awal bila database masih kosong.
export async function ensureStoreDefaults() {
  const db = adminDb();

  const categories = await db.collection("store_categories").limit(1).get();
  if (categories.empty) {
    const batch = db.batch();
    for (const category of categoryFallback) {
      batch.set(db.collection("store_categories").doc(category.slug), {
        slug: category.slug,
        name: category.name,
        image: category.image,
        description: category.description,
      });
    }
    await batch.commit();
  }

  const settings = db.collection("store_settings").doc("site");
  if (!(await settings.get()).exists) {
    await settings.set({ data: defaultStoreSettings });
  }
}
