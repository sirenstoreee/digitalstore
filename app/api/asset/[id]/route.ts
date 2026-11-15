import { adminDb } from "../../../../lib/firebase-admin";

type RouteContext = { params: Promise<{ id: string }> };

// Menyajikan gambar yang diunggah lewat panel admin.
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) {
    return new Response("Not found", { status: 404 });
  }

  const snap = await adminDb().collection("store_assets").doc(id).get();
  const data = snap.data() as { contentType?: string; data?: Buffer } | undefined;
  if (!data?.data) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(data.data), {
    headers: {
      "Content-Type": data.contentType ?? "image/webp",
      // ID gambar tidak pernah dipakai ulang, jadi aman di-cache lama.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
