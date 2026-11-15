const DEFAULT_PRODUCTION_ADMIN_HOST = "auyaxyz.sirenofficial.my.id";

export function adminHostName() {
  return (
    process.env.ADMIN_HOST?.trim().toLowerCase() ||
    (process.env.NODE_ENV === "production"
      ? DEFAULT_PRODUCTION_ADMIN_HOST
      : "admin.localhost")
  );
}

export function normalizeHost(value: string | null | undefined) {
  return (value ?? "").split(":")[0].trim().toLowerCase();
}

// ADMIN_HOST=*  -> panel owner dibuka lewat alamat utama: https://domain-anda/admin
// (cocok untuk hosting yang hanya menjalankan satu alamat, mis. cPanel).
export function adminPathMode() {
  return process.env.ADMIN_HOST?.trim() === "*";
}

// Host ini boleh memakai API panel owner (login owner, data admin, upload).
export function isAdminHost(value: string | null | undefined) {
  if (adminPathMode()) return true;
  return normalizeHost(value) === adminHostName();
}

// Host ini KHUSUS panel owner (halaman depannya langsung panel).
export function isAdminOnlyHost(value: string | null | undefined) {
  return !adminPathMode() && normalizeHost(value) === adminHostName();
}
