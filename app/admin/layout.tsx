import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ADMIN | Siren Official",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/SU.webp", apple: "/brand/SU.webp" },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
