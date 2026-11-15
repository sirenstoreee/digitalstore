// Khusus server: jangan di-import dari komponen "use client".
import { createHash } from "crypto";
import type { DocumentReference, Firestore, Transaction } from "firebase-admin/firestore";
import { queueDiscordOrderNotice } from "./discord";
import { adminAuth, adminDb, firebaseAdminConfigured } from "./firebase-admin";
import { verifyOwnerToken } from "./owner-session";

// Mode ditentukan eksplisit: Sandbox (uang uji) kecuali MIDTRANS_IS_PRODUCTION=true.
const serverKey = process.env.MIDTRANS_SERVER_KEY ?? "";
const isSandbox = process.env.MIDTRANS_IS_PRODUCTION !== "true";

const SNAP_URL = isSandbox
  ? "https://app.sandbox.midtrans.com/snap/v1/transactions"
  : "https://app.midtrans.com/snap/v1/transactions";
const API_URL = isSandbox
  ? "https://api.sandbox.midtrans.com"
  : "https://api.midtrans.com";

// Metode bayar yang boleh dipilih pembeli -> channel Midtrans (ditentukan di server).
// QRIS umum bisa di-scan dari DANA, OVO, GoPay, ShopeePay, dan m-banking.
export const PAYMENT_CHANNELS: Record<string, string[]> = {
  qris: ["other_qris"],
  bca: ["bca_va"],
  bni: ["bni_va"],
  bri: ["bri_va"],
  mandiri: ["echannel"],
};

export type OrderItem = {
  recordId: string;
  slug: string;
  gameId?: string;
  name: string;
  image?: string;
  variantId?: string;
  variantName?: string;
  price: number;
  quantity: number;
};

export type OrderRecord = {
  id: string;
  orderCode: string;
  user: string;
  items: OrderItem[];
  amount: number;
  status: string;
  created?: string;
  updated?: string;
  stockReduced?: boolean;
  cancelRequested?: boolean;
  processedAt?: string;
};

export type MidtransStatus = {
  order_id: string;
  transaction_status?: string;
  fraud_status?: string;
  status_code?: string;
  gross_amount?: string;
  payment_type?: string;
  va_numbers?: { bank?: string; va_number?: string }[];
  transaction_id?: string;
  signature_key?: string;
};

export function assertConfigured() {
  if (!serverKey || !firebaseAdminConfigured()) {
    throw new Error(
      "Konfigurasi pembayaran belum lengkap. Periksa environment (.env.local / Vercel).",
    );
  }
}

function basicAuth() {
  return "Basic " + Buffer.from(serverKey + ":").toString("base64");
}

// Kode order dipakai sebagai ID dokumen, jadi harus aman (tanpa "/").
export function validOrderCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,60}$/.test(value);
}

// Memeriksa token login pembeli (Firebase ID token), lalu mengembalikan data profilnya.
export async function getUserFromToken(token: string) {
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    const snap = await adminDb().collection("users").doc(decoded.uid).get();
    const profile = (snap.data() ?? {}) as {
      username?: string;
      name?: string;
      email?: string;
      phone?: string;
    };
    return {
      id: decoded.uid,
      username: profile.username,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
    };
  } catch {
    return null;
  }
}

// Memeriksa sesi owner (cookie bertanda tangan).
export async function getSuperuserFromToken(token: string) {
  return verifyOwnerToken(token) ? { id: "owner" } : null;
}

// Semua pesanan untuk panel owner, lengkap dengan data pembelinya.
export async function getOwnerOrders(token: string) {
  if (!(await getSuperuserFromToken(token))) return null;

  const db = adminDb();
  const snap = await db.collection("orders").orderBy("created", "desc").get();
  const orders = snap.docs.map((doc) => ({
    ...(doc.data() as Omit<OrderRecord, "id">),
    id: doc.id,
  }));

  const userIds = [...new Set(orders.map((order) => order.user).filter(Boolean))];
  const users = new Map<string, unknown>();
  if (userIds.length) {
    const docs = await db.getAll(
      ...userIds.map((id) => db.collection("users").doc(id)),
    );
    for (const doc of docs) {
      if (doc.exists) users.set(doc.id, { id: doc.id, ...doc.data() });
    }
  }

  return orders.map((order) => ({
    ...order,
    expand: { user: users.get(order.user) },
  }));
}

