import type { MetadataRoute } from "next";
import { getProducts } from "../lib/products-db";
import { getStoreCategories } from "../lib/store-data";

const base = "https://www.sirenofficial.my.id";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    "",
    "/products",
    "/contact",
    "/kebijakan-privasi",
    "/testimoni",
  ].map((path) => ({ url: `${base}${path}`, changeFrequency: "weekly", priority: path ? 0.7 : 1 }));

  try {
    const [categories, products] = await Promise.all([getStoreCategories(), getProducts()]);
    pages.push(
      ...categories.map((category) => ({
        url: `${base}/products/${encodeURIComponent(category.slug)}`,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...products.map((product) => ({
        url: `${base}/products/${encodeURIComponent(product.gameId)}/${encodeURIComponent(product.id)}`,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    );
  } catch {
    // Keep the public pages in the sitemap even when the product database is unavailable.
  }

  return pages;
}
