// Dipakai komponen "use client": memuat snap.js Midtrans dan memanggil API pembayaran.
import { authToken } from "./buyer";

const CLIENT_KEY = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? "";
// Sandbox (uang uji) kecuali NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=true.
const IS_PRODUCTION = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true";

export const snapConfigured = CLIENT_KEY.length > 0;

export type SnapCallbacks = {
  onSuccess?: () => void;
  onPending?: () => void;
  onError?: () => void;
  onClose?: () => void;
};

declare global {
  interface Window {
    snap?: { pay: (token: string, callbacks?: SnapCallbacks) => void };
  }
}

export function loadSnap() {
  return new Promise<void>((resolve, reject) => {
    if (window.snap) return resolve();

    const script = document.createElement("script");
    script.src = IS_PRODUCTION
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";
    script.setAttribute("data-client-key", CLIENT_KEY);
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("snap.js gagal dimuat"));
    document.body.appendChild(script);
  });
}

// token tidak diisi  -> memakai login pembeli.
// token "" (kosong)  -> tanpa token (panel owner memakai cookie).
export async function postPayment<T = Record<string, unknown>>(
  action: string,
  body: unknown,
  token?: string,
) {
  const bearer = token ?? (await authToken());
  const response = await fetch(`/api/payment/${action}`, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };

  return { ok: response.ok, data };
}
