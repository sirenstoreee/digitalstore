import {
  applyMidtransStatus,
  assertConfigured,
  createSnapTransaction,
  fetchMidtransStatus,
  getOwnerOrders,
  getSuperuserFromToken,
  getUserFromToken,
  isValidSignature,
  OWNER_ACTIONS,
  ownerUpdateOrder,
  PAYMENT_CHANNELS,
  requestCancel,
  validOrderCode,
  type MidtransStatus,
  type OrderItem,
  type OrderRecord,
  type OwnerAction,
} from "../../../../lib/payment";
import { adminDb } from "../../../../lib/firebase-admin";
import {
  checkOwnerLogin,
  createOwnerToken,
  ownerConfigured,
} from "../../../../lib/owner-session";
import { isAdminHost } from "../../../../lib/admin-host";
import { queueDiscordOrderNotice } from "../../../../lib/discord";
import { isSameRequestOrigin } from "../../../../lib/request-origin";

type RouteContext = { params: Promise<{ action: string }> };

type ProductRecord = {
  id: string;
  slug: string;
  gameId?: string;
  name: string;
  image?: string;
  price?: number;
  stock?: number;
  variants?: { id: string; name: string; price: number; stock: number }[];
};

const OWNER_COOKIE = "siren_owner_session";

function ownerToken(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)siren_owner_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function ownerCookie(token: string, clear = false) {
  const parts = [
    `${OWNER_COOKIE}=${clear ? "" : encodeURIComponent(token)}`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${clear ? 0 : 3600}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function bearer(request: Request) {
  return request.headers.get("authorization")?.replace("Bearer ", "") ?? "";
}

async function readUser(request: Request) {
  const token = bearer(request);
  return token ? getUserFromToken(token) : null;
}

export async function POST(request: Request, { params }: RouteContext) {
  const { action } = await params;

  try {
    assertConfigured();

    if (action === "checkout") return await checkout(request);
    if (action === "verify") return await verify(request);
    if (action === "notification") return await notification(request);
    if (action === "cancel-request") return await cancelRequest(request);
    if (action === "owner-login") return await ownerLogin(request);
    if (action === "owner-logout") return await ownerLogout(request);
    if (action === "owner-orders") return await ownerOrders(request);
    if (action === "owner") return await owner(request);

    return fail("Tidak ditemukan.", 404);
  } catch (error) {
    console.error(`Payment ${action} error:`, error);
    return fail("Terjadi kesalahan di server.", 500);
  }
}

// 1) Pembeli menekan "Bayar": buat order + minta halaman bayar Midtrans.
async function checkout(request: Request) {
  const user = await readUser(request);
  if (!user) return fail("Silakan masuk dulu.", 401);

  const body = (await request.json().catch(() => null)) as {
    items?: { id?: string; quantity?: number; variantId?: string }[];
    method?: string;
  } | null;

  const requested = body?.items;
  if (!Array.isArray(requested) || requested.length === 0) {
    return fail("Keranjang kosong.");
  }
  if (requested.length > 20) return fail("Terlalu banyak item.");

  // Metode bayar dibatasi di server ke channel yang didukung toko.
  let channels: string[] | undefined;
  if (body?.method !== undefined) {
    channels = PAYMENT_CHANNELS[body.method];
    if (!channels) return fail("Metode pembayaran tidak dikenal.");
  }

  const db = adminDb();
  const items: OrderItem[] = [];

  for (const entry of requested) {
    const quantity = Number(entry.quantity);
    if (!entry.id || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return fail("Data pesanan tidak valid.");
    }

    // Harga dan stok selalu diambil dari database, bukan dari browser.
    const productSnap = await db
      .collection("products")
      .where("slug", "==", String(entry.id))
      .limit(1)
      .get();
    const product = productSnap.empty
      ? null
      : ({
          ...productSnap.docs[0].data(),
          id: productSnap.docs[0].id,
        } as ProductRecord);

    if (!product) return fail("Produk tidak ditemukan.", 404);

    const selectedVariant = entry.variantId
      ? product.variants?.find((variant) => variant.id === entry.variantId)
      : undefined;
    if ((product.variants?.length ?? 0) > 0 && !selectedVariant) {
      return fail(`Pilih jenis produk untuk ${product.name}.`);
    }
    const price = selectedVariant?.price ?? product.price ?? 0;
    const availableStock = selectedVariant?.stock ?? product.stock ?? 0;
    if (price <= 0) {
      return fail(`Harga ${product.name} belum ditentukan.`);
    }
    if (availableStock < quantity) {
      return fail(`Stok ${product.name} tidak cukup.`);
    }

    const existing = items.find((item) => item.slug === product.slug && item.variantId === selectedVariant?.id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({
        recordId: product.id,
        slug: product.slug,
        name: product.name,
        ...(product.gameId ? { gameId: product.gameId } : {}),
        ...(selectedVariant
          ? { variantId: selectedVariant.id, variantName: selectedVariant.name }
          : {}),
        ...(product.image ? { image: product.image } : {}),
        price,
        quantity,
      });
    }
  }

  const amount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  const orderCode = `SIREN-${Date.now()}-${random}`;

  // Kode order dipakai sebagai ID dokumen order.
  const orderRef = db.collection("orders").doc(orderCode);
  await orderRef.set({
    orderCode,
    user: user.id,
    items,
    amount,
    status: "pending",
    stockReduced: false,
    created: new Date().toISOString(),
  });

  const snap = await createSnapTransaction({
    transaction_details: { order_id: orderCode, gross_amount: amount },
    item_details: items.map((item) => ({
      id: item.slug.slice(0, 50),
      name: `${item.name}${item.variantName ? ` - ${item.variantName}` : ""}`.slice(0, 50),
      price: item.price,
      quantity: item.quantity,
    })),
    customer_details: {
      first_name: String(user.name || user.username || "Pembeli"),
      email: user.email || undefined,
      phone: user.phone || undefined,
    },
    ...(channels ? { enabled_payments: channels } : {}),
  });

  if (!snap.ok || !snap.data.token) {
    console.error("Midtrans menolak transaksi:", snap.data);
    await orderRef.update({ status: "failed", updated: new Date().toISOString() });
    return fail("Gagal membuat pembayaran. Coba lagi sebentar.", 502);
  }

  await orderRef.update({ snapToken: snap.data.token });

  await queueDiscordOrderNotice("created", {
    orderCode,
    amount,
    items,
    method: body?.method,
  });

  return Response.json({
    orderCode,
    token: snap.data.token,
    redirectUrl: snap.data.redirect_url,
  });
}

// 2) Setelah bayar: tanya status langsung ke Midtrans (cadangan selain notifikasi).
async function verify(request: Request) {
  const user = await readUser(request);
  if (!user) return fail("Silakan masuk dulu.", 401);

  const body = (await request.json().catch(() => null)) as {
    orderCode?: string;
  } | null;
  if (!body?.orderCode) return fail("Kode order kosong.");

  if (!validOrderCode(body.orderCode)) return fail("Order tidak ditemukan.", 404);
  const orderSnap = await adminDb().collection("orders").doc(body.orderCode).get();
  const order = orderSnap.exists
    ? ({ ...orderSnap.data(), id: orderSnap.id } as OrderRecord)
    : null;

  if (!order || order.user !== user.id) return fail("Order tidak ditemukan.", 404);

  const status = await fetchMidtransStatus(order.orderCode);
  if (status?.transaction_status) {
    const result = await applyMidtransStatus({
      ...status,
      order_id: order.orderCode,
    });
    return Response.json({ status: result.status ?? order.status });
  }

  return Response.json({ status: order.status });
}

// 3) Notifikasi otomatis dari Midtrans (Payment Notification URL).
async function notification(request: Request) {
  const payload = (await request.json().catch(() => null)) as MidtransStatus | null;

  if (!payload || !isValidSignature(payload)) {
    return fail("Signature tidak valid.", 403);
  }

  const result = await applyMidtransStatus(payload);
  if (!result.ok) console.error("Notifikasi tidak diproses:", result.reason);

  // Balas 200 supaya Midtrans tidak mengulang kirim untuk order yang memang tidak valid.
  return Response.json({ ok: true });
}

async function ownerLogin(request: Request) {
  if (!isAdminHost(request.headers.get("host"))) {
    return fail("Panel Superuser hanya tersedia di host admin.", 404);
  }
  if (!isSameRequestOrigin(request)) return fail("Permintaan tidak valid.", 403);
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;
  if (!body?.email || !body.password) return fail("Email dan password wajib diisi.");

  if (!ownerConfigured()) {
    return fail(
      "Login owner belum dikonfigurasi. Isi ADMIN_EMAIL, ADMIN_PASSWORD, dan ADMIN_SESSION_SECRET (minimal 16 karakter).",
      503,
    );
  }
  if (!checkOwnerLogin(body.email, body.password)) {
    return fail("Email atau password owner salah.", 401);
  }

  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": ownerCookie(createOwnerToken()) } },
  );
}

async function ownerLogout(request: Request) {
  if (!isAdminHost(request.headers.get("host"))) {
    return fail("Panel Superuser hanya tersedia di host admin.", 404);
  }
  if (!isSameRequestOrigin(request)) return fail("Permintaan tidak valid.", 403);
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": ownerCookie("", true) } },
  );
}

