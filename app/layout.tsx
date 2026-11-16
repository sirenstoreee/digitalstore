import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SiteHeader from "./products/site-header";
import SiteFooter from "./site-footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.sirenofficial.my.id"),
  title: {
    default: "JOKI ROBLOX TERPERCAYA | SIREN OFFICIAL",
    template: "%s | SIREN OFFICIAL",
  },
  description:
    "Joki Roblox Siren Official: layanan joki Blox Fruits dan produk game dengan proses jelas, bantuan responsif, dan pembayaran aman.",
  keywords: [
    "joki roblox termurah",
    "joki roblox terpercaya",
    "joki bloxfruit",
    "item roblox",
    "joki roblox siren",
    "joki roblox siren store",
    "joki roblox siren official",
    "siren official",
  ],
  icons: { icon: "/brand/logothumbnail.webp", apple: "/brand/logothumbnail.webp" },
  openGraph: {
    title: "JOKI ROBLOX | SIREN OFFICIAL",
    description:
      "Joki Roblox dan produk game dengan proses yang jelas, bantuan responsif, dan pembayaran aman.",
    url: "https://www.sirenofficial.my.id",
    siteName: "SIREN OFFICIAL",
    locale: "id_ID",
    type: "website",
    images: ["/brand/logothumbnail.webp"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
