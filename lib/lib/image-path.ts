// Dokumen Firestore lama dapat menyimpan path lokal dengan akhiran JPG/PNG.
// File statis proyek sudah dikonversi ke WebP, jadi arahkan path tersebut ke WebP.
export function preferWebpPath(image: string | undefined): string {
  if (!image || !image.startsWith("/") || image.startsWith("//")) {
    return image ?? "";
  }

  return image.replace(/\.(?:jpe?g|png)(?=$|[?#])/i, ".webp");
}
