"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutBuyer, subscribeBuyer, type Buyer } from "../../lib/buyer";

export default function SiteHeader() {
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [hiddenForAdminHost, setHiddenForAdminHost] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const hostname = window.location.hostname.toLowerCase();
    setHiddenForAdminHost(
      hostname === "admin.localhost" ||
        hostname === "auyaxyz.sirenofficial.my.id",
    );

    return subscribeBuyer(setBuyer);
  }, []);

  async function handleLogout() {
    await logoutBuyer().catch(() => undefined);
    window.location.assign("/");
  }

  const avatarUrl = buyer?.avatar ?? "";

  if (hiddenForAdminHost || pathname.startsWith("/admin")) return null;

  const navLinkStyle = {
    color: "#b7bac7",
    textDecoration: "none",
  };

  const menuLinkStyle = {
    display: "block",
    padding: "11px 14px",
    color: "#e5e7eb",
    textDecoration: "none",
    whiteSpace: "nowrap" as const,
  };

  return (
    <header
      className="site-header"
      style={{
        borderBottom: "1px solid #20232d",
        padding: "16px 7%",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 18,
        flexWrap: "wrap",
        background: "#090b10",
        color: "#f5f7fb",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <a className="site-brand" href="/" style={{ color: "#f5f7fb", textDecoration: "none" }}>
        <img src="/brand/logothumbnail.webp" alt="Logo Joki Roblox" width={44} height={44} />
        <span>
        <strong style={{ fontSize: 22, letterSpacing: 1 }}>
          JOKI <span style={{ color: "#a78bfa" }}>ROBLOX</span>
        </strong>
        <small
          style={{
            display: "block",
            color: "#a7a9b5",
            fontSize: 9,
            marginTop: 4,
            letterSpacing: 1,
          }}
        >
          JOKI TERPERCAYA, CEPAT, DAN AMAN 100%
        </small>
        </span>
      </a>

      <nav className="site-nav" style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <a href="/" style={navLinkStyle}>Beranda</a>
        <a href="/products" style={navLinkStyle}>Semua Produk</a>
        <a href="/contact" style={navLinkStyle}>Hubungi Kami</a>
      </nav>

      <form
        className="site-search"
        action="/products"
        method="get"
        role="search"
        style={{ display: "flex", gap: 8 }}
      >
        <input
          type="search"
          name="q"
          placeholder="Cari semua produk..."
          aria-label="Cari semua produk"
          style={{
            width: "min(190px, 55vw)",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #343746",
            background: "#13151e",
            color: "#f5f7fb",
          }}
        />
        <button
          type="submit"
          style={{
            border: 0,
            borderRadius: 8,
            padding: "0 14px",
            background: "#a78bfa",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Cari
        </button>
      </form>

      {buyer ? (
        <details className="site-account" style={{ position: "relative" }}>
          <summary
            aria-label="Menu akun"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              cursor: "pointer",
              listStyle: "none",
              color: "#f5f7fb",
              fontWeight: 700,
            }}
          >
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
                backgroundColor: "#252239",
                backgroundImage: avatarUrl ? `url("${avatarUrl}")` : "none",
                backgroundSize: "cover",
                backgroundPosition: "center",
                border: "1px solid #a78bfa",
                fontSize: 20,
              }}
            >
              {avatarUrl ? "" : "👤"}
            </span>
            <span>{buyer.username || buyer.name || "Akun"}</span>
            <span aria-hidden="true" style={{ color: "#a78bfa" }}>▾</span>
          </summary>

          <div
            style={{
              position: "absolute",
              zIndex: 20,
              right: 0,
              top: 46,
              minWidth: 190,
              padding: 6,
              background: "#13151e",
              border: "1px solid #343746",
              borderRadius: 10,
              boxShadow: "0 12px 30px #0008",
            }}
          >
            <a href="/pengaturan" style={menuLinkStyle}>Pengaturan</a>
            <a href="/pesanan" style={menuLinkStyle}>History Pesanan</a>
            <a href="/keranjang" style={menuLinkStyle}>Keranjang</a>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                ...menuLinkStyle,
                width: "100%",
                border: 0,
                borderTop: "1px solid #343746",
                marginTop: 4,
                background: "transparent",
                textAlign: "left",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Keluar
            </button>
          </div>
        </details>
      ) : (
        <a
          className="site-account"
          href="/masuk"
          style={{
            display: "inline-block",
            background: "#a78bfa",
            borderRadius: 9,
            padding: "11px 18px",
            color: "#090b10",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Masuk
        </a>
      )}
    </header>
  );
}