export async function createSnapTransaction(body: unknown) {
  const response = await fetch(SNAP_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: basicAuth(),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, data };
}

export async function fetchMidtransStatus(
  orderCode: string,
): Promise<MidtransStatus | null> {
  const response = await fetch(
    `${API_URL}/v2/${encodeURIComponent(orderCode)}/status`,
    {
      headers: { Accept: "application/json", Authorization: basicAuth() },
      cache: "no-store",
    },
  );

  if (!response.ok) return null;
  return (await response.json().catch(() => null)) as MidtransStatus | null;
}

// SHA512(order_id + status_code + gross_amount + ServerKey)
export function isValidSignature(n: MidtransStatus) {
  if (!n.order_id || !n.status_code || !n.gross_amount || !n.signature_key) {
    return false;
  }

  const expected = createHash("sha512")
    .update(`${n.order_id}${n.status_code}${n.gross_amount}${serverKey}`)
    .digest("hex");

  return expected === n.signature_key;
}

function mapStatus(n: MidtransStatus) {
  const status = n.transaction_status;
  const fraud = (n.fraud_status ?? "accept").toLowerCase();

  if (status === "settlement") return "paid";
  if (status === "capture" && fraud === "accept") return "paid";
  if (status === "expire") return "expired";
  if (status === "cancel") return "cancelled";
  if (status === "deny" || status === "failure") return "failed";
  return "pending";
}

// ---------------------------------------------------------------------------
// Stok. Semua perubahan stok terjadi DI DALAM transaksi Firestore bersama perubahan
// status order, sehingga stok tidak bisa berkurang dua kali walau notifikasi Midtrans,
// tombol "Cek Status", dan aksi owner datang bersamaan.
// ---------------------------------------------------------------------------

type ProductDoc = {
  stock?: number;
  variants?: { id: string; name?: string; price?: number; stock: number; image?: string }[];
};

// Penting: di transaksi Firestore semua pembacaan harus dilakukan SEBELUM penulisan.
async function loadProducts(tx: Transaction, db: Firestore, items: OrderItem[]) {
  const ids = [...new Set(items.map((item) => item.recordId))];
  const products = new Map<string, ProductDoc>();
  if (!ids.length) return products;

  const snaps = await tx.getAll(
    ...ids.map((id) => db.collection("products").doc(id)),
  );
  for (const snap of snaps) {
    if (snap.exists) products.set(snap.id, snap.data() as ProductDoc);
  }
  return products;
}

// direction -1 = kurangi stok (dibayar), +1 = kembalikan stok (pembatalan disetujui).
function changeStock(
  products: Map<string, ProductDoc>,
  items: OrderItem[],
  direction: 1 | -1,
) {
  for (const item of items) {
    const product = products.get(item.recordId);
    if (!product) {
      console.error(`Produk ${item.slug} tidak ditemukan saat mengubah stok`);
      continue;
    }

    if (item.variantId) {
      // Stok tidak pernah di bawah 0 (bila terlanjur kurang, dicatat 0).
      const variants = (product.variants ?? []).map((variant) =>
        variant.id === item.variantId
          ? {
              ...variant,
              stock: Math.max(0, variant.stock + direction * item.quantity),
            }
          : variant,
      );
      product.variants = variants;
      product.stock = variants.reduce((sum, variant) => sum + variant.stock, 0);
    } else {
      product.stock = Math.max(0, (product.stock ?? 0) + direction * item.quantity);
    }
  }
}

