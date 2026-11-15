import ProductActions, { LiveStock } from "./product-actions";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getStoreCategory } from "../../../../lib/store-data";
import { getProduct } from "../../../../lib/products-db";

type ProductDetailProps = {
  params: Promise<{
    id: string;
    productId: string;
  }>;
};

async function ProductDetail({ params }: ProductDetailProps) {
  const { id, productId } = await params;

  const game = await getStoreCategory(id);
  const product = await getProduct(id, productId);

  if (!game || !product) {
    notFound();
  }

  const message = encodeURIComponent(
    `Halo SIREN OFFICIAL, saya ingin bertanya tentang ${product.name}. Apakah stok dan harganya tersedia?`
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#090b10",
        color: "#f5f7fb",
        fontFamily: "Arial, sans-serif",
        padding: "0 7% 70px",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          paddingTop: 28,
        }}
      >
        <a
          href={`/products/${game.slug}`}
          style={{ color: "#b9a6ff", textDecoration: "none" }}
        >
          ← Kembali ke {game.name}
        </a>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 28,
            marginTop: 28,
            padding: 24,
            background: "#13151e",
            border: "1px solid #252835",
            borderRadius: 16,
          }}
        >
          <div>
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 18 }}>
              <a
                href={`https://wa.me/6285176710079?text=${encodeURIComponent(`Halo SIREN OFFICIAL, saya ingin bertanya seputar produk ${product.name}.`)}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, minWidth: 0, whiteSpace: "nowrap", padding: "11px 8px", borderRadius: 10, background: "#22c55e", color: "#052e16", textDecoration: "none", fontWeight: 700, fontSize: 12 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <path d="M12.03 2a9.9 9.9 0 0 0-8.55 14.9L2 22l5.27-1.38A9.98 9.98 0 1 0 12.03 2Zm0 18.2a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.13.82.84-3.05-.2-.32A8.2 8.2 0 1 1 12.03 20.2Zm4.5-6.14c-.25-.13-1.48-.73-1.71-.81-.23-.09-.4-.13-.56.13-.17.25-.65.81-.8.98-.15.17-.3.19-.56.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.25-1.5-1.4-1.75-.15-.25-.02-.39.11-.52.12-.11.25-.3.38-.44.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.48-.4-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.08s.9 2.41 1.02 2.58c.13.17 1.77 2.7 4.28 3.78.6.26 1.07.42 1.43.53.6.19 1.14.16 1.57.1.48-.07 1.48-.61 1.69-1.2.21-.59.21-1.1.15-1.2-.06-.11-.23-.17-.48-.3Z" />
                </svg>
                Tanya lewat WhatsApp
              </a>
              <a
                href="https://discord.gg/t3baYHhFUa"
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, minWidth: 0, whiteSpace: "nowrap", padding: "11px 8px", borderRadius: 10, background: "#5865F2", color: "#ffffff", textDecoration: "none", fontWeight: 700, fontSize: 12 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <path d="M20.3 4.37a19.8 19.8 0 0 0-4.88-1.52.08.08 0 0 0-.08.04c-.21.38-.45.87-.61 1.25a18.3 18.3 0 0 0-5.49 0c-.17-.39-.41-.87-.62-1.25a.08.08 0 0 0-.08-.04 19.7 19.7 0 0 0-4.88 1.52.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 5.99 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.23-1.99a.08.08 0 0 0-.04-.11 13 13 0 0 1-1.87-.89.08.08 0 0 1-.01-.13l.37-.29a.07.07 0 0 1 .08-.01c3.93 1.79 8.18 1.79 12.06 0a.07.07 0 0 1 .08.01l.37.29a.08.08 0 0 1-.01.13 12.3 12.3 0 0 1-1.87.89.08.08 0 0 0-.04.11c.36.7.77 1.36 1.23 1.99a.08.08 0 0 0 .08.03 19.9 19.9 0 0 0 6-3.03.08.08 0 0 0 .03-.06c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03ZM8.02 15.33c-1.18 0-2.16-1.09-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.96 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.16-1.09-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.95 2.42-2.16 2.42Z" />
                </svg>
                Tanya lewat Discord
              </a>
            </div>
          </div>

          <div>
            <h1
              style={{
                fontSize: 30,
                margin: "0 0 14px",
                padding: "12px 18px",
                borderRadius: 12,
                border: "1.5px solid rgba(129, 140, 248, 0.45)",
                boxShadow:
                  "inset 5px 0 0 #818cf8, 0 8px 20px -6px rgba(0, 0, 0, 0.5)",
                background:
                  "linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)",
              }}
            >
              {product.name}
            </h1>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
                padding: "10px 16px",
                borderRadius: 12,
                margin: "6px 0 8px",
                border: "1.5px solid rgba(34, 197, 94, 0.55)",
                background:
                  "linear-gradient(135deg, rgba(34, 197, 94, 0.18) 0%, rgba(16, 185, 129, 0.06) 100%)",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#cbd5e1",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                }}
              >
                Harga:
              </span>
              <span
                style={{
                  fontSize: product.priceValue > 0 ? 28 : 16,
                  fontWeight: 900,
                  color: "#4ade80",
                  lineHeight: 1,
                }}
              >
                {product.price}
              </span>
            </div>

            <p style={{ color: "#c4b5fd", margin: "6px 0" }}>
              <LiveStock recordId={product.recordId} initial={product.stock} />
            </p>

            <ProductActions
              product={{
                id: product.id,
                recordId: product.recordId,
                name: product.name,
                price: product.price,
                priceValue: product.priceValue,
                stock: product.stock,
                variants: product.variants,
              }}
            />
          </div>
        </section>

        <section
          style={{
            marginTop: 22,
            padding: 24,
            background: "#13151e",
            border: "1px solid #252835",
            borderRadius: 16,
          }}
        >
          <h2>Cara order dan proses transaksi</h2>
          <ol style={{ color: "#c3c5d0", lineHeight: 1.9, paddingLeft: 22 }}>
            <li>Pilih produk dan jumlah yang ingin dibeli.</li>
            <li>Selesaikan pembayaran melalui halaman Midtrans.</li>
            <li>Pesanan diproses setelah pembayaran diverifikasi.</li>
            <li>Status pesanan dapat dipantau dari halaman akun Anda.</li>
          </ol>
          <p style={{ color: "#858897", fontSize: 13 }}>
            Harga dan stok ditampilkan langsung dari katalog toko.
          </p>
        </section>
      </div>
    </main>
  );
}

export default function ProductDetailPage(props: ProductDetailProps) {
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
          Memuat detail produk...
        </main>
      }
    >
      <ProductDetail {...props} />
    </Suspense>
  );
}
