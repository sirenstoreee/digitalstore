import { connection } from "next/server";
import { adminDb } from "./firebase-admin";
import { preferWebpPath } from "./image-path";

export type DbProduct = {
  recordId: string;
  id: string; // slug, dipakai di URL dan keranjang
  gameId: string;
  name: string;
  image: string;
  description: string;
  price: string; // teks untuk ditampilkan
  priceValue: number; // angka rupiah, 0 = belum ditentukan
  stock: number;
  variants: ProductVariant[];
};

export type ProductVariant = {
  id: string;
  name: string;
  price: number;
  stock: number;
  image?: string;
};

type ProductRecord = {
  id: string;
  slug: string;
  gameId: string;
  name: string;
  image?: string;
  description?: string;
  price?: number;
  stock?: number;
  variants?: ProductVariant[];
  created?: string;
};

function formatPrice(value: number) {
  return value > 0
    ? `Rp ${value.toLocaleString("id-ID")}`
    : "Harga belum ditentukan";
}

function toProduct(record: ProductRecord): DbProduct {
  const priceValue = record.price ?? 0;

  return {
    recordId: record.id,
    id: record.slug,
    gameId: record.gameId,
    name: record.name,
    image: preferWebpPath(record.image),
    description: record.description ?? "",
    price: formatPrice(priceValue),
    priceValue,
    stock: record.stock ?? 0,
    variants: Array.isArray(record.variants)
      ? record.variants.map((variant) => ({
          ...variant,
          ...(variant.image ? { image: preferWebpPath(variant.image) } : {}),
        }))
      : [],
  };
}

function toRecords(docs: { id: string; data(): unknown }[]) {
  return docs
    .map((doc) => ({ ...(doc.data() as Omit<ProductRecord, "id">), id: doc.id }))
    .sort((a, b) => String(a.created ?? "").localeCompare(String(b.created ?? "")));
}

export async function getProducts(): Promise<DbProduct[]> {
  await connection();
  const snap = await adminDb().collection("products").get();
  return toRecords(snap.docs).map(toProduct);
}

export async function getProductsByGame(gameId: string): Promise<DbProduct[]> {
  await connection();
  const snap = await adminDb()
    .collection("products")
    .where("gameId", "==", gameId)
    .get();
  return toRecords(snap.docs).map(toProduct);
}

export async function getProduct(
  gameId: string,
  slug: string,
): Promise<DbProduct | null> {
  await connection();
  const snap = await adminDb()
    .collection("products")
    .where("gameId", "==", gameId)
    .where("slug", "==", slug)
    .limit(1)
    .get();
  const [record] = toRecords(snap.docs);
  return record ? toProduct(record) : null;
}
