"use client";

import { useEffect, useState } from "react";

type CartItem = {
  id: string;
  name: string;
  price: string;
  quantity: number;
};

const CART_KEY = "siren-official-cart";
const WHATSAPP_NUMBER = "6285176710079";

export default function KeranjangPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(CART_KEY);

      if (savedCart) {
        setCart(JSON.parse(savedCart) as CartItem[]);
      }
    } catch {
      localStorage.removeItem(CART_KEY);
    }

    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    }
  }, [cart, ready]);

  function updateQuantity(productId: string, change: number) {
    setCart((current) =>
      current
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: item.quantity + change }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeItem(productId: string) {
    setCart((current) => current.filter((item) => item.id !== productId));
  }

  const itemCount = cart.reduce((total, item) => total + item.quantity, 0);

  const orderMessage = encodeURIComponent(
    `Halo SIREN OFFICIAL, saya ingin memesan:\n${cart
      .map((item) => `- ${item.name} x${item.quantity} (${item.price})`)
      .join("\n")}\nMohon konfirmasi harga dan stok.`
  );

  const buttonStyle = {
    border: 0,
    borderRadius: 9,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  } as const;

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
      <section
        style={{
          maxWidth: 800,
          margin: "0 auto",
          padding: 28,
          background: "#13151e",
          border: "1px solid #252835",
          borderRadius: 16,
        }}
      >
        <p style={{ color: "#b9a6ff", letterSpacing: 2 }}>SIREN OFFICIAL</p>
        <h1>Keranjang ({ready ? itemCount : 0})</h1>

        {!ready ? (
          <p style={{ color: "#a7a9b5" }}>Memuat keranjang...</p>
        ) : cart.length === 0 ? (
          <>
            <p style={{ color: "#a7a9b5", lineHeight: 1.7 }}>
              Keranjangmu masih kosong. Pilih produk yang ingin kamu pesan
              terlebih dahulu.
            </p>
            <a href="/products" style={{ color: "#c4b5fd" }}>
              Jelajahi semua produk →
            </a>
          </>
        ) : (
          <>
            {cart.map((item) => (
              <article
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  flexWrap: "wrap",
                  padding: "18px 0",
                  borderBottom: "1px solid #343746",
                }}
              >
                <div>
                  <h2 style={{ fontSize: 19, margin: "0 0 8px" }}>
                    {item.name}
                  </h2>
                  <p style={{ color: "#a7a9b5", margin: 0 }}>
                    Harga: {item.price}
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, -1)}
                    aria-label={`Kurangi jumlah ${item.name}`}
                    style={{
                      ...buttonStyle,
                      background: "#252835",
                      color: "#f5f7fb",
                    }}
                  >
                    −
                  </button>

                  <strong>{item.quantity}</strong>

                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, 1)}
                    aria-label={`Tambah jumlah ${item.name}`}
                    style={{
                      ...buttonStyle,
                      background: "#252835",
                      color: "#f5f7fb",
                    }}
                  >
                    +
                  </button>

                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    style={{
                      ...buttonStyle,
                      background: "#252835",
                      color: "#c4b5fd",
                    }}
                  >
                    Hapus
                  </button>
                </div>
              </article>
            ))}

            <p style={{ color: "#a7a9b5", lineHeight: 1.7, marginTop: 20 }}>
              Harga dan stok akan dikonfirmasi oleh owner sebelum pembayaran.
            </p>

            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${orderMessage}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-block",
                marginTop: 8,
                background: "#a78bfa",
                color: "#090b10",
                borderRadius: 9,
                padding: "12px 18px",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Pesan isi keranjang via WhatsApp
            </a>
          </>
        )}
      </section>
    </main>
  );
}