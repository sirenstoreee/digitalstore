"use client";

import { useEffect, useState } from "react";

type Product = {
  id: string;
  slug: string;
  gameId: string;
  name: string;
  image?: string;
  description?: string;
  price: number;
  stock: number;
  variants?: Variant[];
};

type Variant = { id?: string; name: string; price: number; stock: number; image?: string };

type Category = { id: string; slug: string; name: string; image?: string; description?: string };
type Settings = {
  storeName: string;
  tagline: string;
  heroTitle: string;
  heroDescription: string;
  accentColor: string;
  backgroundColor: string;
};
type AdminData = {
  products: Product[];
  categories: Category[];
  settings: Settings;
  summary: { products: number; categories: number; pendingOrders: number; paidOrders: number; lowStock: number };
  discord: { configured: boolean; pending: number; failed: number };
};

const emptyData: AdminData = {
  products: [],
  categories: [],
  settings: {
    storeName: "SIREN OFFICIAL",
    tagline: "JOKI TERPERCAYA, CEPAT, DAN AMAN 100%",
    heroTitle: "Item game favorit,\nlangsung di tangan.",
    heroDescription: "Top up dan produk game dengan proses yang jelas, aman, dan praktis.",
    accentColor: "#a78bfa",
    backgroundColor: "#090b10",
  },
  summary: { products: 0, categories: 0, pendingOrders: 0, paidOrders: 0, lowStock: 0 },
  discord: { configured: false, pending: 0, failed: 0 },
};

