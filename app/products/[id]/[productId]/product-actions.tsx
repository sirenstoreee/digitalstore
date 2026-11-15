"use client";

import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../../../lib/firebase";
import {
  loadSnap,
  postPayment,
  snapConfigured,
} from "../../../../lib/snap-client";

export type ProductInfo = {
  id: string; // slug
  recordId: string;
  name: string;
  price: string; // teks harga untuk ditampilkan
  priceValue: number; // angka rupiah, 0 = belum ditentukan
  stock: number;
  variants?: { id: string; name: string; price: number; stock: number; image?: string }[];
};

type CartItem = {
  id: string;
  name: string;
  price: string;
  quantity: number;
};

type MethodId = "qris" | "bca" | "bni" | "bri" | "mandiri";

const CART_KEY = "siren-official-cart";

const METHODS: {
  id: MethodId;
  number: number;
  title: string;
  subtitle: string;
}[] = [
  {
    id: "qris",
    number: 1,
    title: "QRIS",
    subtitle:
      "Scan dengan DANA, OVO, GoPay, ShopeePay, atau m-banking apa pun",
  },
  {
    id: "bca",
    number: 2,
    title: "BCA Virtual Account",
    subtitle: "Bayar melalui ATM, myBCA, atau KlikBCA",
  },
  {
    id: "bni",
    number: 3,
    title: "BNI Virtual Account",
    subtitle: "Bayar melalui ATM, wondr by BNI, atau BNI Mobile",
  },
  {
    id: "bri",
    number: 4,
    title: "BRI Virtual Account",
    subtitle: "Bayar melalui ATM, BRImo, atau Internet Banking BRI",
  },
  {
    id: "mandiri",
    number: 5,
    title: "Mandiri Bill Payment",
    subtitle: "Bayar menggunakan kode biller dan bill key Mandiri",
  },
];

