import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getStoreCategory } from "../../../lib/store-data";
import { getProductsByGame } from "../../../lib/products-db";

type CategoryProps = {
  params: Promise<{ id: string }>;
};

async function CategoryPageContent({ params }: CategoryProps) {
  const { id } = await params;
  const game = await getStoreCategory(id);

  if (!game) {
    notFound();
  }

  const products = await getProductsByGame(id);

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
      <a
        href="/"
        style={{ color: "#b9a6ff", textDecoration: "none" }}
      >
        ← Kembali ke beranda
      </a>

      <section style={{ padding: "54px 0 28px" }}>
        <p style={{ color: "#b9a6ff", letterSpacing: 2, fontSize: 12 }}>
          KATEGORI GAME
        </p>
        <h1 style={{ fontSize: 42, margin: "10px 0" }}>{game.name}</h1>
        <p style={{ color: "#a7a9b5" }}>
          Pilih produk {game.name} yang kamu cari.
        </p>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 260px))",
          gap: 16,
        }}
      >
        {products.map((product) => (
          <a
            key={product.id}
            href={`/products/${game.slug}/${product.id}`}
            aria-label={`Lihat detail ${product.name}`}
            style={{
              display: "block",
              color: "inherit",
              textDecoration: "none",
              background: "#13151e",
              border: "1px solid #252835",
              borderRadius: 14,
              padding: 20,
              cursor: "pointer",
            }}
          >
            <div
  style={{
    aspectRatio: "1 / 1",
    borderRadius: 12,
    background: "#1b1b2a",
    overflow: "hidden",
  }}
>
  <img
    src={product.image}
    alt={product.name}
    style={{
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block",
    }}
  />
</div>

            <h2 style={{ fontSize: 20, margin: "14px 0 8px" }}>
              {product.name}
            </h2>

            <strong>{product.price}</strong>

            <p style={{ color: "#c4b5fd", fontSize: 13 }}>
              <span>Stok tersedia: {product.stock ?? 0}</span>
            </p>

            <span
              style={{
                color: "#b9a6ff",
                textDecoration: "underline",
                textUnderlineOffset: 4,
              }}
            >
              Lihat detail produk →
            </span>
          </a>
        ))}
      </div>
    </main>
  );
}

export default function CategoryPage(props: CategoryProps) {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            background: "#090b10",
            color: "#f5f7fb",
            padding: 40,
          }}
        >
          Memuat produk...
        </main>
      }
    >
      <CategoryPageContent {...props} />
    </Suspense>
  );
}
