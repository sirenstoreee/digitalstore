import { adminAuth, adminDb, firebaseAdminConfigured } from "../../../../lib/firebase-admin";
import { isSameRequestOrigin } from "../../../../lib/request-origin";
import {
  USERNAME_PATTERN,
  normalizeUsername,
  usernameToEmail,
} from "../../../../lib/username";

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function alreadyExists(error: unknown) {
  return (error as { code?: number })?.code === 6; // Firestore ALREADY_EXISTS
}

// Membuat akun pembeli: username unik, login via Firebase Auth, profil di Firestore.
export async function POST(request: Request) {
  if (!isSameRequestOrigin(request)) return fail("Permintaan tidak valid.", 403);
  if (!firebaseAdminConfigured()) return fail("Server belum dikonfigurasi.", 503);

  const body = (await request.json().catch(() => null)) as {
    username?: string;
    phone?: string;
    email?: string;
    password?: string;
  } | null;

  const username = normalizeUsername(String(body?.username ?? ""));
  const phone = String(body?.phone ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!USERNAME_PATTERN.test(username)) {
    return fail("Username 6–30 karakter: huruf kecil, angka, _ atau - (tanpa spasi).");
  }
  if (!/^[0-9+\-\s]{8,20}$/.test(phone)) return fail("Nomor telepon tidak valid.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail("Format email tidak valid.");
  }
  if (password.length < 8 || password.length > 128) {
    return fail("Kata sandi minimal 8 karakter.");
  }

  const db = adminDb();
  const reservation = db.collection("usernames").doc(username);

  try {
    // create() gagal bila username sudah dipakai.
    await reservation.create({ created: new Date().toISOString() });
  } catch (error) {
    if (alreadyExists(error)) return fail("Username sudah dipakai.", 409);
    console.error("Register: username reservation failed", error);
    return fail("Pendaftaran gagal. Coba lagi.", 500);
  }

  let uid = "";
  try {
    const user = await adminAuth().createUser({
      email: usernameToEmail(username),
      password,
      displayName: username,
    });
    uid = user.uid;
    await reservation.update({ uid });
    await db.collection("users").doc(uid).set({
      username,
      phone,
      email,
      name: "",
      avatar: "",
      verified: false,
      created: new Date().toISOString(),
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Register failed", error);
    // Batalkan setengah jadi supaya username tidak "terkunci".
    if (uid) await adminAuth().deleteUser(uid).catch(() => undefined);
    await reservation.delete().catch(() => undefined);
    return fail("Pendaftaran gagal. Coba lagi.", 500);
  }
}
