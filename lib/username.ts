// Firebase hanya mengenal login email. Username diubah menjadi email "bayangan"
// (tidak pernah dipakai mengirim email) supaya pembeli tetap login dengan username.
export const USERNAME_PATTERN = /^[a-z0-9_-]{6,30}$/;

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function usernameToEmail(username: string) {
  return `${normalizeUsername(username)}@akun.sirenofficial.my.id`;
}
