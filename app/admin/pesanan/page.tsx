"use client";

import { useCallback, useEffect, useState } from "react";
import { postPayment } from "../../../lib/snap-client";

type OrderItem = { name: string; price: number; quantity: number };

type OrderUser = {
  username?: string;
  name?: string;
  phone?: string;
  email?: string;
};

type Order = {
  id: string;
  created: string;
  orderCode: string;
  items: OrderItem[];
  amount: number;
  status: string;
  paidAt?: string;
  paymentType?: string;
  paymentBank?: string;
  cancelRequested?: boolean;
  expand?: { user?: OrderUser };
};

const STATUS_TEXT: Record<string, string> = {
  pending: "Belum bayar",
  paid: "Dibayar, menunggu diproses",
  processing: "Sedang diproses",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  expired: "Kedaluwarsa",
  failed: "Gagal",
};

function rupiah(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

export default function OwnerOrdersPage() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [onlyActive, setOnlyActive] = useState(true);
  const [busy, setBusy] = useState("");

  const loadOrders = useCallback(async (quiet = false) => {
    try {
      const { ok, data } = await postPayment<{ orders?: Order[] }>(
        "owner-orders",
        {},
        "",
      );
      if (!ok) {
        setLoggedIn(false);
        setOrders([]);
        if (!quiet) setError(data.error ?? "Sesi berakhir. Silakan masuk kembali.");
        return;
      }
      setLoggedIn(true);
      setOrders(data.orders ?? []);
    } catch {
      setError("Pesanan gagal dimuat. Coba login ulang.");
    }
  }, []);

  useEffect(() => {
    void loadOrders(true);
  }, [loadOrders]);

  useEffect(() => {
    if (loggedIn !== true) return;
    const timer = setInterval(() => void loadOrders(), 5000);
    return () => clearInterval(timer);
  }, [loggedIn, loadOrders]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    try {
      const { ok, data } = await postPayment<{ error?: string }>(
        "owner-login",
        { email, password },
        "",
      );
      if (!ok) {
        setError(data.error ?? "Email atau password owner salah.");
        return;
      }
      setPassword("");
      setLoggedIn(true);
      await loadOrders();
    } catch {
      setError("Email atau password owner salah.");
    }
  }

  async function logout() {
    await postPayment("owner-logout", {}, "").catch(() => null);
    setOrders([]);
    setLoggedIn(false);
  }

  async function act(orderCode: string, action: string) {
    setBusy(orderCode);
    setError("");

    const { ok, data } = await postPayment(
      "owner",
      { orderCode, action },
      "",
    );
    if (!ok) setError(data.error ?? "Aksi gagal.");

    await loadOrders();
    setBusy("");
  }

  const card = {
    background: "#13151e",
    border: "1px solid #252835",
    borderRadius: 16,
  } as const;

  const button = {
    padding: "9px 14px",
    border: 0,
    borderRadius: 9,
    fontWeight: 700,
    cursor: "pointer",
  } as const;

  const visible = orders.filter((order) =>
    onlyActive
      ? order.cancelRequested ||
        order.status === "paid" ||
        order.status === "processing"
      : true,
  );

  return (
    <main
      className="owner-orders-main"
      style={{
        minHeight: "100vh",
        background: "#090b10",
        color: "#f5f7fb",
        fontFamily: "Arial, sans-serif",
        padding: "48px 7%",
      }}
    >
      <section style={{ maxWidth: 900, margin: "0 auto" }}>
        <p style={{ display: "flex", alignItems: "center", gap: 10, color: "#b9a6ff", letterSpacing: 2, margin: 0 }}>
          <img src="/brand/SU.webp" alt="" width={36} height={36} style={{ objectFit: "contain" }} />
          ADMIN | SIREN OFFICIAL
        </p>
        <h1 style={{ margin: "8px 0 20px" }}>Kelola Pesanan</h1>
        <a
          href="/"
          style={{
            display: "inline-block",
            padding: "9px 14px",
            marginBottom: 16,
            border: "1px solid #343746",
            borderRadius: 9,
            color: "#f5f7fb",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          ← Kembali ke panel owner
        </a>

        {loggedIn === null && <p style={{ color: "#a7a9b5" }}>Memuat...</p>}

        {loggedIn === false && (
          <form
            onSubmit={login}
            style={{ ...card, padding: 24, maxWidth: 420, display: "grid", gap: 12 }}
          >
            <p style={{ margin: 0, color: "#a7a9b5" }}>
              Masuk dengan akun owner.
            </p>
            <input
              type="email"
              required
              placeholder="Email admin"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ padding: 12, borderRadius: 9, border: "1px solid #343746", background: "#090b10", color: "#f5f7fb" }}
            />
            <input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ padding: 12, borderRadius: 9, border: "1px solid #343746", background: "#090b10", color: "#f5f7fb" }}
            />
            <button type="submit" style={{ ...button, background: "#a78bfa", color: "#090b10" }}>
              Masuk
            </button>
          </form>
        )}

        {error && (
          <p role="alert" style={{ color: "#f87171", fontWeight: 600 }}>
            {error}
          </p>
        )}

        {loggedIn && (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => setOnlyActive(true)}
                style={{ ...button, background: onlyActive ? "#a78bfa" : "#252835", color: onlyActive ? "#090b10" : "#f5f7fb" }}
              >
                Perlu tindakan
              </button>
              <button
                type="button"
                onClick={() => setOnlyActive(false)}
                style={{ ...button, background: !onlyActive ? "#a78bfa" : "#252835", color: !onlyActive ? "#090b10" : "#f5f7fb" }}
              >
                Semua pesanan
              </button>
              <button
                type="button"
                onClick={logout}
                style={{ ...button, background: "transparent", color: "#a7a9b5", border: "1px solid #343746", marginLeft: "auto" }}
              >
                Keluar
              </button>
            </div>

            <p style={{ color: "#a7a9b5", fontSize: 13 }}>
              Menyetujui pembatalan mengembalikan stok. Pengembalian dana ke
              pembeli dilakukan manual (lewat dashboard Midtrans atau langsung).
            </p>

            {visible.length === 0 && (
              <p style={{ color: "#a7a9b5" }}>Tidak ada pesanan.</p>
            )}

            {visible.map((order) => {
              const buyer = order.expand?.user;
              const working = busy === order.orderCode;

              return (
                <article key={order.id} style={{ ...card, padding: 20, marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                    <strong>{order.orderCode}</strong>
                    <span style={{ color: order.cancelRequested ? "#fb923c" : "#c4b5fd", fontWeight: 700 }}>
                      {order.cancelRequested
                        ? "MINTA PEMBATALAN"
                        : (STATUS_TEXT[order.status] ?? order.status)}
                    </span>
                  </div>

                  <p style={{ color: "#a7a9b5", fontSize: 13, margin: "6px 0" }}>
                    Pembeli: {String(buyer?.username ?? "-")} ·{" "}
                    {String(buyer?.phone ?? "-")} · {String(buyer?.email ?? "-")}
                    <br />
                    Dibuat {new Date(order.created).toLocaleString("id-ID")}
                    {order.paymentBank
                      ? ` · Bayar via ${order.paymentBank.toUpperCase()} VA`
                      : order.paymentType === "echannel"
                        ? " · Bayar via Mandiri Bill Payment"
                        : order.paymentType
                          ? ` · Bayar via ${order.paymentType}`
                          : ""}
                  </p>

                  {order.items.map((item, index) => (
                    <div key={index} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                      <span>
                        {item.name} × {item.quantity}
                      </span>
                      <span>{rupiah(item.price * item.quantity)}</span>
                    </div>
                  ))}

                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid #252835" }}>
                    <strong>Total</strong>
                    <strong style={{ color: "#4ade80" }}>{rupiah(order.amount)}</strong>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
                    {order.cancelRequested && (
                      <>
                        <button
                          type="button"
                          disabled={working}
                          onClick={() => act(order.orderCode, "approve-cancel")}
                          style={{ ...button, background: "#f87171", color: "#2a0a0a" }}
                        >
                          Setujui Pembatalan
                        </button>
                        <button
                          type="button"
                          disabled={working}
                          onClick={() => act(order.orderCode, "reject-cancel")}
                          style={{ ...button, background: "#252835", color: "#f5f7fb" }}
                        >
                          Tolak
                        </button>
                      </>
                    )}

                    {!order.cancelRequested && order.status === "paid" && (
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => act(order.orderCode, "process")}
                        style={{ ...button, background: "#38bdf8", color: "#04202e" }}
                      >
                        Mulai Proses
                      </button>
                    )}

                    {!order.cancelRequested &&
                      order.status === "processing" && (
                        <button
                          type="button"
                          disabled={working}
                          onClick={() => act(order.orderCode, "complete")}
                          style={{ ...button, background: "#22c55e", color: "#052e16" }}
                        >
                          Tandai Selesai
                        </button>
                      )}
                  </div>
                </article>
              );
            })}
          </>
        )}
      </section>
    </main>
  );
}