async function ownerOrders(request: Request) {
  if (!isAdminHost(request.headers.get("host"))) {
    return fail("Panel Superuser hanya tersedia di host admin.", 404);
  }
  if (!isSameRequestOrigin(request)) return fail("Permintaan tidak valid.", 403);
  const token = ownerToken(request);
  const orders = token ? await getOwnerOrders(token).catch(() => null) : null;
  if (!orders) return fail("Sesi owner berakhir. Silakan masuk kembali.", 401);
  return Response.json({ orders });
}

// 4) Pembeli mengajukan pembatalan (menunggu persetujuan owner).
async function cancelRequest(request: Request) {
  const user = await readUser(request);
  if (!user) return fail("Silakan masuk dulu.", 401);

  const body = (await request.json().catch(() => null)) as {
    orderCode?: string;
  } | null;
  if (!body?.orderCode) return fail("Kode order kosong.");

  const result = await requestCancel(body.orderCode, user.id);
  if (!result.ok) return fail(result.error ?? "Gagal.", result.code ?? 400);

  return Response.json({ status: result.status });
}

// 5) Aksi owner / superuser: proses, selesaikan, setujui / tolak pembatalan.
async function owner(request: Request) {
  if (!isAdminHost(request.headers.get("host"))) {
    return fail("Panel Superuser hanya tersedia di host admin.", 404);
  }
  if (!isSameRequestOrigin(request)) return fail("Permintaan tidak valid.", 403);
  const token = ownerToken(request);
  const superuser = token ? await getSuperuserFromToken(token) : null;
  if (!superuser) return fail("Hanya owner yang bisa melakukan ini.", 403);

  const body = (await request.json().catch(() => null)) as {
    orderCode?: string;
    action?: string;
  } | null;

  if (
    !body?.orderCode ||
    !OWNER_ACTIONS.includes(body.action as OwnerAction)
  ) {
    return fail("Data tidak valid.");
  }

  const result = await ownerUpdateOrder(
    body.orderCode,
    body.action as OwnerAction,
  );
  if (!result.ok) return fail(result.error ?? "Gagal.", result.code ?? 400);

  return Response.json({ status: result.status });
}
