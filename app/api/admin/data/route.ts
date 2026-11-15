import { getSuperuserFromToken } from "../../../../lib/payment";
import { isAdminHost } from "../../../../lib/admin-host";
import { adminDb } from "../../../../lib/firebase-admin";
import { ensureStoreDefaults, defaultStoreSettings } from "../../../../lib/store-data";
import {
  discordCounts,
  isValidDiscordWebhookUrl,
  isDiscordWebhookConfigured,
  saveDiscordWebhookUrl,
  retryDiscordEvents,
  testDiscordWebhook,
} from "../../../../lib/discord";
import { isSameRequestOrigin } from "../../../../lib/request-origin";

const COOKIE_NAME = "siren_owner_session";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function ownerToken(request: Request) {
  const cookies = request.headers.get("cookie") ?? "";
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

async function authorize(request: Request, write = false) {
  if (!isAdminHost(request.headers.get("host"))) {
    return { error: jsonError("Panel Superuser hanya tersedia di host admin.", 404) };
  }
  if (write && !isSameRequestOrigin(request)) {
    return { error: jsonError("Permintaan tidak valid.", 403) };
  }
  const token = ownerToken(request);
  if (!token || !(await getSuperuserFromToken(token))) {
    return { error: jsonError("Sesi Superuser berakhir. Silakan masuk kembali.", 401) };
  }
  await ensureStoreDefaults();
  return { db: adminDb() };
}

type Doc = { id: string; data(): unknown };
const withId = (doc: Doc) => ({
  ...(doc.data() as { name?: string; stock?: number }),
  id: doc.id,
});

export async function GET(request: Request) {
  try {
    const auth = await authorize(request);
    if (auth.error) return auth.error;
    const db = auth.db!;
    const [productSnap, categorySnap, settingSnap, orderSnap, discord] = await Promise.all([
      db.collection("products").get(),
      db.collection("store_categories").get(),
      db.collection("store_settings").doc("site").get(),
      db.collection("orders").select("status").get(),
      discordCounts(),
    ]);

    const byName = (a: { name?: string }, b: { name?: string }) =>
      String(a.name ?? "").localeCompare(String(b.name ?? ""));
    const products = productSnap.docs.map(withId).sort(byName) as {
      id: string;
      name?: string;
      stock?: number;
    }[];
    const categories = categorySnap.docs.map(withId).sort(byName);
    const statuses = orderSnap.docs.map((doc) => doc.data().status as string);

    return Response.json({
      products,
      categories,
      settings: { ...defaultStoreSettings, ...(settingSnap.data()?.data ?? {}) },
      summary: {
        products: products.length,
        categories: categories.length,
        pendingOrders: statuses.filter((status) => status === "pending").length,
        paidOrders: statuses.filter((status) => status === "paid").length,
        lowStock: products.filter((product) => Number(product.stock ?? 0) <= 5).length,
      },
      discord: { configured: await isDiscordWebhookConfigured(), ...discord },
    });
  } catch (error) {
    console.error("Admin data could not be loaded.", error);
    return jsonError("Data panel gagal dimuat.", 500);
  }
}

type ProductInput = {
  id?: string;
  slug?: string;
  gameId?: string;
  name?: string;
  image?: string;
  description?: string;
  price?: number;
  stock?: number;
  variants?: { id?: string; name?: string; price?: number; stock?: number; image?: string }[];
};

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function validImageUrl(value: string) {
  if (!value) return true;
  if (value.startsWith("/")) return !value.startsWith("//");
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authorize(request, true);
    if (auth.error) return auth.error;
    const db = auth.db!;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body.action !== "string") return jsonError("Aksi tidak valid.");

    if (body.action === "save-product") {
      const input = body.product as ProductInput | undefined;
      const name = String(input?.name ?? "").trim();
      const slug = slugify(String(input?.slug || name));
      const gameId = String(input?.gameId ?? "").trim();
      const image = String(input?.image ?? "").trim();
      const description = String(input?.description ?? "").trim();
      const price = Number(input?.price);
      const stock = Number(input?.stock);
      const variants = Array.isArray(input?.variants)
        ? input.variants.map((variant) => ({
            id: slugify(String(variant.name ?? "")),
            name: String(variant.name ?? "").trim(),
            price: Number(variant.price),
            stock: Number(variant.stock),
            image: String(variant.image ?? "").trim(),
          }))
        : [];
      if (!name || !slug || !gameId) return jsonError("Nama, slug, dan kategori wajib diisi.");
      if (!Number.isInteger(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
        return jsonError("Harga dan stok harus berupa angka bulat nol atau lebih.");
      }
      if (!validImageUrl(image)) return jsonError("Gambar harus berupa URL HTTPS atau path lokal.");
      if (variants.some((variant) => !variant.name || !variant.id || !Number.isInteger(variant.price) || variant.price < 0 || !Number.isInteger(variant.stock) || variant.stock < 0 || !validImageUrl(variant.image))) {
        return jsonError("Setiap opsi harus memiliki nama, harga bulat, stok bulat, dan gambar yang valid.");
      }
      if (new Set(variants.map((variant) => variant.id)).size !== variants.length) {
        return jsonError("Nama opsi produk harus berbeda.");
      }
      const data = {
        slug, gameId, name, image, description,
        price: variants.length ? Math.min(...variants.map((variant) => variant.price)) : price,
        stock: variants.length ? variants.reduce((sum, variant) => sum + variant.stock, 0) : stock,
        variants,
      };

      const duplicate = await db.collection("products").where("slug", "==", slug).get();
      if (duplicate.docs.some((doc) => doc.id !== input?.id)) {
        return jsonError("Slug sudah dipakai produk lain. Ganti nama atau slug produk.", 409);
      }

      if (input?.id) {
        const ref = db.collection("products").doc(String(input.id));
        if (!(await ref.get()).exists) return jsonError("Produk tidak ditemukan.", 404);
        await ref.update(data);
        return Response.json({ product: { ...data, id: ref.id } });
      }
      const ref = db.collection("products").doc();
      await ref.set({ ...data, created: new Date().toISOString() });
      return Response.json({ product: { ...data, id: ref.id } });
    }

    if (body.action === "delete-product") {
      const id = String(body.id ?? "");
      if (!id) return jsonError("Produk tidak dipilih.");
      const active = await db
        .collection("orders")
        .where("status", "in", ["pending", "paid", "processing"])
        .get();
      const used = active.docs.some((doc) =>
        ((doc.data().items ?? []) as { recordId?: string }[]).some(
          (item) => item.recordId === id,
        ),
      );
      if (used) {
        return jsonError("Produk masih terkait dengan pesanan aktif. Ubah stok menjadi 0 jika ingin menutup penjualan.", 409);
      }
      await db.collection("products").doc(id).delete();
      return Response.json({ ok: true });
    }

    if (body.action === "save-category") {
      const input = body.category as {
        id?: string;
        slug?: string;
        name?: string;
        image?: string;
        description?: string;
      } | undefined;
      const name = String(input?.name ?? "").trim();
      const slug = slugify(String(input?.slug || name));
      const image = String(input?.image ?? "").trim();
      const description = String(input?.description ?? "").trim();
      if (!name || !slug) return jsonError("Nama dan slug kategori wajib diisi.");
      if (!validImageUrl(image)) return jsonError("Gambar harus berupa URL HTTPS atau path lokal.");

      const duplicate = await db.collection("store_categories").where("slug", "==", slug).get();
      if (duplicate.docs.some((doc) => doc.id !== input?.id)) {
        return jsonError("Slug kategori sudah dipakai.", 409);
      }

      if (input?.id) {
        const ref = db.collection("store_categories").doc(String(input.id));
        const previous = await ref.get();
        if (!previous.exists) return jsonError("Kategori tidak ditemukan.", 404);
        const previousSlug = String(previous.data()?.slug ?? "");
        if (previousSlug && previousSlug !== slug) {
          const products = await db.collection("products").where("gameId", "==", previousSlug).get();
          const batch = db.batch();
          for (const product of products.docs) batch.update(product.ref, { gameId: slug });
          await batch.commit();
        }
        await ref.update({ slug, name, image, description });
        return Response.json({ category: { id: ref.id, slug, name, image, description } });
      }
      const ref = db.collection("store_categories").doc();
      await ref.set({ slug, name, image, description });
      return Response.json({ category: { id: ref.id, slug, name, image, description } });
    }

    if (body.action === "delete-category") {
      const id = String(body.id ?? "");
      const ref = db.collection("store_categories").doc(id);
      const category = await ref.get();
      if (!category.exists) return jsonError("Kategori tidak ditemukan.", 404);
      const products = await db
        .collection("products")
        .where("gameId", "==", String(category.data()?.slug ?? ""))
        .limit(1)
        .get();
      if (!products.empty) return jsonError("Kategori masih memiliki produk. Pindahkan produknya terlebih dahulu.", 409);
      await ref.delete();
      return Response.json({ ok: true });
    }

    if (body.action === "save-settings") {
      const input = body.settings as Record<string, unknown> | undefined;
      const accentColor = String(input?.accentColor ?? defaultStoreSettings.accentColor);
      const backgroundColor = String(input?.backgroundColor ?? defaultStoreSettings.backgroundColor);
      if (!/^#[0-9a-f]{6}$/i.test(accentColor) || !/^#[0-9a-f]{6}$/i.test(backgroundColor)) {
        return jsonError("Warna harus dalam format hex #RRGGBB.");
      }
      const settings = {
        storeName: String(input?.storeName ?? "").trim().slice(0, 80) || defaultStoreSettings.storeName,
        tagline: String(input?.tagline ?? "").trim().slice(0, 120),
        heroTitle: String(input?.heroTitle ?? "").trim().slice(0, 180),
        heroDescription: String(input?.heroDescription ?? "").trim().slice(0, 500),
        accentColor,
        backgroundColor,
      };
      await db.collection("store_settings").doc("site").set({ data: settings });
      return Response.json({ settings });
    }

    if (body.action === "retry-discord") {
      const attempted = await retryDiscordEvents();
      return Response.json({ attempted });
    }

    if (body.action === "save-discord-webhook") {
      const webhookUrl = String(body.webhookUrl ?? "");
      if (!isValidDiscordWebhookUrl(webhookUrl.trim())) {
        return jsonError("URL harus berupa link webhook Discord HTTPS yang valid.");
      }
      await saveDiscordWebhookUrl(webhookUrl);
      return Response.json({ ok: true });
    }

    if (body.action === "test-discord") {
      await testDiscordWebhook();
      return Response.json({ ok: true });
    }

    return jsonError("Aksi tidak dikenal.", 404);
  } catch (error) {
    console.error("Admin operation failed.", error);
    return jsonError("Perubahan gagal disimpan. Periksa data lalu coba lagi.", 500);
  }
}