function writeProducts(
  tx: Transaction,
  db: Firestore,
  products: Map<string, ProductDoc>,
) {
  for (const [id, product] of products) {
    tx.update(db.collection("products").doc(id), {
      stock: product.stock ?? 0,
      ...(product.variants ? { variants: product.variants } : {}),
    });
  }
}

function readOrder(snap: { id: string; data(): unknown }): OrderRecord {
  return { ...(snap.data() as Omit<OrderRecord, "id">), id: snap.id };
}

export type ApplyResult = { ok: boolean; reason?: string; status?: string };

type PaidNotice = { order: OrderRecord; n: MidtransStatus };

export async function applyMidtransStatus(n: MidtransStatus): Promise<ApplyResult> {
  if (!n.transaction_status) return { ok: false, reason: "no-status" };
  if (!validOrderCode(n.order_id)) return { ok: false, reason: "bad-order-id" };

  const db = adminDb();
  const ref = db.collection("orders").doc(n.order_id);
  let paidNotice = null as PaidNotice | null;

  const result = await db.runTransaction(async (tx): Promise<ApplyResult> => {
    paidNotice = null; // transaksi bisa diulang otomatis oleh Firestore
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, reason: "order-not-found" };
    const order = readOrder(snap);

    // Nominal dari Midtrans harus sama dengan nominal order kita.
    if (
      n.gross_amount !== undefined &&
      Math.round(Number(n.gross_amount)) !== order.amount
    ) {
      console.error(`Nominal tidak cocok untuk order ${order.orderCode}`);
      return { ok: false, reason: "amount-mismatch" };
    }

    // Hanya order yang masih menunggu pembayaran yang boleh berubah oleh Midtrans.
    // Order lunas / diproses / selesai / dibatalkan tidak pernah ditimpa lagi.
    if (order.status !== "pending" && order.status !== "failed") {
      if (order.status === "cancelled" && mapStatus(n) === "paid") {
        console.error(
          `Order ${order.orderCode} sudah dibatalkan tetapi dibayar di Midtrans. Perlu refund manual.`,
        );
      }
      return { ok: true, status: order.status };
    }

    const next = mapStatus(n);

    if (next === "paid") {
      const products = order.stockReduced
        ? new Map<string, ProductDoc>()
        : await loadProducts(tx, db, order.items);

      if (!order.stockReduced) {
        changeStock(products, order.items, -1);
        writeProducts(tx, db, products);
      }

      tx.update(ref, {
        status: "paid",
        paidAt: new Date().toISOString(),
        paymentType: n.payment_type ?? "",
        paymentBank: n.va_numbers?.[0]?.bank ?? "",
        midtransTransactionId: n.transaction_id ?? "",
        stockReduced: true,
      });

      paidNotice = { order, n };
      return { ok: true, status: "paid" };
    }

    if (next !== order.status) {
      tx.update(ref, { status: next, updated: new Date().toISOString() });
    }
    return { ok: true, status: next };
  });

  const notice = paidNotice as PaidNotice | null;
  if (notice) {
    let buyerName = "Pembeli";
    try {
      const buyer = await db.collection("users").doc(notice.order.user).get();
      const profile = (buyer.data() ?? {}) as { name?: string; username?: string };
      buyerName = profile.name || profile.username || buyerName;
    } catch {}

    await queueDiscordOrderNotice("paid", {
      orderCode: notice.order.orderCode,
      buyerName,
      amount: notice.order.amount,
      items: notice.order.items,
      method: notice.n.payment_type,
      bank: notice.n.va_numbers?.[0]?.bank,
    });
  }

  return result;
}

export type ActionResult = {
  ok: boolean;
  error?: string;
  status?: string;
  code?: number;
};

const fail = (error: string, code = 400): ActionResult => ({
  ok: false,
  error,
  code,
});

