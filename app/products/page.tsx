import { Suspense } from "react";
import { getStoreCategories } from "../../lib/store-data";
import { getProducts } from "../../lib/products-db";

type ProductsPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default function ProductsPage({ searchParams }: ProductsPageProps) {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            background: "#090b10",
            color: "#f5f7fb",
            padding: 40,
            fontFamily: "Arial, sans-serif",
          }}
        >
          Memuat semua produk...
        </main>
      }
    >
      <ProductsList searchParams={searchParams} />
    </Suspense>
  );
}

async function ProductsList({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const q = Array.isArray(params.q) ? params.q[0] ?? "" : params.q ?? "";
  const query = q.trim().toLowerCase();
  const gameProducts = await getProducts();
  const categories = await getStoreCategories();

  const visibleProducts = gameProducts.filter((product) => {
    const gameName =
      categories.find((game) => game.slug === product.gameId)?.name ?? "";

    const text =
      `${product.name} ${product.description} ${gameName}`.toLowerCase();

    return text.includes(query);
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#090b10",
        color: "#f5f7fb",
        fontFamily: "Arial, sans-serif",
        padding: "48px 7% 70px",
      }}
    >
      <p style={{ color: "#b9a6ff", letterSpacing: 2 }}>KATALOG TOKO</p>
      <h1 style={{ fontSize: 40, margin: "10px 0" }}>Semua Produk</h1>
      <p style={{ color: "#a7a9b5" }}>
        Produk dari semua game ditampilkan di satu tempat.
      </p>

      <p style={{ color: "#a7a9b5", marginTop: 28 }}>
        {query
          ? `${visibleProducts.length} produk ditemukan untuk “${q}”`
          : `${visibleProducts.length} produk`}
      </p>

      {visibleProducts.length === 0 ? (
        <p style={{ color: "#a7a9b5" }}>
          Produk tidak ditemukan. Coba kata kunci lain.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 260px))",
            gap: 16,
          }}
        >
          {visibleProducts.map((product) => {
            const gameName =
              categories.find((game) => game.slug === product.gameId)?.name ??
              product.gameId;

            return (
              <article
                key={product.id}
                style={{
                  background: "#13151e",
                  border: "1px solid #252835",
                  borderRadius: 14,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    borderRadius: 10,
                    background: "#1b1b2a",
                    overflow: "hidden",
                    marginBottom: 18,
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

                <p style={{ color: "#b9a6ff", fontSize: 13 }}>{gameName}</p>
                <h2 style={{ fontSize: 19 }}>{product.name}</h2>
                <p style={{ color: "#a7a9b5" }}>{product.description}</p>
                <strong>{product.price}</strong>
                <p style={{ color: "#c4b5fd", fontSize: 13 }}>
                  <span>Stok tersedia: {product.stock ?? 0}</span>
                </p>
                <a
  href={`/products/${product.gameId}/${product.id}`}
  style={{ color: "#b9a6ff", textDecoration: "none" }}
>
  Lihat detail produk →
</a>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
