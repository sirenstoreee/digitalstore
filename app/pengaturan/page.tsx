"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Cropper from "react-easy-crop";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { subscribeBuyer, type Buyer } from "../../lib/buyer";

type CropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Foto tidak dapat dibaca."));
    image.src = source;
  });
}

// Hasil crop dikecilkan menjadi 256x256 JPEG (sekitar 20 KB) lalu disimpan di profil.
async function makeCroppedAvatar(
  source: string,
  area: CropArea,
): Promise<string> {
  const image = await loadImage(source);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Browser tidak dapat memproses foto.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, 256, 256);
  context.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    256,
    256,
  );

  return canvas.toDataURL("image/jpeg", 0.85);
}

export default function PengaturanPage() {
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [loading, setLoading] = useState(true);

  const [editingName, setEditingName] = useState(false);
  const [fullName, setFullName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");

  const [cropImage, setCropImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<CropArea | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState("");

  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");

  useEffect(() => {
    return subscribeBuyer((record) => {
      if (!record) {
        window.location.assign("/masuk");
        return;
      }

      setBuyer(record);
      setEmailInput((current) => current || String(record.email ?? ""));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!cropImage) return;
    return () => URL.revokeObjectURL(cropImage);
  }, [cropImage]);

  function chooseAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setAvatarMessage("Pilih gambar PNG, JPG, atau WEBP.");
      return;
    }

    setAvatarMessage("");
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
    setCropImage(URL.createObjectURL(file));
  }

  function cancelCrop() {
    setCropImage(null);
    setCroppedArea(null);
  }

  async function saveAvatar() {
    if (!buyer || !cropImage || !croppedArea) {
      setAvatarMessage("Atur posisi foto terlebih dahulu.");
      return;
    }

    setSavingAvatar(true);
    setAvatarMessage("");

    try {
      const avatarData = await makeCroppedAvatar(cropImage, croppedArea);
      await updateDoc(doc(db, "users", buyer.id), { avatar: avatarData });

      setCropImage(null);
      setAvatarMessage("Foto profil berhasil disimpan.");
    } catch (error) {
      setAvatarMessage(
        error instanceof Error ? error.message : "Foto profil gagal disimpan.",
      );
    } finally {
      setSavingAvatar(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!buyer) return;

    const name = fullName.trim();
    if (!name) {
      setProfileMessage("Nama lengkap tidak boleh kosong.");
      return;
    }

    setSavingProfile(true);
    setProfileMessage("");

    try {
      await updateDoc(doc(db, "users", buyer.id), { name });
      setEditingName(false);
      setProfileMessage("Nama lengkap berhasil disimpan.");
    } catch (error) {
      setProfileMessage(
        error instanceof Error ? error.message : "Nama lengkap gagal disimpan.",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!buyer) return;

    const email = emailInput.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailMessage("Masukkan alamat email yang valid.");
      return;
    }

    setSavingEmail(true);
    setEmailMessage("");

    try {
      await updateDoc(doc(db, "users", buyer.id), { email });
      setEmailMessage("Email berhasil disimpan.");
    } catch (error) {
      setEmailMessage(
        error instanceof Error ? error.message : "Email gagal disimpan.",
      );
    } finally {
      setSavingEmail(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!buyer) return;

    setSavingPassword(true);
    setPasswordMessage("");

    const formData = new FormData(event.currentTarget);
    const oldPassword = String(formData.get("oldPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

    if (newPassword !== passwordConfirm) {
      setPasswordMessage("Kata sandi baru dan ulangannya belum sama.");
      setSavingPassword(false);
      return;
    }

    const form = event.currentTarget;

    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error("Silakan masuk ulang.");

      // Firebase meminta konfirmasi kata sandi lama sebelum menggantinya.
      await reauthenticateWithCredential(
        user,
        EmailAuthProvider.credential(user.email, oldPassword),
      );
      await updatePassword(user, newPassword);

      setPasswordMessage("Kata sandi berhasil diubah.");
      form.reset();
    } catch (error) {
      const code = (error as { code?: string })?.code ?? "";
      setPasswordMessage(
        code === "auth/invalid-credential" || code === "auth/wrong-password"
          ? "Kata sandi saat ini salah."
          : code === "auth/too-many-requests"
            ? "Terlalu banyak percobaan. Coba lagi beberapa menit lagi."
            : error instanceof Error
              ? error.message
              : "Kata sandi gagal diubah.",
      );
    } finally {
      setSavingPassword(false);
    }
  }

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: 12,
    marginTop: 7,
    borderRadius: 8,
    border: "1px solid #343746",
    background: "#090b10",
    color: "#f5f7fb",
    fontSize: 15,
  };

  const cardStyle = {
    marginTop: 20,
    padding: 24,
    background: "#13151e",
    border: "1px solid #252835",
    borderRadius: 14,
  };

  const buttonStyle = {
    padding: "12px 18px",
    border: 0,
    borderRadius: 8,
    background: "#a78bfa",
    color: "#090b10",
    fontWeight: 700,
    cursor: "pointer",
  };

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#090b10",
          color: "#f5f7fb",
          padding: 40,
        }}
      >
        Memuat pengaturan akun...
      </main>
    );
  }

  if (!buyer) return null;

  const avatarUrl = buyer.avatar || "/image/default-avatar.png";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#090b10",
        color: "#f5f7fb",
        fontFamily: "Arial, sans-serif",
        padding: "36px 7% 70px",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a
            href="/"
            aria-label="Kembali ke beranda"
            style={{
              width: 40,
              height: 40,
              display: "grid",
              placeItems: "center",
              border: "1px solid #343746",
              borderRadius: "50%",
              color: "#f5f7fb",
              textDecoration: "none",
              fontSize: 22,
            }}
          >
            ‹
          </a>
          <h1 style={{ margin: 0 }}>Pengaturan Profil</h1>
        </div>

        <section
          style={{
            marginTop: 22,
            overflow: "hidden",
            background: "#13151e",
            border: "1px solid #252835",
            borderRadius: 16,
            textAlign: "center",
            paddingBottom: 22,
          }}
        >
          <div
            style={{
              height: 110,
              background:
                "linear-gradient(120deg, #d9dcff 0%, #aab8f5 45%, #e4e8ff 100%)",
            }}
          />

          <div style={{ position: "relative", width: 96, margin: "-48px auto 10px" }}>
            <img
              src={avatarUrl}
              alt="Foto profil"
              style={{
                display: "block",
                width: 96,
                height: 96,
                borderRadius: "50%",
                border: "4px solid #f5f7fb",
                objectFit: "cover",
                background: "#fff",
              }}
            />
            <input
              id="avatar-upload"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={chooseAvatar}
              style={{ display: "none" }}
            />
            <button
              type="button"
              aria-label="Pilih foto profil"
              onClick={() => document.getElementById("avatar-upload")?.click()}
              style={{
                position: "absolute",
                right: -3,
                bottom: 0,
                width: 34,
                height: 34,
                display: "grid",
                placeItems: "center",
                border: "2px solid #13151e",
                borderRadius: "50%",
                background: "#f5f7fb",
                cursor: "pointer",
                fontSize: 17,
              }}
            >
              📷
            </button>
          </div>

          {!editingName ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 9,
              }}
            >
              <h2 style={{ margin: 0 }}>
                {buyer.name || buyer.username || "Nama buyer"}
              </h2>
              <button
                type="button"
                aria-label="Edit nama lengkap"
                onClick={() => {
                  setFullName(buyer.name ?? "");
                  setProfileMessage("");
                  setEditingName(true);
                }}
                style={{
                  border: "1px solid #343746",
                  borderRadius: 8,
                  padding: "5px 9px",
                  background: "#252835",
                  color: "#c4b5fd",
                  cursor: "pointer",
                  fontSize: 17,
                }}
              >
                ✎
              </button>
            </div>
          ) : (
            <form
              onSubmit={saveProfile}
              style={{ maxWidth: 380, margin: "0 auto", padding: "0 16px" }}
            >
              <label style={{ display: "block", textAlign: "left" }}>
                Nama lengkap
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  maxLength={100}
                  required
                  autoFocus
                  style={inputStyle}
                />
              </label>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                <button type="submit" disabled={savingProfile} style={buttonStyle}>
                  {savingProfile ? "Menyimpan..." : "Simpan"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  style={{
                    ...buttonStyle,
                    background: "#252835",
                    color: "#f5f7fb",
                  }}
                >
                  Batalkan
                </button>
              </div>
            </form>
          )}

          <p style={{ margin: "8px 0 0", color: "#a7a9b5" }}>
            {buyer.phone || "Nomor handphone belum ditambahkan"}
          </p>

          {profileMessage && (
            <p role="status" style={{ color: "#c4b5fd", margin: "10px 12px 0" }}>
              {profileMessage}
            </p>
          )}
          {avatarMessage && (
            <p role="status" style={{ color: "#c4b5fd", margin: "10px 12px 0" }}>
              {avatarMessage}
            </p>
          )}
        </section>

                <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Email akun</h2>

          <p style={{ color: "#a7a9b5", lineHeight: 1.6, marginTop: 0 }}>
            Email dipakai untuk bukti pembayaran dan membantu pemulihan akun.
            Boleh dikosongkan.
          </p>

          <form onSubmit={saveEmail}>
            <label style={{ display: "block" }}>
              Alamat email
              <input
                type="email"
                autoComplete="email"
                value={emailInput}
                onChange={(event) => {
                  setEmailInput(event.target.value);
                  setEmailMessage("");
                }}
                required
                style={inputStyle}
              />
            </label>

            <button
              type="submit"
              disabled={savingEmail}
              style={{ ...buttonStyle, marginTop: 14 }}
            >
              {savingEmail ? "Menyimpan..." : "Simpan email"}
            </button>
          </form>

          {emailMessage && (
            <p role="status" style={{ color: "#c4b5fd", lineHeight: 1.6 }}>
              {emailMessage}
            </p>
          )}
        </section>

        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Ubah kata sandi</h2>

          <form onSubmit={changePassword}>
            <label style={{ display: "block", marginTop: 16 }}>
              Kata sandi saat ini
              <input
                name="oldPassword"
                type="password"
                autoComplete="current-password"
                required
                style={inputStyle}
              />
            </label>

            <label style={{ display: "block", marginTop: 16 }}>
              Kata sandi baru
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                style={inputStyle}
              />
            </label>

            <label style={{ display: "block", marginTop: 16 }}>
              Ulangi kata sandi baru
              <input
                name="passwordConfirm"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                style={inputStyle}
              />
            </label>

            {passwordMessage && (
              <p role="status" style={{ color: "#c4b5fd", lineHeight: 1.5 }}>
                {passwordMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={savingPassword}
              style={{ ...buttonStyle, marginTop: 18 }}
            >
              {savingPassword ? "Menyimpan..." : "Ubah kata sandi"}
            </button>
          </form>
        </section>
      </div>

      {cropImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="crop-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: 16,
            background: "rgba(0, 0, 0, 0.78)",
          }}
        >
          <section
            style={{
              width: "min(600px, 100%)",
              padding: 20,
              border: "1px solid #343746",
              borderRadius: 16,
              background: "#13151e",
              color: "#f5f7fb",
            }}
          >
            <h2 id="crop-title" style={{ margin: "0 0 16px" }}>
              Atur foto profil
            </h2>

            <div
              style={{
                position: "relative",
                width: "100%",
                height: 340,
                overflow: "hidden",
                borderRadius: 10,
                background: "#090b10",
              }}
            >
              <Cropper
                image={cropImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid
                minZoom={1}
                maxZoom={3}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => setCroppedArea(pixels)}
              />
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: 18,
                color: "#c3c5d0",
              }}
            >
              Perbesar foto
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                style={{ flex: 1, accentColor: "#a78bfa" }}
              />
            </label>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 20,
              }}
            >
              <button
                type="button"
                onClick={cancelCrop}
                disabled={savingAvatar}
                style={{
                  ...buttonStyle,
                  background: "#252835",
                  color: "#f5f7fb",
                }}
              >
                Batalkan
              </button>
              <button
                type="button"
                onClick={saveAvatar}
                disabled={savingAvatar}
                style={buttonStyle}
              >
                {savingAvatar ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
