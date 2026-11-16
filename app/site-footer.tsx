"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const whatsappUrl =
  "https://api.whatsapp.com/send/?phone=6285176710079&text=Halo+SIREN+OFFICIAL%2C+saya+ingin+bertanya+tentang+produk.&type=phone_number&app_absent=0";

function DiscordMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M8 8.2c2.4-1.2 4.8-1.7 8-1.7s5.6.5 8 1.7c1.8 2.6 2.8 5.7 3 9.4-2.1 2.4-4.2 3.7-6.3 4.3l-1.3-2.1c.9-.3 1.8-.8 2.6-1.4-4 1.9-9.3 1.9-13.3 0 .8.6 1.7 1.1 2.6 1.4L10 21.9c-2.1-.6-4.2-1.9-6.3-4.3.2-3.7 1.2-6.8 3-9.4Z" fill="currentColor" />
      <circle cx="12" cy="14.5" r="1.6" fill="#080b16" />
      <circle cx="20" cy="14.5" r="1.6" fill="#080b16" />
    </svg>
  );
}

function WhatsAppMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 3.5a12.3 12.3 0 0 0-10.5 18.7L4 28l6-1.6A12.3 12.3 0 1 0 16 3.5Z" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinejoin="round" />
      <path d="M11.2 9.5c-.5 0-1 .2-1.3.7-.5.6-1.1 1.5-1.1 3 0 1.7 1.2 3.4 1.4 3.6.2.3 2.4 3.8 5.8 5.2 2.8 1.2 3.4 1 4 .9.6-.1 1.9-.8 2.2-1.6.3-.8.3-1.4.2-1.6-.1-.2-.4-.3-.9-.6l-2.1-1c-.4-.2-.7-.3-1 .2-.3.5-1.1 1.3-1.3 1.6-.2.3-.5.3-.9.1-.4-.2-1.7-.6-3.2-2-1.2-1.1-2-2.4-2.2-2.8-.2-.4 0-.6.2-.8l.7-.8c.2-.3.3-.5.4-.8.1-.3 0-.6 0-.8l-1-2.3c-.3-.7-.6-.7-.9-.7Z" fill="currentColor" />
    </svg>
  );
}

export default function SiteFooter() {
  const pathname = usePathname();
  const [ownerHost, setOwnerHost] = useState(false);

  useEffect(() => {
    setOwnerHost(window.location.hostname.toLowerCase() === "auyaxyz.sirenofficial.my.id");
  }, []);

  if (ownerHost || pathname.startsWith("/admin")) return null;

  return (
    <footer className="site-footer">
      <div className="site-footer-grid">
        <section className="footer-brand-column">
          <a href="/" className="footer-brand" aria-label="JOKI ROBLOX — Beranda">
            <img src="/brand/logosk.webp" alt="Logo Siren Store" width={88} height={88} />
            <strong>SIREN OFFICIAL | JOKI ROBLOX</strong>
          </a>
          <p>
            Perusahaan yang bergerak di bidang pelayanan top-up dan upgrade level,
            joki dalam berbagai game mobile terpercaya, amanah, cepat, dan tentu
            aman 100% ⭐⭐⭐⭐⭐
          </p>
        </section>

        <nav className="footer-column" aria-label="Peta situs">
          <h2>PETA SITUS</h2>
          <a href="/"><span aria-hidden="true">⌂</span> Beranda</a>
          <a href="/products"><span aria-hidden="true">▣</span> Semua produk</a>
          <a href="/keranjang"><span aria-hidden="true">🛒</span> Keranjang</a>
          <a href="/testimoni"><span aria-hidden="true">★</span> Testimoni</a>
          <a href="/contact"><span aria-hidden="true">✉</span> Kontak kami</a>
        </nav>

        <nav className="footer-column" aria-label="Kanal resmi">
          <h2>IKUTI KAMI</h2>
          <a href={whatsappUrl} target="_blank" rel="noreferrer">
            <span className="footer-social-icon whatsapp-icon"><WhatsAppMark /></span> WhatsApp
          </a>
          <a href="https://www.instagram.com/sirenstoreee/" target="_blank" rel="noreferrer">
            <span className="footer-social-icon"><img src="/brand/instagram.webp" alt="" width={24} height={24} /></span> Instagram
          </a>
          <a href="https://discord.gg/UPh8cEdgsa" target="_blank" rel="noreferrer">
            <span className="footer-social-icon discord-icon"><DiscordMark /></span> Discord
          </a>
          <a href="https://www.itemku.com/id/t/siren-store" target="_blank" rel="noreferrer">
            <span className="footer-social-icon"><img src="/brand/itemku.webp" alt="" width={24} height={24} /></span> Toko Itemku
          </a>
        </nav>

        <nav className="footer-column" aria-label="Informasi dan kebijakan">
          <h2>INFORMASI</h2>
          <a href="/kebijakan-privasi"><span aria-hidden="true">◆</span> Kebijakan Privasi</a>
          <a href="/testimoni"><span aria-hidden="true">▤</span> Bukti &amp; Testimoni</a>
          <p className="footer-domain">www.sirenofficial.my.id</p>
        </nav>
      </div>
      <div className="site-footer-bottom">© {new Date().getFullYear()} SIREN OFFICIAL | JOKI ROBLOX</div>
    </footer>
  );
}
