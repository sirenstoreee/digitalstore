"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../lib/firebase";
import {
  USERNAME_PATTERN,
  normalizeUsername,
  usernameToEmail,
} from "../../lib/username";

function authMessage(error: unknown) {
  const code = (error as { code?: string })?.code ?? "";
  if (
    code === "auth/invalid-credential" ||
    code === "auth/wrong-password" ||
    code === "auth/user-not-found" ||
    code === "auth/invalid-email"
  ) {
    return "Username atau kata sandi salah.";
  }
  if (code === "auth/too-many-requests") {
    return "Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.";
  }
  if (code === "auth/network-request-failed") {
    return "Koneksi bermasalah. Periksa internet Anda.";
  }
  return error instanceof Error
    ? error.message
    : "Terjadi kesalahan. Periksa data lalu coba lagi.";
}

export default function MasukPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const username = normalizeUsername(String(formData.get("username") ?? ""));
    const password = String(formData.get("password") ?? "");

    try {
      if (mode === "register") {
        const phone = String(formData.get("phone") ?? "").trim();
        const email = String(formData.get("email") ?? "").trim();
        const passwordConfirm = String(
          formData.get("passwordConfirm") ?? "",
        );

        if (password !== passwordConfirm) {
          setMessage("Konfirmasi kata sandi belum sama.");
          return;
        }

        if (!USERNAME_PATTERN.test(username)) {
          setMessage(
            "Username 6–30 karakter: huruf kecil, angka, _ atau - (tanpa spasi).",
          );
          return;
        }

        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, phone, email, password }),
        });
        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!response.ok) {
          setMessage(result.error ?? "Pendaftaran gagal. Coba lagi.");
          return;
        }
      }

      await signInWithEmailAndPassword(
        auth,
        usernameToEmail(username),
        password,
      );
      window.location.assign("/");
    } catch (error) {
      setMessage(authMessage(error));
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "12px 14px",
    borderRadius: 9,
    border: "1px solid #343746",
    background: "#090b10",
    color: "#f5f7fb",
    fontSize: 15,
    marginTop: 7,
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#090b10",
        color: "#f5f7fb",
        fontFamily: "Arial, sans-serif",
        padding: "50px 18px",
      }}
    >
      <section
        style={{
          maxWidth: 460,
          margin: "0 auto",
          padding: 28,
          background: "#13151e",
          border: "1px solid #252835",
          borderRadius: 16,
        }}
      >
        <a
          href="/"
          style={{ color: "#b9a6ff", textDecoration: "none" }}
        >
          ← Kembali ke beranda
        </a>

        <h1 style={{ marginTop: 28 }}>
          {mode === "login" ? "Masuk ke akun" : "Buat akun"}
        </h1>
        <p style={{ color: "#a7a9b5", lineHeight: 1.6 }}>
          {mode === "login"
            ? "Masuk menggunakan username dan kata sandi."
            : "Username, nomor telepon, dan kata sandi wajib diisi. Email boleh dikosongkan."}
        </p>

        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", marginTop: 20 }}>
            Username
            <input
              name="username"
              type="text"
              autoComplete="username"
              minLength={6}
              maxLength={30}
              required
              style={inputStyle}
            />
          </label>

          {mode === "register" && (
            <>
              <label style={{ display: "block", marginTop: 16 }}>
                Nomor telepon
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "block", marginTop: 16 }}>
                Email (opsional)
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  style={inputStyle}
                />
              </label>
            </>
          )}

          <label style={{ display: "block", marginTop: 16 }}>
            Kata sandi
            <div style={{ position: "relative" }}>
  <input
    name="password"
    type={showPassword ? "text" : "password"}
    autoComplete={
      mode === "login" ? "current-password" : "new-password"
    }
    minLength={8}
    required
    style={{ ...inputStyle, paddingRight: 52 }}
  />
  <button
    type="button"
    aria-label={showPassword ? "Sembunyikan kata sandi" : "Lihat kata sandi"}
    aria-pressed={showPassword}
    onClick={() => setShowPassword(!showPassword)}
    style={{
      position: "absolute",
      right: 12,
      top: 29,
      transform: "translateY(-50%)",
      border: 0,
      background: "transparent",
      color: "#c4b5fd",
      cursor: "pointer",
      fontSize: 18,
    }}
  >
    {showPassword ? "🙈" : "👁️"}
  </button>
</div>
          </label>

          {mode === "register" && (
            <label style={{ display: "block", marginTop: 16 }}>
              Ulangi kata sandi
              <div style={{ position: "relative" }}>
  <input
    name="passwordConfirm"
    type={showPasswordConfirm ? "text" : "password"}
    autoComplete="new-password"
    minLength={8}
    required
    style={{ ...inputStyle, paddingRight: 52 }}
  />
  <button
    type="button"
    aria-label={
      showPasswordConfirm
        ? "Sembunyikan kata sandi"
        : "Lihat kata sandi"
    }
    aria-pressed={showPasswordConfirm}
    onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
    style={{
      position: "absolute",
      right: 12,
      top: 29,
      transform: "translateY(-50%)",
      border: 0,
      background: "transparent",
      color: "#c4b5fd",
      cursor: "pointer",
      fontSize: 18,
    }}
  >
    {showPasswordConfirm ? "🙈" : "👁️"}
  </button>
</div>
            </label>
          )}

          {message && (
            <p
              role="alert"
              style={{
                color: "#fca5a5",
                background: "#351b24",
                borderRadius: 8,
                padding: 12,
                lineHeight: 1.5,
              }}
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              marginTop: 22,
              padding: 13,
              border: 0,
              borderRadius: 9,
              background: loading ? "#7463a9" : "#a78bfa",
              color: "#090b10",
              fontWeight: 700,
              fontSize: 15,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading
              ? "Memproses..."
              : mode === "login"
                ? "Masuk"
                : "Daftar"}
          </button>
        </form>
        {mode === "login" && (
  <p style={{ textAlign: "right", marginTop: 12 }}>
    Ada masalah saat masuk? Silakan{" "}
    <a
      href="/lupa-password"
      style={{ color: "#c4b5fd", textDecoration: "underline" }}
    >
      Lupa kata sandi?
    </a>
  </p>
)}

        <p style={{ color: "#a7a9b5", textAlign: "center", marginTop: 22 }}>
          {mode === "login" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMessage("");
              setMode(mode === "login" ? "register" : "login");
            }}
            style={{
              border: 0,
              background: "transparent",
              color: "#c4b5fd",
              textDecoration: "underline",
              cursor: "pointer",
              fontSize: 15,
            }}
          >
            {mode === "login" ? "Daftar" : "Masuk"}
          </button>
        </p>
      </section>
    </main>
  );
}