function rupiah(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

// Stok yang berubah otomatis (realtime) saat database berubah.
function useLiveStock(recordId: string, initial: number) {
  const [stock, setStock] = useState(initial);

  useEffect(() => {
    setStock(initial);
  }, [initial]);

  useEffect(() => {
    return onSnapshot(
      doc(db, "products", recordId),
      (snap) => {
        const data = snap.data() as { stock?: number } | undefined;
        if (data) setStock(data.stock ?? 0);
      },
      () => undefined,
    );
  }, [recordId]);

  return stock;
}

export function LiveStock({
  recordId,
  initial,
}: {
  recordId: string;
  initial: number;
}) {
  const stock = useLiveStock(recordId, initial);
  return <span>Stok tersedia: {stock}</span>;
}

export default function ProductActions({ product }: { product: ProductInfo }) {
  const stock = useLiveStock(product.recordId, product.stock);
  const [toast, setToast] = useState("");
  const [notice, setNotice] = useState("");
  const [paying, setPaying] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [method, setMethod] = useState<MethodId>("qris");
  const [quantity, setQuantity] = useState(1);
  const [variantId, setVariantId] = useState(product.variants?.[0]?.id ?? "");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedVariant = product.variants?.find((variant) => variant.id === variantId);
  const activeStock = selectedVariant?.stock ?? stock;
  const activePrice = selectedVariant?.price ?? product.priceValue;
  const activePriceText = `Rp ${activePrice.toLocaleString("id-ID")}`;
  const priceReady = activePrice > 0;
  const total = activePrice * quantity;

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3200);
  }

  function addToCart() {
    if (activeStock <= 0) {
      setNotice("Stok produk sudah habis.");
      return;
    }

    try {
      const raw = localStorage.getItem(CART_KEY);
      const cart: CartItem[] = raw ? (JSON.parse(raw) as CartItem[]) : [];
      const cartId = selectedVariant ? `${product.id}:${selectedVariant.id}` : product.id;
      const displayName = selectedVariant ? `${product.name} — ${selectedVariant.name}` : product.name;
      const existing = cart.find((item) => item.id === cartId);

      if (existing) {
        existing.quantity = Math.min(activeStock, existing.quantity + 1);
        existing.price = activePriceText;
      } else {
        cart.push({
          id: cartId,
          name: displayName,
          price: activePriceText,
          quantity: 1,
        });
      }

      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      showToast("produk berhasil di masukan keranjang");
    } catch {
      setNotice("Keranjang gagal disimpan.");
    }
  }

  function openPayment() {
    if (activeStock <= 0) {
      setNotice("Maaf, stok produk ini sedang habis.");
      return;
    }
    if (!priceReady) {
      setNotice("Harga produk ini belum ditentukan.");
      return;
    }

    setNotice("");
    setQuantity(1);
    setShowPay(true);
  }

  async function finishPayment(orderCode: string) {
    setNotice("Memeriksa pembayaran ke Midtrans...");
    await postPayment("verify", { orderCode }).catch(() => null);
    window.location.assign("/pesanan");
  }

  async function startPayment() {
    if (!auth.currentUser) {
      window.location.assign("/masuk");
      return;
    }
    if (!snapConfigured) {
      setNotice("Pembayaran belum dikonfigurasi (client key kosong).");
      return;
    }

    setPaying(true);
    setNotice("");

    try {
      const { ok, data } = await postPayment<{
        token?: string;
        orderCode?: string;
      }>("checkout", { items: [{ id: product.id, quantity, variantId: selectedVariant?.id }], method });

      if (!ok || !data.token || !data.orderCode) {
        setNotice(data.error ?? "Gagal membuat pesanan.");
        return;
      }

      const orderCode = data.orderCode;
      await loadSnap();
      setShowPay(false);

      window.snap?.pay(data.token, {
        onSuccess: () => void finishPayment(orderCode),
        onPending: () => void finishPayment(orderCode),
        onError: () =>
          setNotice("Pembayaran gagal. Silakan coba lagi dari History Pesanan."),
        onClose: () =>
          setNotice(
            "Pembayaran belum selesai. Pesananmu tersimpan di History Pesanan.",
          ),
      });
    } catch {
      setNotice("Terjadi kesalahan. Coba lagi sebentar.");
    } finally {
      setPaying(false);
    }
  }

  const buttonStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    border: 0,
    borderRadius: 9,
    padding: "12px 18px",
    fontWeight: 700,
    fontSize: 14,
    textDecoration: "none",
    cursor: "pointer",
    textAlign: "center",
    whiteSpace: "nowrap",
  } as const;

  const stepButton = {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "#252b3d",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  } as const;

  return (
    <div style={{ marginTop: 16 }}>
      {toast && (
        <div
          role="status"
          style={{
            position: "fixed",
            top: 28,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#161b26",
            color: "#fff",
            padding: "12px 24px",
            borderRadius: 12,
            border: "1px solid #22c55e",
            boxShadow: "0 12px 30px -5px rgba(0,0,0,0.7)",
            zIndex: 999999,
            fontSize: 14,
            fontWeight: 600,
            pointerEvents: "none",
          }}
        >
          ✓ {toast}
        </div>
      )}

      {showPay && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(5, 8, 17, 0.84)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 99998,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 460,
              background: "#131722",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 16,
              padding: 22,
              color: "#f5f7fb",
              boxShadow: "0 24px 50px rgba(0,0,0,0.65)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 18 }}>
                  Pilih Metode Pembayaran
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>
                  Diverifikasi otomatis oleh Midtrans
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPay(false)}
                aria-label="Tutup"
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.14)",
                  color: "#94a3b8",
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                background: "#1b2030",
                borderRadius: 12,
                padding: "12px 14px",
                marginBottom: 14,
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 14 }}>
                  {product.name}
                </span>
                <span style={{ fontWeight: 800, color: "#22c55e" }}>
                  {activePriceText} / item
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 13,
                  color: "#cbd5e1",
                }}
              >
                <span>Jumlah beli (Stok: {activeStock})</span>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    style={stepButton}
                  >
                    -
                  </button>
                  <span style={{ minWidth: 24, textAlign: "center", fontWeight: 700 }}>
                    {quantity}
                  </span>
                  <button
                    type="button"
                    disabled={quantity >= activeStock}
                    onClick={() => setQuantity((q) => Math.min(activeStock, q + 1))}
                    style={stepButton}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginBottom: 18,
              }}
            >
              {METHODS.map((item) => {
                const active = method === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMethod(item.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: active
                        ? "2px solid #22c55e"
                        : "1px solid rgba(255,255,255,0.12)",
                      background: active ? "rgba(34,197,94,0.12)" : "#191e2b",
                      color: "#f5f7fb",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 15,
                        color: active ? "#4ade80" : "#fff",
                      }}
                    >
                      {item.number}. {item.title}
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>
                      {item.subtitle}
                    </div>
                  </button>
                );
              })}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                paddingTop: 12,
                borderTop: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                  Total Pembayaran
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#22c55e" }}>
                  {rupiah(total)}
                </div>
              </div>

              <button
                type="button"
                onClick={startPayment}
                disabled={paying}
                style={{
                  ...buttonStyle,
                  background: "#22c55e",
                  color: "#052e16",
                  opacity: paying ? 0.6 : 1,
                }}
              >
                {paying ? "Memproses..." : "Lanjut Bayar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {product.variants && product.variants.length > 0 && (
        <section aria-label="Pilih jenis produk" style={{ display: "grid", gap: 8, margin: "18px 0" }}>
          <strong>Pilih jenis produk</strong>
          {product.variants.map((variant) => (
            <label key={variant.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, border: variantId === variant.id ? "1px solid #22c55e" : "1px solid #343746", borderRadius: 9, cursor: "pointer", opacity: variant.stock > 0 ? 1 : 0.55 }}>
              <input type="radio" name="product-variant" value={variant.id} checked={variantId === variant.id} onChange={() => { setVariantId(variant.id); setQuantity(1); }} />
              {variant.image && <img src={variant.image} alt="" style={{ width: 38, height: 38, objectFit: "cover", borderRadius: 5 }} />}
              <span style={{ flex: 1 }}>{variant.name}</span>
              <strong style={{ color: "#4ade80" }}>{rupiah(variant.price)}</strong>
              <small style={{ color: "#94a3b8" }}>Stok {variant.stock}</small>
            </label>
          ))}
        </section>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <button
          type="button"
          onClick={openPayment}
          disabled={paying || activeStock <= 0 || !priceReady}
          style={{
            ...buttonStyle,
            background: activeStock > 0 && priceReady ? "#22c55e" : "#475569",
            color: activeStock > 0 && priceReady ? "#052e16" : "#cbd5e1",
            opacity: paying ? 0.6 : 1,
          }}
        >
          {activeStock <= 0
            ? "Stok Habis"
            : !priceReady
              ? "Harga belum ditentukan"
              : "Bayar sekarang"}
        </button>

        <button
          type="button"
          onClick={addToCart}
          disabled={activeStock <= 0}
          style={{
            ...buttonStyle,
            background: "#252835",
            color: "#f5f7fb",
            opacity: activeStock <= 0 ? 0.5 : 1,
          }}
        >
          Tambah ke keranjang
        </button>
      </div>

      {notice && (
        <p
          role="status"
          style={{
            color: "#86efac",
            fontSize: 13,
            marginTop: 12,
            marginBottom: 0,
            fontWeight: 600,
          }}
        >
          {notice}
        </p>
      )}
    </div>
  );
}
