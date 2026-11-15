import { Suspense } from "react";
import { getStoreCategories, getStoreSettings } from "../lib/store-data";

export default function Home() {
  return (
    <Suspense fallback={<main style={{ minHeight: "70vh", background: "#090b10" }} />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const [categories, settings] = await Promise.all([
    getStoreCategories(),
    getStoreSettings(),
  ]);
  const [firstLine, ...restTitle] = settings.heroTitle.split("\n");

  return (
    <main style={{ minHeight: "100vh", background: settings.backgroundColor, color: "#f5f7fb", fontFamily: "Arial, sans-serif" }}>
      <section style={{ padding: "76px 7% 58px", background: `radial-gradient(ellipse at 75% 20%, ${settings.accentColor}55 0%, #11121d 40%, ${settings.backgroundColor} 78%)` }}>
        <p style={{ color: settings.accentColor, letterSpacing: 3, fontSize: 12, fontWeight: 700 }}>{settings.tagline || settings.storeName}</p>
        <h1 style={{ maxWidth: 700, fontSize: "clamp(40px, 7vw, 72px)", lineHeight: 1.05, margin: "18px 0", whiteSpace: "pre-line" }}>
          {firstLine}{restTitle.length > 0 && <><br /><span style={{ color: settings.accentColor }}>{restTitle.join(" ")}</span></>}
        </h1>
        <p style={{ maxWidth: 540, color: "#a7a9b5", fontSize: 17, lineHeight: 1.7 }}>{settings.heroDescription}</p>
        <a href="/products" style={{ display: "inline-block", marginTop: 18, background: settings.accentColor, color: "#090b10", borderRadius: 9, padding: "14px 22px", fontWeight: 700, textDecoration: "none" }}>Jelajahi produk →</a>
      </section>

      <section style={{ padding: "28px 7% 70px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 22 }}>
          <div><p style={{ color: settings.accentColor, fontSize: 12, letterSpacing: 2 }}>PILIHAN PEMAIN</p><h2 style={{ fontSize: 28, margin: 0 }}>Kategori produk</h2></div>
          <a href="/products" style={{ color: settings.accentColor, fontSize: 14, textDecoration: "none" }}>Lihat semua →</a>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 260px))", gap: 16 }}>
          {categories.map((category) => (
            <article key={category.id} style={{ background: "#13151e", border: "1px solid #252835", borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", minHeight: 300 }}>
              <a href={`/products/${category.slug}`} style={{ color: "inherit", textDecoration: "none", display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ height: 160, borderRadius: 10, background: "linear-gradient(135deg, #30234f, #151722)", display: "grid", placeItems: "center", textAlign: "center", color: "#c4b5fd", marginBottom: 18, overflow: "hidden" }}>
                  {category.image ? <img src={category.image} alt={`Cover ${category.name}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : `Gambar ${category.name} belum ditambahkan`}
                </div>
                <h3 style={{ fontSize: 22, color: "#c4b5fd" }}>{category.name}</h3>
                <p style={{ color: "#a7a9b5", lineHeight: 1.5 }}>{category.description}</p>
                <span style={{ color: settings.accentColor, display: "block", textAlign: "right", marginTop: "auto", paddingTop: 12 }}>Lihat produk →</span>
              </a>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