function orderRef(db: Firestore, orderCode: string): DocumentReference {
  return db.collection("orders").doc(orderCode);
}

// Pembeli mengajukan pembatalan. Hanya untuk pesanan yang sudah dibayar dan belum diproses.
// Pembatalan baru berlaku setelah disetujui owner.
export async function requestCancel(
  orderCode: string,
  userId: string,
): Promise<ActionResult> {
  if (!validOrderCode(orderCode)) return fail("Order tidak ditemukan.", 404);
  const db = adminDb();
  const ref = orderRef(db, orderCode);

  return db.runTransaction(async (tx): Promise<ActionResult> => {
    const snap = await tx.get(ref);
    const order = snap.exists ? readOrder(snap) : null;

    if (!order || order.user !== userId) {
      return fail("Order tidak ditemukan.", 404);
    }
    if (order.status === "processing" || order.status === "completed") {
      return fail("Pesanan sudah diproses, tidak dapat dibatalkan.");
    }
    if (order.status !== "paid") {
      return fail(
        "Pembatalan hanya untuk pesanan yang sudah dibayar. Pesanan yang belum dibayar akan kedaluwarsa otomatis.",
      );
    }
    if (order.cancelRequested) {
      return fail("Permintaan pembatalan sudah dikirim, menunggu owner.");
    }

    tx.update(ref, {
      cancelRequested: true,
      cancelRequestedAt: new Date().toISOString(),
    });

    return { ok: true, status: order.status };
  });
}

export type OwnerAction =
  | "process"
  | "complete"
  | "approve-cancel"
  | "reject-cancel";

export const OWNER_ACTIONS: OwnerAction[] = [
  "process",
  "complete",
  "approve-cancel",
  "reject-cancel",
];

// Aksi owner / superuser atas sebuah order.
export async function ownerUpdateOrder(
  orderCode: string,
  action: OwnerAction,
): Promise<ActionResult> {
  if (!validOrderCode(orderCode)) return fail("Order tidak ditemukan.", 404);
  const db = adminDb();
  const ref = orderRef(db, orderCode);

  return db.runTransaction(async (tx): Promise<ActionResult> => {
    const snap = await tx.get(ref);
    if (!snap.exists) return fail("Order tidak ditemukan.", 404);
    const order = readOrder(snap);

    const now = new Date().toISOString();

    if (action === "reject-cancel") {
      if (!order.cancelRequested) return fail("Tidak ada permintaan pembatalan.");
      tx.update(ref, { cancelRequested: false });
      return { ok: true, status: order.status };
    }

    if (action === "approve-cancel") {
      if (!order.cancelRequested) return fail("Tidak ada permintaan pembatalan.");
      if (order.status !== "paid") {
        return fail("Pesanan sudah diproses, tidak dapat dibatalkan.");
      }

      if (order.stockReduced) {
        const products = await loadProducts(tx, db, order.items);
        changeStock(products, order.items, 1);
        writeProducts(tx, db, products);
      }

      tx.update(ref, {
        status: "cancelled",
        cancelledAt: now,
        cancelRequested: false,
        stockReduced: false,
      });
      return { ok: true, status: "cancelled" };
    }

    if (order.cancelRequested) {
      return fail("Ada permintaan pembatalan. Setujui atau tolak dulu.");
    }

    if (action === "process") {
      if (order.status !== "paid") {
        return fail("Hanya pesanan yang sudah dibayar yang bisa diproses.");
      }
      tx.update(ref, { status: "processing", processedAt: now });
      return { ok: true, status: "processing" };
    }

    if (action === "complete") {
      if (order.status !== "processing") {
        return fail("Pesanan harus berstatus Sedang Diproses sebelum dapat diselesaikan.");
      }
      tx.update(ref, {
        status: "completed",
        completedAt: now,
        processedAt: order.processedAt || now,
      });
      return { ok: true, status: "completed" };
    }

    return fail("Aksi tidak dikenal.");
  });
}