// Gambar dikecilkan di browser (maks 1200 px, WEBP) supaya muat disimpan di database.
async function shrinkImage(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Gambar tidak dapat dibaca."));
      element.src = url;
    });
    const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Browser tidak dapat memproses gambar.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    let webpSupported = false;
    for (const quality of [0.85, 0.7, 0.55, 0.4]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", quality),
      );
      if (!blob || blob.type !== "image/webp") continue;
      webpSupported = true;
      if (blob.size <= 650 * 1024) {
        const name = file.name.replace(/\.[^.]+$/, "") || "gambar";
        return new File([blob], `${name}.webp`, { type: "image/webp" });
      }
    }
    if (!webpSupported) {
      throw new Error("Browser ini tidak mendukung pembuatan gambar WEBP. Gunakan browser terbaru.");
    }
    throw new Error("Gambar terlalu besar. Pilih gambar yang lebih kecil.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

const money = (value: number) => `Rp ${Number(value || 0).toLocaleString("id-ID")}`;

export default function AdminDashboard() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [data, setData] = useState<AdminData>(emptyData);
  const [tab, setTab] = useState("overview");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [productVariants, setProductVariants] = useState<Variant[]>([]);
  const [categoryDraft, setCategoryDraft] = useState<Category | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");

  async function loadData() {
    const response = await fetch("/api/admin/data", { credentials: "same-origin", cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error ?? "Panel gagal dimuat.");
    setData(result as AdminData);
    setLoggedIn(true);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/admin/data", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const result = (await response.json()) as AdminData;
        if (active) {
          setData(result);
          setLoggedIn(true);
        }
      })
      .catch(() => undefined)
      .finally(() => active && setChecking(false));
    return () => { active = false; };
  }, []);

  async function post(action: string, body: Record<string, unknown>) {
    const response = await fetch("/api/admin/data", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error ?? "Permintaan gagal.");
    return result;
  }

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/payment/owner-login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Login gagal.");
      setPassword("");
      await loadData();
      setMessage("Berhasil masuk sebagai Superuser.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Login gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/payment/owner-logout", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => undefined);
    setLoggedIn(false);
    setData(emptyData);
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const product = Object.fromEntries(form.entries()) as Record<string, string>;
    setBusy(true);
    setError("");
    try {
      await post("save-product", {
        product: {
          ...product,
          id: editing?.id,
          price: Number(product.price),
          stock: Number(product.stock),
          variants: productVariants,
        },
      });
      setEditing(null);
      setProductVariants([]);
      setMessage("Produk berhasil disimpan.");
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Produk gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(file: File, target: "product" | "category" | "variant", variantIndex?: number) {
    const form = new FormData();
    form.set("image", await shrinkImage(file));
    const response = await fetch("/api/admin/upload", {
      method: "POST",
      credentials: "same-origin",
      body: form,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error ?? "Gambar gagal diunggah.");
    if (target === "product" && editing) setEditing({ ...editing, image: result.url });
    if (target === "category" && categoryDraft) setCategoryDraft({ ...categoryDraft, image: result.url });
    if (target === "variant" && variantIndex !== undefined) setProductVariants((current) => current.map((variant, index) => index === variantIndex ? { ...variant, image: result.url } : variant));
  }

  function startNewProduct() {
    setEditing({ id: "", slug: "", gameId: data.categories[0]?.slug ?? "", name: "", image: "", description: "", price: 0, stock: 0 });
    setProductVariants([]);
    setError("");
  }

  function startEditProduct(product: Product) {
    setEditing(product);
    setProductVariants(product.variants ?? []);
    setError("");
  }

  async function saveCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const category = Object.fromEntries(form.entries()) as Record<string, string>;
    setBusy(true);
    setError("");
    try {
      await post("save-category", { category: { ...category, id: categoryDraft?.id } });
      setCategoryDraft(null);
      setMessage("Kategori berhasil disimpan.");
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kategori gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const settings = Object.fromEntries(form.entries()) as Record<string, string>;
    setBusy(true);
    setError("");
    try {
      await post("save-settings", { settings });
      setMessage("Tampilan website berhasil diperbarui.");
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Pengaturan gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`Hapus produk “${product.name}”?`)) return;
    setBusy(true);
    try {
      await post("delete-product", { id: product.id });
      setMessage("Produk berhasil dihapus.");
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Produk gagal dihapus.");
    } finally {
      setBusy(false);
    }
  }

  async function discordAction(action: "test-discord" | "retry-discord") {
    setBusy(true);
    setError("");
    try {
      const result = await post(action, {});
      setMessage(action === "test-discord" ? "Pesan tes terkirim ke Discord." : `${result.attempted} notifikasi dicoba ulang.`);
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Webhook Discord gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDiscordWebhook(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("save-discord-webhook", { webhookUrl: discordWebhookUrl });
      setDiscordWebhookUrl("");
      setMessage("Link webhook Discord berhasil disimpan.");
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Link webhook gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", border: "1px solid #d8dee8", borderRadius: 8,
    padding: "10px 12px", background: "#fff", color: "#172033", font: "inherit",
  };
  const cardStyle: React.CSSProperties = {
    background: "#fff", border: "1px solid #e5e9f0", borderRadius: 12, padding: 20,
    boxShadow: "0 2px 10px rgba(20,35,60,.04)",
  };
  const buttonStyle: React.CSSProperties = {
    border: 0, borderRadius: 8, background: "#2879e8", color: "#fff", padding: "10px 15px",
    fontWeight: 700, cursor: "pointer",
  };
  const nav = [
    ["overview", "Beranda"], ["products", "Kelola Produk"], ["categories", "Kategori"],
    ["appearance", "Tampilan Website"], ["discord", "Webhook Discord"],
  ];

  if (checking) return <div style={{ padding: 40, fontFamily: "Arial" }}>Memuat panel…</div>;
  if (!loggedIn) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f3f5f8", fontFamily: "Arial,sans-serif", padding: 20 }}>
        <form onSubmit={login} style={{ ...cardStyle, width: "min(420px, 100%)", display: "grid", gap: 14 }}>
          <div style={{ color: "#2879e8", fontWeight: 800, letterSpacing: 1 }}>SIREN OFFICIAL · PANEL SUPERUSER</div>
          <h1 style={{ margin: 0, fontSize: 25 }}>Masuk ke pengelolaan toko</h1>
          <p style={{ margin: 0, color: "#617087", lineHeight: 1.5 }}>Masuk dengan akun owner (ADMIN_EMAIL). Panel ini terpisah dari area pembeli.</p>
          <input style={inputStyle} type="email" required placeholder="Email Superuser" value={email} onChange={(event) => setEmail(event.target.value)} />
          <input style={inputStyle} type="password" required placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
          {error && <p style={{ margin: 0, color: "#c62828" }}>{error}</p>}
          <button style={buttonStyle} type="submit" disabled={busy}>{busy ? "Memeriksa…" : "Masuk"}</button>
        </form>
      </main>
    );
  }

  const filteredProducts = data.products.filter((product) =>
    `${product.name} ${product.slug} ${product.gameId}`.toLowerCase().includes(query.toLowerCase()),
  );
  const tabTitle = nav.find(([id]) => id === tab)?.[1] ?? "Beranda";

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "230px minmax(0,1fr)", background: "#f3f5f8", color: "#172033", fontFamily: "Arial,sans-serif" }}>
      <aside style={{ background: "#fff", borderRight: "1px solid #e2e6ed", padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 18, fontWeight: 800, padding: "8px 8px 22px" }}>SIREN <span style={{ color: "#2879e8" }}>SUPERUSER</span></div>
        <a href="/products" onClick={(event) => { event.preventDefault(); const base = window.location.hostname === "admin.localhost" ? "http://localhost:3000" : (process.env.NEXT_PUBLIC_STORE_URL ?? "https://sirenofficial.my.id"); window.open(`${base}/products`, "_blank", "noopener,noreferrer"); }} style={{ textDecoration: "none", borderRadius: 8, padding: "12px 10px", color: "#43516a", fontWeight: 700 }}>Produk ↗</a>
        {nav.map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); setEditing(null); setError(""); }} style={{ textAlign: "left", border: 0, borderRadius: 8, padding: "12px 10px", background: tab === id ? "#e8f1ff" : "transparent", color: tab === id ? "#1766ce" : "#43516a", fontWeight: 700, cursor: "pointer" }}>{label}</button>
        ))}
        <a href="/admin/pesanan" style={{ textDecoration: "none", borderRadius: 8, padding: "12px 10px", color: "#43516a", fontWeight: 700 }}>Pesanan</a>
        <a href="/" onClick={(event) => { event.preventDefault(); const base = window.location.hostname === "admin.localhost" ? "http://localhost:3000" : (process.env.NEXT_PUBLIC_STORE_URL ?? "https://sirenofficial.my.id"); window.open(base, "_blank", "noopener,noreferrer"); }} style={{ marginTop: "auto", color: "#43516a", padding: "12px 10px" }}>Lihat toko pembeli ↗</a>
        <button onClick={logout} style={{ textAlign: "left", border: 0, background: "transparent", padding: "12px 10px", color: "#9b2932", fontWeight: 700, cursor: "pointer" }}>Keluar</button>
      </aside>

      <main style={{ minWidth: 0, padding: "26px clamp(18px, 3vw, 44px) 60px" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 26 }}>
          <div><p style={{ margin: "0 0 5px", color: "#718096", fontSize: 13 }}>PANEL TOKO / SUPERUSER</p><h1 style={{ margin: 0, fontSize: 28 }}>{tabTitle}</h1></div>
          <a href="/" onClick={(event) => { event.preventDefault(); const base = window.location.hostname === "admin.localhost" ? "http://localhost:3000" : (process.env.NEXT_PUBLIC_STORE_URL ?? "https://sirenofficial.my.id"); window.open(base, "_blank", "noopener,noreferrer"); }} style={{ color: "#2879e8" }}>Buka toko</a>
        </header>
        {message && <div style={{ ...cardStyle, padding: 12, marginBottom: 12, color: "#176b3b" }}>{message}<button onClick={() => setMessage("")} style={{ float: "right", border: 0, background: "none", cursor: "pointer" }}>×</button></div>}
        {error && <div style={{ ...cardStyle, padding: 12, marginBottom: 12, color: "#a2202a" }}>{error}<button onClick={() => setError("")} style={{ float: "right", border: 0, background: "none", cursor: "pointer" }}>×</button></div>}

        {tab === "overview" && (
          <>
            <p style={{ color: "#637087", marginTop: -12 }}>Ringkasan toko dan aktivitas terbaru.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14, marginBottom: 20 }}>
              {[["Produk", data.summary.products], ["Kategori", data.summary.categories], ["Pesanan menunggu bayar", data.summary.pendingOrders], ["Dibayar, perlu diproses", data.summary.paidOrders], ["Stok rendah (≤5)", data.summary.lowStock]].map(([label, value]) => <div key={String(label)} style={cardStyle}><div style={{ color: "#69778b", fontSize: 14 }}>{label}</div><strong style={{ display: "block", fontSize: 29, marginTop: 10 }}>{value}</strong></div>)}
            </div>
            <div style={cardStyle}><h2 style={{ marginTop: 0, fontSize: 18 }}>Akses cepat</h2><div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}><button style={buttonStyle} onClick={() => { setTab("products"); startNewProduct(); }}>Tambah produk</button><button style={{ ...buttonStyle, background: "#fff", color: "#2879e8", border: "1px solid #b7cceb" }} onClick={() => { setTab("categories"); setCategoryDraft({ id: "", slug: "", name: "", image: "", description: "" }); }}>Tambah kategori</button><a href="/admin/pesanan" style={{ ...buttonStyle, textDecoration: "none" }}>Kelola pesanan</a></div></div>
          </>
        )}

        {tab === "products" && (
          <>
            <div style={{ ...cardStyle, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 14 }}>
              <input style={{ ...inputStyle, maxWidth: 360 }} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari produk atau kategori" />
              <button style={buttonStyle} onClick={startNewProduct}>Tambah Produk +</button>
            </div>
            {editing && (
              <form key={editing.id || "new-product"} onSubmit={saveProduct} style={{ ...cardStyle, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 13, marginBottom: 16 }}>
                <h2 style={{ gridColumn: "1/-1", margin: 0, fontSize: 19 }}>{editing.id ? "Edit produk" : "Produk baru"}</h2>
                <label>Nama produk<input name="name" required defaultValue={editing.name} style={inputStyle} /></label>
                <label>Slug URL<input name="slug" placeholder="Dibuat otomatis dari nama jika kosong" defaultValue={editing.slug} style={inputStyle} /></label>
                <label>Kategori<div style={{ display: "flex", gap: 8 }}><select name="gameId" required defaultValue={editing.gameId} style={inputStyle}>{data.categories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}</select><button type="button" title="Tambah kategori" aria-label="Tambah kategori" onClick={() => { setTab("categories"); setCategoryDraft({ id: "", slug: "", name: "", image: "", description: "" }); }} style={{ ...buttonStyle, display: "grid", placeItems: "center", padding: 4, minWidth: 44 }}><img src="/admin/uploadimage.webp" alt="" style={{ width: 34, height: 34, objectFit: "contain" }} /></button></div></label>
                <label>Harga (Rupiah)<input name="price" type="number" min="0" step="1" required defaultValue={editing.price} style={inputStyle} /></label>
                <label>Stok<input name="stock" type="number" min="0" step="1" required defaultValue={editing.stock} style={inputStyle} /></label>
                <input type="hidden" name="image" value={editing.image ?? ""} />
                <label>Unggah gambar<div style={{ position: "relative", marginTop: 6, minHeight: 92, border: "2px dashed #b9c5d5", borderRadius: 10, display: "grid", placeItems: "center", gap: 4, padding: 10, cursor: "pointer", background: "#f8fafc" }}><img src="/admin/uploadimage.webp" alt="" style={{ width: 42, height: 42, objectFit: "contain" }} /><span style={{ color: "#657287", fontSize: 13 }}>Klik untuk memilih gambar. File disimpan sebagai WebP.</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => event.target.files?.[0] && uploadImage(event.target.files[0], "product").catch((reason) => setError(reason.message))} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }} /></div></label>
                <label style={{ gridColumn: "1/-1" }}>Deskripsi<textarea name="description" rows={4} defaultValue={editing.description} style={inputStyle} /></label>
                <section style={{ gridColumn: "1/-1", border: "1px solid #e5e9f0", borderRadius: 10, padding: 14 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}><strong>Opsi / jenis produk</strong><button type="button" onClick={() => setProductVariants((current) => [...current, { name: "", price: 0, stock: 0, image: "" }])} style={buttonStyle}>＋ Tambah opsi</button></div><p style={{ color: "#69778b", fontSize: 13 }}>Tambahkan variasi seperti warna atau paket. Setiap opsi dapat memiliki harga, stok, dan gambar sendiri.</p>{productVariants.map((variant, index) => <div key={variant.id ?? index} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, alignItems: "end", padding: "10px 0", borderTop: "1px solid #e8edf3" }}><label>Nama opsi<input value={variant.name} onChange={(event) => setProductVariants((current) => current.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} style={inputStyle} placeholder="Contoh: 5 Truck Gift" /></label><label>Harga (Rp)<input type="number" min="0" step="1" value={variant.price} onChange={(event) => setProductVariants((current) => current.map((item, i) => i === index ? { ...item, price: Number(event.target.value) } : item))} style={inputStyle} /></label><label>Stok<input type="number" min="0" step="1" value={variant.stock} onChange={(event) => setProductVariants((current) => current.map((item, i) => i === index ? { ...item, stock: Number(event.target.value) } : item))} style={inputStyle} /></label><label>Gambar opsi<div style={{ position: "relative", marginTop: 6, minHeight: 72, border: "2px dashed #b9c5d5", borderRadius: 8, display: "grid", placeItems: "center", padding: 6, cursor: "pointer" }}><img src={variant.image || "/admin/uploadimage.webp"} alt="" style={{ width: 38, height: 38, objectFit: "contain", borderRadius: 4 }} /><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => event.target.files?.[0] && uploadImage(event.target.files[0], "variant", index).catch((reason) => setError(reason.message))} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }} /></div></label><button type="button" onClick={() => setProductVariants((current) => current.filter((_, i) => i !== index))} style={{ ...buttonStyle, background: "#fff1f1", color: "#b4232c" }}>Hapus opsi</button></div>)}</section>
                {editing.image && <img src={editing.image} alt="Pratinjau produk" style={{ width: 110, height: 90, objectFit: "cover", borderRadius: 8 }} />}
                <div style={{ gridColumn: "1/-1", display: "flex", gap: 9 }}><button style={buttonStyle} disabled={busy}>{busy ? "Menyimpan…" : "Simpan produk"}</button><button type="button" onClick={() => setEditing(null)} style={{ ...buttonStyle, background: "#eef1f5", color: "#3d4b60" }}>Batal</button></div>
              </form>
            )}
            <div style={{ ...cardStyle, padding: 0, overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}><thead><tr>{["Produk", "Kategori", "Harga", "Stok", "Aksi"].map((item) => <th key={item} style={{ textAlign: "left", padding: 13, background: "#f7f9fc", color: "#64738a", fontSize: 13 }}>{item}</th>)}</tr></thead><tbody>{filteredProducts.map((product) => <tr key={product.id} style={{ borderTop: "1px solid #e8edf3" }}><td style={{ padding: 12 }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}>{product.image ? <img src={product.image} alt="" style={{ width: 44, height: 44, borderRadius: 7, objectFit: "cover" }} /> : <span style={{ width: 44, height: 44, background: "#edf1f7", borderRadius: 7 }} />}<span><strong>{product.name}</strong><small style={{ display: "block", color: "#7b8798" }}>{product.slug}</small></span></div></td><td style={{ padding: 12 }}>{data.categories.find((category) => category.slug === product.gameId)?.name ?? product.gameId}</td><td style={{ padding: 12 }}>{money(product.price)}</td><td style={{ padding: 12 }}>{product.stock}</td><td style={{ padding: 12, whiteSpace: "nowrap" }}><button onClick={() => startEditProduct(product)} style={{ ...buttonStyle, padding: "7px 10px", marginRight: 6 }}>Edit</button><button onClick={() => deleteProduct(product)} style={{ ...buttonStyle, padding: "7px 10px", background: "#fff1f1", color: "#b4232c" }}>Hapus</button></td></tr>)}</tbody></table></div>
          </>
        )}

        {tab === "categories" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><p style={{ color: "#657287" }}>Kategori menjadi pengelompokan produk pada halaman toko.</p><button style={buttonStyle} onClick={() => { setCategoryDraft({ id: "", slug: "", name: "", image: "", description: "" }); setError(""); }}>Tambah Kategori +</button></div>
            {categoryDraft && <form key={categoryDraft.id || "new-category"} onSubmit={saveCategory} style={{ ...cardStyle, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 13, marginBottom: 16 }}><h2 style={{ gridColumn: "1/-1", margin: 0, fontSize: 19 }}>{categoryDraft.id ? "Edit kategori" : "Kategori baru"}</h2><label>Nama kategori<input name="name" required defaultValue={categoryDraft.name} style={inputStyle} /></label><label>Slug kategori<input name="slug" required defaultValue={categoryDraft.slug} style={inputStyle} /></label><input type="hidden" name="image" value={categoryDraft.image ?? ""} /><label>Unggah cover<div style={{ position: "relative", marginTop: 6, minHeight: 92, border: "2px dashed #b9c5d5", borderRadius: 10, display: "grid", placeItems: "center", gap: 4, padding: 10, cursor: "pointer", background: "#f8fafc" }}><img src={categoryDraft.image || "/admin/uploadimage.webp"} alt="" style={{ width: 42, height: 42, objectFit: "contain" }} /><span style={{ color: "#657287", fontSize: 13 }}>Klik untuk memilih gambar. File disimpan sebagai WebP.</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => event.target.files?.[0] && uploadImage(event.target.files[0], "category").catch((reason) => setError(reason.message))} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }} /></div></label><label style={{ gridColumn: "1/-1" }}>Deskripsi<textarea name="description" defaultValue={categoryDraft.description} rows={3} style={inputStyle} /></label><div style={{ gridColumn: "1/-1", display: "flex", gap: 9 }}><button style={buttonStyle} disabled={busy}>Simpan kategori</button><button type="button" onClick={() => setCategoryDraft(null)} style={{ ...buttonStyle, background: "#eef1f5", color: "#3d4b60" }}>Batal</button></div></form>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 14 }}>{data.categories.map((category) => <article key={category.id} style={cardStyle}>{category.image && <img src={category.image} alt="" style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 8 }} />}<h2 style={{ marginBottom: 4, fontSize: 18 }}>{category.name}</h2><small style={{ color: "#718096" }}>{category.slug}</small><p style={{ color: "#59677d" }}>{category.description}</p><button style={{ ...buttonStyle, marginRight: 8 }} onClick={() => setCategoryDraft(category)}>Edit</button><button style={{ ...buttonStyle, background: "#fff1f1", color: "#b4232c" }} onClick={async () => { if (!window.confirm(`Hapus kategori “${category.name}”?`)) return; try { await post("delete-category", { id: category.id }); await loadData(); setMessage("Kategori dihapus."); } catch (reason) { setError(reason instanceof Error ? reason.message : "Kategori gagal dihapus."); } }}>Hapus</button></article>)}</div>
          </>
        )}

        {tab === "appearance" && (
          <form onSubmit={saveSettings} style={{ ...cardStyle, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 15, maxWidth: 1000 }}>
            <p style={{ gridColumn: "1/-1", color: "#657287", margin: 0 }}>Ubah identitas toko dan bagian utama halaman depan.</p>
            <label>Nama toko<input name="storeName" defaultValue={data.settings.storeName} style={inputStyle} /></label>
            <label>Slogan<input name="tagline" defaultValue={data.settings.tagline} style={inputStyle} /></label>
            <label style={{ gridColumn: "1/-1" }}>Judul utama<textarea name="heroTitle" rows={2} defaultValue={data.settings.heroTitle} style={inputStyle} /></label>
            <label style={{ gridColumn: "1/-1" }}>Deskripsi utama<textarea name="heroDescription" rows={3} defaultValue={data.settings.heroDescription} style={inputStyle} /></label>
            <label>Warna aksen<input name="accentColor" type="color" defaultValue={data.settings.accentColor} style={{ ...inputStyle, height: 46, padding: 4 }} /></label>
            <label>Warna latar halaman depan<input name="backgroundColor" type="color" defaultValue={data.settings.backgroundColor} style={{ ...inputStyle, height: 46, padding: 4 }} /></label>
            <button style={{ ...buttonStyle, gridColumn: "1/-1", justifySelf: "start" }} disabled={busy}>Simpan tampilan</button>
          </form>
        )}

        {tab === "discord" && (
          <section style={{ ...cardStyle, maxWidth: 760 }}>
            <h2 style={{ marginTop: 0 }}>Notifikasi pesanan ke Discord</h2>
            <p style={{ color: "#5f6e83", lineHeight: 1.6 }}>Panel mengirim pemberitahuan saat checkout berhasil dibuat dan saat Midtrans mengonfirmasi pembayaran. Pesan hanya memuat nomor pesanan, rincian produk, nilai, metode, dan status.</p>
            <p><strong>Status:</strong> {data.discord.configured ? <span style={{ color: "#168342" }}>Webhook terkonfigurasi</span> : <span style={{ color: "#b56a00" }}>Belum dikonfigurasi</span>}</p>
            <form onSubmit={saveDiscordWebhook} style={{ display: "grid", gap: 10, margin: "14px 0 18px" }}>
              <label htmlFor="discord-webhook-url" style={{ fontWeight: 700 }}>Link webhook Discord</label>
              <input id="discord-webhook-url" type="password" autoComplete="new-password" required value={discordWebhookUrl} onChange={(event) => setDiscordWebhookUrl(event.target.value)} placeholder={data.discord.configured ? "Webhook sudah tersimpan. Tempel link baru untuk menggantinya." : "Tempel link webhook Discord di sini"} style={inputStyle} />
              <small style={{ color: "#657287", lineHeight: 1.5 }}>Link disimpan di server dan tidak ditampilkan kembali di halaman ini. Jangan bagikan link webhook kepada orang lain.</small>
              <button style={{ ...buttonStyle, justifySelf: "start" }} disabled={busy}>{busy ? "Menyimpan…" : "Simpan link webhook"}</button>
            </form>
            <p>Notifikasi tertunda: <strong>{data.discord.pending}</strong> · Gagal: <strong>{data.discord.failed}</strong></p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}><button style={buttonStyle} disabled={busy || !data.discord.configured} onClick={() => discordAction("test-discord")}>Kirim pesan tes</button><button style={{ ...buttonStyle, background: "#fff", color: "#2879e8", border: "1px solid #b7cceb" }} disabled={busy || !data.discord.configured || (!data.discord.pending && !data.discord.failed)} onClick={() => discordAction("retry-discord")}>Coba ulang notifikasi tertunda</button></div>
          </section>
        )}
      </main>
    </div>
  );
}
