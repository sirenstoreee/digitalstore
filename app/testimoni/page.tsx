import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bukti & Testimoni Pelanggan",
  description: "Informasi kanal resmi untuk melihat pengalaman pelanggan Siren Official.",
  alternates: { canonical: "/testimoni" },
};

const channels = [
  { label: "Instagram Siren Store", href: "https://www.instagram.com/sirenstoreee/" },
  { label: "Discord Siren Store", href: "https://discord.gg/UPh8cEdgsa" },
  { label: "Toko Siren Store di Itemku", href: "https://www.itemku.com/id/t/siren-store" },
];

export default function TestimonialsPage() {
  return (
    <main className="testimonials-page">
      <header className="testimonials-heading">
        <p className="eyebrow">PENGALAMAN PELANGGAN</p>
        <h1>Bukti &amp; Testimoni Pelanggan</h1>
        <p>Kepercayaan dibangun dari layanan yang jelas dan ulasan pelanggan yang nyata.</p>
      </header>
      <section className="testimonial-empty" aria-labelledby="reviews-title">
        <div className="testimonials-empty-icon" aria-hidden="true">★</div>
        <h2 id="reviews-title">Ulasan pelanggan</h2>
        <p>
          Testimoni dan bukti transaksi belum ditampilkan di halaman ini. Kami hanya
          akan memuat ulasan yang benar-benar diterima dan boleh dipublikasikan oleh
          pelanggan.
        </p>
        <p>Silakan kunjungi kanal resmi kami untuk informasi dan aktivitas terbaru:</p>
        <div className="testimonial-links">
          {channels.map((channel) => (
            <a key={channel.href} href={channel.href} target="_blank" rel="noreferrer">
              {channel.label} ↗
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
