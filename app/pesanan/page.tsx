"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import {
  loadSnap,
  postPayment,
  snapConfigured,
} from "../../lib/snap-client";

type OrderItem = {
  slug?: string;
  gameId?: string;
  name: string;
  image?: string;
  price: number;
  quantity: number;
};

type Order = {
  id: string;
  created: string;
  updated?: string;
  orderCode: string;
  items: OrderItem[];
  amount: number;
  status: string;
  paidAt?: string;
  processedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelRequested?: boolean;
  paymentType?: string;
  paymentBank?: string;
  snapToken?: string;
};

const WHATSAPP_NUMBER = "6285176710079";

const TABS: { id: string; label: string; match: (order: Order) => boolean }[] = [
  { id: "all", label: "Semua", match: () => true },
  { id: "unpaid", label: "Belum Bayar", match: (o) => o.status === "pending" },
  {
    id: "active",
    label: "Diproses",
    match: (o) => o.status === "paid" || o.status === "processing",
  },
  { id: "done", label: "Selesai", match: (o) => o.status === "completed" },
  {
    id: "cancelled",
    label: "Dibatalkan",
    match: (o) => ["cancelled", "expired", "failed"].includes(o.status),
  },
];

const PAYMENT_LABEL: Record<string, string> = {
  bank_transfer: "Transfer Bank",
  echannel: "Mandiri Bill Payment",
  qris: "QRIS",
  gopay: "GoPay",
  shopeepay: "ShopeePay",
};

