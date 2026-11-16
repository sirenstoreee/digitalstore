import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description: "Kebijakan privasi SIREN OFFICIAL | JOKI ROBLOX tentang penggunaan dan perlindungan data pelanggan.",
  alternates: { canonical: "/kebijakan-privasi" },
};

export default function PrivacyPolicyPage() {
  return (
    <main className="legal-page">
      <p className="eyebrow">INFORMASI TOKO</p>
      <h1>Kebijakan Privasi</h1>
      <p className="legal-updated">Terakhir diperbarui: 16 November 2026 · Siren Official | Joki Roblox Terpercaya</p>

      <article className="legal-card">
        <p>
          Kebijakan ini menjelaskan data yang diproses saat Anda menggunakan situs,
          membuat pesanan, atau menghubungi SIREN OFFICIAL | JOKI ROBLOX.
        </p>

        <h2>1. Data yang Kami Kumpulkan</h2>
        <p>
          Bergantung pada fitur yang Anda gunakan, data dapat mencakup alamat email,
          nama pengguna, nomor WhatsApp, nama atau ID akun game tujuan layanan,
          rincian produk, dan riwayat pesanan. Penyedia hosting dan keamanan situs
          juga dapat memproses data teknis seperti alamat IP, jenis peramban, serta
          waktu dan halaman yang diakses untuk menjalankan dan mengamankan layanan.
        </p>

        <h2>2. Cara Kami Menggunakan Data</h2>
        <ul>
          <li>Memproses pesanan dan menyampaikan layanan yang Anda pilih.</li>
          <li>Mengirim konfirmasi pesanan serta membantu pertanyaan pelanggan.</li>
          <li>Menjaga keamanan akun, pesanan, stok, dan operasional toko.</li>
          <li>Mengevaluasi layanan berdasarkan informasi operasional yang tersedia.</li>
        </ul>

        <h2>3. Cookie, Analitik, dan Pixel Iklan</h2>
        <p>
          Situs dapat menggunakan penyimpanan lokal atau cookie yang diperlukan untuk
          fitur akun dan sesi. Berdasarkan kode situs saat ini, Google Analytics,
          Meta/Facebook Pixel, dan TikTok Pixel belum dipasang. Karena itu, kami tidak
          mengklaim sedang mengirim data pembelian kepada platform iklan tersebut.
          Jika fitur analitik atau iklan ditambahkan, kebijakan ini akan diperbarui
          sebelum fitur tersebut digunakan.
        </p>

        <h2>4. Pembagian Data</h2>
        <p>
          Data hanya diteruskan sejauh diperlukan untuk menjalankan fitur yang Anda
          gunakan, misalnya kepada Firebase/Google untuk akun dan database, Vercel
          untuk hosting situs, Midtrans untuk pembayaran, serta Discord untuk
          notifikasi pesanan internal apabila webhook tersebut diaktifkan. Kami tidak
          menjual data pribadi pelanggan.
        </p>

        <h2>5. Penyimpanan dan Keamanan</h2>
        <p>
          Data disimpan selama diperlukan untuk mengelola pesanan, dukungan pelanggan,
          keamanan, dan pencatatan operasional. Akses ke data operasional dibatasi
          melalui sistem toko. Jangan kirim kata sandi akun game atau informasi rahasia
          yang tidak diperlukan untuk layanan.
        </p>

        <h2>6. Hak dan Permintaan Pelanggan</h2>
        <p>
          Anda dapat meminta akses, koreksi, atau penghapusan data pribadi yang terkait
          dengan akun atau pesanan Anda, sesuai ketentuan yang berlaku termasuk
          Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi. Hubungi
          kami melalui <a href="https://api.whatsapp.com/send/?phone=6285176710079&amp;text=Halo%2C%20saya%20ingin%20mengajukan%20permintaan%20terkait%20data%20pribadi.&amp;type=phone_number&amp;app_absent=0" target="_blank" rel="noreferrer">WhatsApp resmi</a> dan sertakan informasi yang cukup untuk menemukan pesanan Anda.
        </p>

        <h2>7. Perubahan Kebijakan</h2>
        <p>
          Kebijakan ini dapat diperbarui ketika fitur atau cara pemrosesan data berubah.
          Versi terbaru akan ditampilkan pada halaman ini beserta tanggal pembaruannya.
        </p>
      </article>
    </main>
  );
}
