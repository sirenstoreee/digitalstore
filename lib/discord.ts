import type { DocumentReference } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";

type DiscordPayload = {
  content?: string;
  allowed_mentions?: { parse?: string[]; users: string[] };
  embeds: {
    title: string;
    description?: string;
    color: number;
    timestamp: string;
    fields: { name: string; value: string; inline?: boolean }[];
    footer: { text: string };
  }[];
};

type OrderNotice = {
  orderCode: string;
  buyerName?: string;
  amount: number;
  items: { name: string; quantity: number; price: number; variantName?: string }[];
  method?: string;
  bank?: string;
};

function rupiah(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

export function isValidDiscordWebhookUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "discord.com" || url.hostname === "discordapp.com") &&
      url.pathname.startsWith("/api/webhooks/") &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function environmentWebhookUrl() {
  const value = process.env.DISCORD_WEBHOOK_URL?.trim() ?? "";
  return isValidDiscordWebhookUrl(value) ? value : "";
}

// URL override disimpan di koleksi privat; jangan masukkan ke store_settings
// karena store_settings dapat dibaca langsung oleh pengunjung toko.
export async function getDiscordWebhookUrl() {
  try {
    const snapshot = await adminDb().collection("private_settings").doc("discord").get();
    const data = snapshot.data();
    if (typeof data?.webhookUrl === "string") {
      const value = data.webhookUrl.trim();
      return isValidDiscordWebhookUrl(value) ? value : "";
    }
  } catch (error) {
    console.error("Discord webhook setting could not be read.", error);
  }
  return environmentWebhookUrl();
}

export async function saveDiscordWebhookUrl(value: string) {
  const url = value.trim();
  if (!isValidDiscordWebhookUrl(url)) {
    throw new Error("Masukkan URL webhook Discord yang valid dari discord.com atau discordapp.com.");
  }
  await adminDb().collection("private_settings").doc("discord").set({
    webhookUrl: url,
    updatedAt: new Date().toISOString(),
  });
}

export async function isDiscordWebhookConfigured() {
  return Boolean(await getDiscordWebhookUrl());
}

function buildPayload(kind: "created" | "paid", order: OrderNotice): DiscordPayload {
  const items = order.items
    .map((item) => `• ${item.name}${item.variantName ? ` — ${item.variantName}` : ""} ×${item.quantity} — ${rupiah(item.price * item.quantity)}`)
    .join("\n");
  const paid = kind === "paid";

  return {
    ...(paid
      ? {
          content: "@everyone <@354657097524445184> 👑",
          // parse: ["everyone"] mengizinkan @everyone; users mengizinkan tag ke akun owner.
          allowed_mentions: { parse: ["everyone"], users: ["354657097524445184"] },
        }
      : {}),
    embeds: [
      {
        title: paid ? "Pembayaran berhasil" : "Pesanan baru masuk",
        description: paid
          ? `Halo Siren Official, terdapat orderan masuk.\n\n${items.slice(0, 3000)}\n\nSilahkan segera proses pesanan tersebut, terima kasih.`
          : items.slice(0, 3500) || "Tidak ada rincian produk.",
        color: paid ? 0x22c55e : 0x3b82f6,
        timestamp: new Date().toISOString(),
        fields: [
          ...(paid ? [{ name: "Pembeli", value: order.buyerName || "Pembeli", inline: true }] : []),
          { name: "Nomor pesanan", value: order.orderCode, inline: true },
          { name: "Total", value: rupiah(order.amount), inline: true },
          {
            name: "Status",
            value: paid ? "PAID — menunggu diproses" : "Menunggu pembayaran",
            inline: true,
          },
          {
            name: "Metode",
            value: [order.method, order.bank].filter(Boolean).join(" · ") || "Dipilih di Snap",
            inline: true,
          },
        ],
        footer: { text: "SIREN OFFICIAL · Payment notification" },
      },
    ],
  };
}

function eventsCollection() {
  return adminDb().collection("discord_events");
}

function alreadyExists(error: unknown) {
  return (error as { code?: number })?.code === 6; // ALREADY_EXISTS
}

export async function queueDiscordOrderNotice(
  kind: "created" | "paid",
  order: OrderNotice,
) {
  const url = await getDiscordWebhookUrl();
  const payload = buildPayload(kind, order);
  const eventKey = `${order.orderCode}:${kind}`;
  const ref = eventsCollection().doc(`${order.orderCode}_${kind}`);

  try {
    // create() gagal bila dokumen sudah ada -> notifikasi yang sama tidak terkirim dua kali.
    await ref.create({
      eventKey,
      payload,
      state: url ? "sending" : "pending",
      attempts: 1,
      lastError: "",
      created: new Date().toISOString(),
    });
  } catch (error) {
    if (alreadyExists(error)) return;
    console.error("Discord order notification could not be queued.", error);
    // Pengiriman ke Discord tidak boleh bergantung pada pencatatan event.
    if (url) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000),
          cache: "no-store",
          redirect: "error",
        });
        if (!response.ok) throw new Error(`Discord returned HTTP ${response.status}.`);
      } catch (deliveryError) {
        console.error("Discord fallback delivery failed.", deliveryError);
      }
    }
    return;
  }

  if (!url) return;
  await deliverDiscordEvent(ref, payload, url);
}

async function deliverDiscordEvent(
  ref: DocumentReference,
  payload: DiscordPayload,
  url: string,
) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) throw new Error(`Discord returned HTTP ${response.status}.`);
    await ref.update({
      state: "sent",
      attempts: 1,
      sentAt: new Date().toISOString(),
      lastError: "",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown webhook error.";
    await ref
      .update({ state: "failed", attempts: 1, lastError: reason })
      .catch(() => undefined);
    console.error("Discord order notification delivery failed.", reason);
  }
}

export async function retryDiscordEvents() {
  const url = await getDiscordWebhookUrl();
  if (!url) throw new Error("DISCORD_WEBHOOK_URL is not configured.");
  const snap = await eventsCollection()
    .where("state", "in", ["pending", "failed"])
    .get();
  for (const doc of snap.docs) {
    await doc.ref.update({ state: "sending" });
    await deliverDiscordEvent(doc.ref, doc.data().payload as DiscordPayload, url);
  }
  return snap.size;
}

export async function discordCounts() {
  const snap = await eventsCollection().select("state").get();
  const states = snap.docs.map((doc) => doc.data().state as string);
  return {
    pending: states.filter((state) => state === "pending").length,
    failed: states.filter((state) => state === "failed").length,
  };
}

export async function testDiscordWebhook() {
  const url = await getDiscordWebhookUrl();
  if (!url) throw new Error("DISCORD_WEBHOOK_URL is not configured.");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: "✅ Webhook SIREN OFFICIAL berhasil terhubung." }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok) throw new Error(`Discord returned HTTP ${response.status}.`);
}