function rupiah(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function dateTime(value?: string) {
  return value ? new Date(value).toLocaleString("id-ID") : "";
}

function statusInfo(order: Order) {
  if (order.cancelRequested && order.status === "paid") {
    return { text: "MENUNGGU PERSETUJUAN PEMBATALAN", color: "#fb923c" };
  }

  switch (order.status) {
    case "pending":
      return { text: "BELUM BAYAR", color: "#facc15" };
    case "paid":
      return { text: "DIBAYAR, MENUNGGU DIPROSES", color: "#38bdf8" };
    case "processing":
      return { text: "SEDANG DIPROSES", color: "#a78bfa" };
    case "completed":
      return { text: "SELESAI", color: "#4ade80" };
    case "cancelled":
      return { text: "DIBATALKAN", color: "#f87171" };
    case "expired":
      return { text: "KEDALUWARSA", color: "#a7a9b5" };
    default:
      return { text: "GAGAL", color: "#f87171" };
  }
}

function timeline(order: Order) {
  const steps: { label: string; at?: string; note?: string }[] = [
    { label: "Pesanan Dibuat", at: order.created },
  ];

  if (order.status === "expired" || order.status === "failed") {
    steps.push({
      label: order.status === "expired" ? "Kedaluwarsa" : "Pembayaran Gagal",
      at: order.updated,
    });
    return steps;
  }

  steps.push({
    label: "Pesanan Dibayar",
    at: order.paidAt,
    note: order.paidAt ? rupiah(order.amount) : undefined,
  });
  steps.push({ label: "Pesanan Diproses", at: order.processedAt });

  if (order.status === "cancelled") {
    steps.push({ label: "Pesanan Dibatalkan", at: order.cancelledAt });
  } else {
    steps.push({ label: "Pesanan Selesai", at: order.completedAt });
  }

  return steps;
}

export default function PesananPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [state, setState] = useState<"loading" | "login" | "ready" | "error">(
    "loading",
  );
  const [tab, setTab] = useState("all");
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  // Riwayat ikut berubah otomatis saat Midtrans / owner mengubah status order.
  useEffect(() => {
    let stopOrders: (() => void) | undefined;

    const stopAuth = onAuthStateChanged(auth, (user) => {
      stopOrders?.();
      stopOrders = undefined;

      if (!user) {
        setOrders([]);
        setState("login");
        return;
      }

      stopOrders = onSnapshot(
        query(collection(db, "orders"), where("user", "==", user.uid)),
        (snap) => {
          const list = snap.docs
            .map((doc) => ({ ...doc.data(), id: doc.id }) as Order)
            .sort((a, b) => String(b.created).localeCompare(String(a.created)));
          setOrders(list);
          setState("ready");
        },
        () => setState("error"),
      );
    });

    return () => {
      stopOrders?.();
      stopAuth();
    };
  }, []);

  async function checkStatus(orderCode: string) {
    setBusy(orderCode);
    setMessage("");
    await postPayment("verify", { orderCode }).catch(() => null);
    setBusy("");
  }

  async function payAgain(order: Order) {
    if (!order.snapToken || !snapConfigured) {
      setMessage("Pembayaran tidak bisa dilanjutkan. Silakan beli lagi.");
      return;
    }

    try {
      await loadSnap();
      window.snap?.pay(order.snapToken, {
        onSuccess: () => void checkStatus(order.orderCode),
        onPending: () => void checkStatus(order.orderCode),
        onError: () => setMessage("Pembayaran gagal. Silakan coba lagi."),
        onClose: () => void checkStatus(order.orderCode),
      });
    } catch {
      setMessage("Jendela pembayaran gagal dibuka.");
    }
  }

  async function requestCancel(orderCode: string) {
    const sure = window.confirm(
      "Ajukan pembatalan pesanan ini? Pesanan baru dibatalkan setelah disetujui owner.",
    );
    if (!sure) return;

    setBusy(orderCode);
    setMessage("");
    const { ok, data } = await postPayment("cancel-request", { orderCode });
    setMessage(
      ok
        ? "Permintaan pembatalan terkirim. Menunggu persetujuan owner."
        : (data.error ?? "Gagal mengajukan pembatalan."),
    );
    setBusy("");
  }

  const cardStyle = {
    background: "#13151e",
    border: "1px solid #252835",
    borderRadius: 16,
  } as const;

  const smallButton = {
    padding: "10px 16px",
    border: 0,
    borderRadius: 9,
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-block",
  } as const;

  const current = orders.find((order) => order.orderCode === selected);

  function buyAgainHref(order: Order) {
    const item = order.items[0];
    return item?.gameId && item?.slug
      ? `/products/${item.gameId}/${item.slug}`
      : "/products";
  }

  function contactHref(order: Order) {
    const text = encodeURIComponent(
      `Halo SIREN OFFICIAL, saya ingin bertanya tentang pesanan ${order.orderCode}.`,
    );
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#090b10",
        color: "#f5f7fb",
        fontFamily: "Arial, sans-serif",
        padding: "48px 7%",
      }}
    >
      <section style={{ maxWidth: 860, margin: "0 auto" }}>
        <p style={{ color: "#b9a6ff", letterSpacing: 2, margin: 0 }}>
          AKUN SIREN OFFICIAL
        </p>
        <h1 style={{ margin: "8px 0 20px" }}>History Pesanan</h1>

        {state === "loading" && (
          <p style={{ color: "#a7a9b5" }}>Memuat pesanan...</p>
        )}

        {state === "login" && (
          <div style={{ ...cardStyle, padding: 28 }}>
            <p style={{ color: "#a7a9b5", lineHeight: 1.7, margin: 0 }}>
              Masuk dulu untuk melihat riwayat pesanan.{" "}
              <a href="/masuk" style={{ color: "#c4b5fd" }}>
                Masuk →
              </a>
            </p>
          </div>
        )}

        {state === "error" && (
          <p style={{ color: "#f87171" }}>
            Pesanan gagal dimuat. Coba refresh halaman.
          </p>
        )}

        {message && (
          <p role="status" style={{ color: "#86efac", fontWeight: 600 }}>
            {message}
          </p>
        )}

        {state === "ready" && !current && (
          <>
            <div
              style={{
                ...cardStyle,
                display: "flex",
                flexWrap: "wrap",
                overflow: "hidden",
                marginBottom: 16,
              }}
            >
              {TABS.map((item) => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    style={{
                      flex: "1 1 110px",
                      padding: "14px 10px",
                      border: 0,
                      borderBottom: active
                        ? "3px solid #a78bfa"
                        : "3px solid transparent",
                      background: "transparent",
                      color: active ? "#c4b5fd" : "#a7a9b5",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            {(() => {
              const rule = TABS.find((item) => item.id === tab) ?? TABS[0];
              const visible = orders.filter(rule.match);

              if (visible.length === 0) {
                return (
                  <div style={{ ...cardStyle, padding: 28 }}>
                    <p style={{ color: "#a7a9b5", lineHeight: 1.7, margin: 0 }}>
                      {orders.length === 0
                        ? "Belum ada pesanan. Riwayat transaksi akan muncul di sini setelah kamu melakukan pemesanan."
                        : "Tidak ada pesanan di kategori ini."}
                    </p>
                    <p style={{ marginBottom: 0 }}>
                      <a href="/products" style={{ color: "#c4b5fd" }}>
                        Lihat produk →
                      </a>
                    </p>
                  </div>
                );
              }

              return visible.map((order) => {
                const info = statusInfo(order);

                return (
                  <article
                    key={order.id}
                    style={{ ...cardStyle, padding: 20, marginBottom: 14 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                        paddingBottom: 12,
                        borderBottom: "1px solid #252835",
                      }}
                    >
                      <span style={{ color: "#a7a9b5", fontSize: 13 }}>
                        {order.orderCode} · {dateTime(order.created)}
                      </span>
                      <span style={{ color: info.color, fontWeight: 700, fontSize: 13 }}>
                        {info.text}
                      </span>
                    </div>

                    {order.items.map((item, index) => (
                      <div
                        key={index}
                        style={{
                          display: "flex",
                          gap: 14,
                          padding: "14px 0",
                          borderBottom: "1px solid #252835",
                        }}
                      >
                        <div
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 8,
                            overflow: "hidden",
                            background: "#1b1b2a",
                            flexShrink: 0,
                          }}
                        >
                          {item.image && (
                            <img
                              src={item.image}
                              alt={item.name}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                display: "block",
                              }}
                            />
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>{item.name}</div>
                          <div style={{ color: "#a7a9b5", fontSize: 13 }}>
                            x{item.quantity}
                          </div>
                        </div>
                        <div style={{ fontWeight: 600 }}>
                          {rupiah(item.price * item.quantity)}
                        </div>
                      </div>
                    ))}

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        alignItems: "baseline",
                        gap: 12,
                        marginTop: 14,
                      }}
                    >
                      <span style={{ color: "#a7a9b5", fontSize: 13 }}>
                        Total Pesanan:
                      </span>
                      <strong style={{ fontSize: 22, color: "#4ade80" }}>
                        {rupiah(order.amount)}
                      </strong>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        flexWrap: "wrap",
                        gap: 10,
                        marginTop: 14,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setMessage("");
                          setSelected(order.orderCode);
                        }}
                        style={{ ...smallButton, background: "#a78bfa", color: "#090b10" }}
                      >
                        Lihat Detail
                      </button>
                      <a
                        href={buyAgainHref(order)}
                        style={{ ...smallButton, background: "#252835", color: "#f5f7fb" }}
                      >
                        Beli Lagi
                      </a>
                    </div>
                  </article>
                );
              });
            })()}
          </>
        )}

        {state === "ready" && current && (
          <div style={{ ...cardStyle, overflow: "hidden" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
                padding: "16px 22px",
                borderBottom: "1px solid #252835",
              }}
            >
              <button
                type="button"
                onClick={() => setSelected("")}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "#c4b5fd",
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                ← KEMBALI
              </button>
              <span style={{ fontSize: 13, color: "#a7a9b5" }}>
                NO. PESANAN. {current.orderCode}{" "}
                <span style={{ color: statusInfo(current).color, fontWeight: 700 }}>
                  | {statusInfo(current).text}
                </span>
              </span>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                padding: "26px 22px",
                borderBottom: "1px solid #252835",
              }}
            >
              {timeline(current).map((step, index, all) => {
                const done = Boolean(step.at);
                const color =
                  current.status === "cancelled" && index === all.length - 1
                    ? "#f87171"
                    : done
                      ? "#22c55e"
                      : "#343746";

                return (
                  <div
                    key={step.label}
                    style={{ flex: "1 1 120px", textAlign: "center" }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        border: `3px solid ${color}`,
                        color,
                        display: "grid",
                        placeItems: "center",
                        margin: "0 auto 8px",
                        fontWeight: 800,
                      }}
                    >
                      {done ? "✓" : index + 1}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                      {step.label}
                    </div>
                    {step.note && (
                      <div style={{ color: "#4ade80", fontSize: 12 }}>
                        ({step.note})
                      </div>
                    )}
                    <div style={{ color: "#a7a9b5", fontSize: 12 }}>
                      {dateTime(step.at)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 10,
                padding: "18px 22px",
                borderBottom: "1px solid #252835",
              }}
            >
              <a
                href={buyAgainHref(current)}
                style={{ ...smallButton, background: "#a78bfa", color: "#090b10" }}
              >
                Beli Lagi
              </a>
              <a
                href={contactHref(current)}
                target="_blank"
                rel="noreferrer"
                style={{ ...smallButton, background: "#252835", color: "#f5f7fb" }}
              >
                Hubungi Penjual
              </a>

              {current.status === "pending" && (
                <>
                  <button
                    type="button"
                    disabled={busy === current.orderCode}
                    onClick={() => payAgain(current)}
                    style={{ ...smallButton, background: "#22c55e", color: "#052e16" }}
                  >
                    Bayar Sekarang
                  </button>
                  <button
                    type="button"
                    disabled={busy === current.orderCode}
                    onClick={() => checkStatus(current.orderCode)}
                    style={{ ...smallButton, background: "#252835", color: "#f5f7fb" }}
                  >
                    {busy === current.orderCode
                      ? "Memeriksa..."
                      : "Cek Status Pembayaran"}
                  </button>
                </>
              )}

              {current.status === "paid" && !current.cancelRequested && (
                <button
                  type="button"
                  disabled={busy === current.orderCode}
                  onClick={() => requestCancel(current.orderCode)}
                  style={{
                    ...smallButton,
                    background: "transparent",
                    color: "#f87171",
                    border: "1px solid #f87171",
                  }}
                >
                  Ajukan Pembatalan
                </button>
              )}
            </div>

            {current.cancelRequested && current.status === "paid" && (
              <p style={{ margin: 0, padding: "14px 22px", color: "#fb923c" }}>
                Permintaan pembatalan sudah dikirim dan menunggu persetujuan
                owner.
              </p>
            )}
            {current.status === "processing" && (
              <p style={{ margin: 0, padding: "14px 22px", color: "#a7a9b5" }}>
                Pesanan sedang diproses, sehingga tidak dapat dibatalkan.
              </p>
            )}

            <div style={{ padding: "8px 22px 22px" }}>
              {current.items.map((item, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    gap: 14,
                    padding: "14px 0",
                    borderBottom: "1px solid #252835",
                  }}
                >
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "#1b1b2a",
                      flexShrink: 0,
                    }}
                  >
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    <div style={{ color: "#a7a9b5", fontSize: 13 }}>
                      x{item.quantity}
                    </div>
                  </div>
                  <div style={{ fontWeight: 600 }}>{rupiah(item.price)}</div>
                </div>
              ))}

              <div style={{ marginTop: 16 }}>
                {[
                  {
                    label: "Subtotal Produk",
                    value: rupiah(
                      current.items.reduce(
                        (sum, item) => sum + item.price * item.quantity,
                        0,
                      ),
                    ),
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "10px 0",
                      color: "#a7a9b5",
                    }}
                  >
                    <span>{row.label}</span>
                    <span style={{ color: "#f5f7fb" }}>{row.value}</span>
                  </div>
                ))}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    padding: "14px 0",
                    borderTop: "1px solid #252835",
                    borderBottom: "1px solid #252835",
                  }}
                >
                  <span style={{ color: "#a7a9b5" }}>Total Pesanan</span>
                  <strong style={{ fontSize: 26, color: "#4ade80" }}>
                    {rupiah(current.amount)}
                  </strong>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "12px 0",
                    color: "#a7a9b5",
                  }}
                >
                  <span>Metode Pembayaran</span>
                  <span style={{ color: "#f5f7fb" }}>
                    {current.paymentType
                      ? `${current.paymentBank
                          ? `${current.paymentBank.toUpperCase()} Virtual Account`
                          : PAYMENT_LABEL[current.paymentType] ?? current.paymentType} (Diverifikasi Midtrans)`
                      : "Belum dibayar"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
