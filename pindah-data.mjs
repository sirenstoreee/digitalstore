// Memindahkan data toko ke Firebase (Firestore).
//
// Cara pakai (di terminal, folder digitalstore):
//   node --env-file=.env.local pindah-data.mjs
//
// - Jika PocketBase LAMA Anda masih menyala di komputer ini (http://127.0.0.1:8090) dan
//   PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD masih ada di .env.local, produk (termasuk harga,
//   stok, dan opsi), kategori, dan pengaturan toko dipindahkan apa adanya.
// - Jika tidak, daftar produk awal bawaan dimasukkan.
// Aman dijalankan berulang: data yang sudah ada di Firestore TIDAK ditimpa.
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const clean = (v) => (v ?? "").trim().replace(/^"|"$/g, "");
if (!clean(process.env.FIREBASE_PROJECT_ID) || !clean(process.env.FIREBASE_CLIENT_EMAIL) || !clean(process.env.FIREBASE_PRIVATE_KEY)) {
  console.error("FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY belum diisi di .env.local");
  process.exit(1);
}

initializeApp({
  credential: cert({
    projectId: clean(process.env.FIREBASE_PROJECT_ID),
    clientEmail: clean(process.env.FIREBASE_CLIENT_EMAIL),
    privateKey: clean(process.env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const defaultProducts = [
  {
    "slug": "money-lumber-tycoon2",
    "gameId": "lumber-tycoon2",
    "name": "Money Lumber Tycoon 2",
    "image": "/images/lumber-tycoon2/money.webp",
    "description": "Produk Money untuk Lumber Tycoon 2.",
    "price": 0,
    "stock": 100
  },
  {
    "slug": "axe-lumber-tycoon2",
    "gameId": "lumber-tycoon2",
    "name": "Axe Lumber Tycoon 2",
    "image": "/images/lumber-tycoon2/axe.webp",
    "description": "Produk Axe untuk Lumber Tycoon 2.",
    "price": 0,
    "stock": 100
  },
  {
    "slug": "gift-lumber-tycoon2",
    "gameId": "lumber-tycoon2",
    "name": "Gift Lumber Tycoon 2",
    "image": "/images/lumber-tycoon2/gift.webp",
    "description": "Produk Gift untuk Lumber Tycoon 2.",
    "price": 0,
    "stock": 100
  },
  {
    "slug": "base-lumber-tycoon2",
    "gameId": "lumber-tycoon2",
    "name": "Base Lumber Tycoon 2",
    "image": "/images/lumber-tycoon2/base.webp",
    "description": "Produk Base untuk Lumber Tycoon 2.",
    "price": 0,
    "stock": 100
  },
  {
    "slug": "wood-lumber-tycoon2",
    "gameId": "lumber-tycoon2",
    "name": "Wood Lumber Tycoon 2",
    "image": "/images/lumber-tycoon2/wood.webp",
    "description": "Produk Wood untuk Lumber Tycoon 2.",
    "price": 0,
    "stock": 100
  },
  {
    "slug": "gold-blueprint-lumber-tycoon2",
    "gameId": "lumber-tycoon2",
    "name": "Gold Blueprint Lumber Tycoon 2",
    "image": "/images/lumber-tycoon2/gold-blueprint.webp",
    "description": "Gold Blueprint untuk Lumber Tycoon 2.",
    "price": 0,
    "stock": 100
  },
  {
    "slug": "auto-cut-sawmill-lumber-tycoon2",
    "gameId": "lumber-tycoon2",
    "name": "Auto Cut Sawmill Lumber Tycoon 2",
    "image": "/images/lumber-tycoon2/auto-cut-sawmill.webp",
    "description": "Auto Cut Sawmill untuk Lumber Tycoon 2.",
    "price": 0,
    "stock": 100
  }
];

// Tulis hanya jika belum ada.
async function createIfMissing(collection, id, data) {
  try {
    await db.collection(collection).doc(id).create(data);
    return true;
  } catch (error) {
    if (error?.code === 6) return false;
    throw error;
  }
}

const isoDate = (value) => (value ? String(value).replace(" ", "T") : new Date().toISOString());

async function fromPocketBase() {
  const base = (process.env.POCKETBASE_URL || "http://127.0.0.1:8090").replace(/\/$/, "");
  if (!process.env.PB_ADMIN_EMAIL || !process.env.PB_ADMIN_PASSWORD) return null;

  let token;
  try {
    const res = await fetch(base + "/api/collections/_superusers/auth-with-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: process.env.PB_ADMIN_EMAIL, password: process.env.PB_ADMIN_PASSWORD }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    token = (await res.json()).token;
  } catch {
    return null;
  }

  const list = async (name) => {
    const res = await fetch(base + "/api/collections/" + name + "/records?perPage=500&skipTotal=1", {
      headers: { Authorization: token },
    });
    return res.ok ? (await res.json()).items : [];
  };
  return { products: await list("products"), categories: await list("store_categories"), settings: await list("store_settings") };
}

let added = 0;
let skipped = 0;
const count = (ok) => (ok ? added++ : skipped++);

const source = await fromPocketBase();

if (source && source.products.length) {
  console.log("Membaca data dari PocketBase lama...");
  for (const p of source.products) {
    count(await createIfMissing("products", p.id, {
      slug: p.slug, gameId: p.gameId, name: p.name, image: p.image ?? "", description: p.description ?? "",
      price: p.price ?? 0, stock: p.stock ?? 0, variants: Array.isArray(p.variants) ? p.variants : [],
      created: isoDate(p.created),
    }));
  }
  for (const c of source.categories) {
    count(await createIfMissing("store_categories", c.slug, { slug: c.slug, name: c.name, image: c.image ?? "", description: c.description ?? "" }));
  }
  const site = source.settings.find((s) => s.key === "site");
  if (site?.data) count(await createIfMissing("store_settings", "site", { data: site.data }));
} else {
  console.log("PocketBase lama tidak ditemukan. Memasukkan produk awal bawaan...");
  let order = 0;
  for (const p of defaultProducts) {
    count(await createIfMissing("products", p.slug, { ...p, variants: [], created: new Date(Date.now() + order++).toISOString() }));
  }
}

console.log("Selesai. Ditambahkan: " + added + ", dilewati (sudah ada): " + skipped + ".");
