import { getSuperuserFromToken } from "../../../../lib/payment";
import { isAdminHost } from "../../../../lib/admin-host";
import { adminDb } from "../../../../lib/firebase-admin";
import { isSameRequestOrigin } from "../../../../lib/request-origin";

// Gambar disimpan di Firestore (Firebase Storage berbayar). Panel admin mengecilkan
// gambar dulu di browser, jadi batasnya kecil.
const MAX_BYTES = 700 * 1024;

function ownerToken(request: Request) {
  const cookies = request.headers.get("cookie") ?? "";
  const match = cookies.match(/(?:^|;\s*)siren_owner_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export async function POST(request: Request) {
  if (!isAdminHost(request.headers.get("host"))) {
    return Response.json({ error: "Tidak ditemukan." }, { status: 404 });
  }
  if (!isSameRequestOrigin(request)) {
    return Response.json({ error: "Permintaan tidak valid." }, { status: 403 });
  }
  const token = ownerToken(request);
  if (!token || !(await getSuperuserFromToken(token))) {
    return Response.json({ error: "Sesi Superuser berakhir." }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File) || !file.size) {
      return Response.json({ error: "Pilih gambar terlebih dahulu." }, { status: 400 });
    }
    if (file.type !== "image/webp") {
      return Response.json({ error: "Gambar harus sudah dikonversi ke WEBP." }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length > MAX_BYTES) {
      return Response.json(
        { error: "Gambar masih terlalu besar (maksimal 700 KB). Pilih gambar yang lebih kecil." },
        { status: 400 },
      );
    }

    const ref = adminDb().collection("store_assets").doc();
    await ref.set({
      contentType: file.type,
      data: bytes,
      size: bytes.length,
      created: new Date().toISOString(),
    });
    return Response.json({ url: `/api/asset/${ref.id}` });
  } catch (error) {
    console.error("Admin image upload failed.", error);
    return Response.json({ error: "Gambar gagal diunggah." }, { status: 500 });
  }
}
