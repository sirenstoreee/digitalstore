export default function ContactPage() {
  const whatsappMessage = encodeURIComponent(
    "Halo SIREN OFFICIAL, saya ingin bertanya tentang produk."
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#090b10",
        color: "#f5f7fb",
        fontFamily: "Arial, sans-serif",
        padding: "48px 7%",
      }}
    >
      <section
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: 28,
          background: "#13151e",
          border: "1px solid #252835",
          borderRadius: 16,
        }}
      >
        <p style={{ color: "#b9a6ff", letterSpacing: 2 }}>BANTUAN</p>
        <h1>Hubungi Kami</h1>
        <p style={{ color: "#a7a9b5", lineHeight: 1.7 }}>
          Ada pertanyaan tentang produk atau pesanan? Hubungi SIREN OFFICIAL melalui:
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
          <a
            href={`https://wa.me/6285176710079?text=${whatsappMessage}`}
            target="_blank"
            rel="noreferrer"
            style={{
              background: "#252835",
              color: "#f5f7fb",
              padding: "12px 18px",
              borderRadius: 9,
              textDecoration: "none",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <svg
              role="img"
              aria-label="WhatsApp"
              width="24"
              height="24"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M16 3.5a12.3 12.3 0 0 0-10.5 18.7L4 28l6-1.6A12.3 12.3 0 1 0 16 3.5Z"
                stroke="#25D366"
                strokeWidth="2.3"
                strokeLinejoin="round"
              />
              <path
                d="M11.2 9.5c-.5 0-1 .2-1.3.7-.5.6-1.1 1.5-1.1 3 0 1.7 1.2 3.4 1.4 3.6.2.3 2.4 3.8 5.8 5.2 2.8 1.2 3.4 1 4 .9.6-.1 1.9-.8 2.2-1.6.3-.8.3-1.4.2-1.6-.1-.2-.4-.3-.9-.6l-2.1-1c-.4-.2-.7-.3-1 .2-.3.5-1.1 1.3-1.3 1.6-.2.3-.5.3-.9.1-.4-.2-1.7-.6-3.2-2-1.2-1.1-2-2.4-2.2-2.8-.2-.4 0-.6.2-.8l.7-.8c.2-.3.3-.5.4-.8.1-.3 0-.6 0-.8l-1-2.3c-.3-.7-.6-.7-.9-.7Z"
                fill="#25D366"
              />
            </svg>
            WhatsApp
          </a>

          <a
            href="https://discord.gg/t3baYHhFUa"
            target="_blank"
            rel="noreferrer"
            style={{
              background: "#252835",
              color: "#f5f7fb",
              padding: "12px 18px",
              borderRadius: 9,
              textDecoration: "none",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <svg
              role="img"
              aria-label="Discord"
              width="24"
              height="24"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 8.2c2.4-1.2 4.8-1.7 8-1.7s5.6.5 8 1.7c1.8 2.6 2.8 5.7 3 9.4-2.1 2.4-4.2 3.7-6.3 4.3l-1.3-2.1c.9-.3 1.8-.8 2.6-1.4-4 1.9-9.3 1.9-13.3 0 .8.6 1.7 1.1 2.6 1.4L10 21.9c-2.1-.6-4.2-1.9-6.3-4.3.2-3.7 1.2-6.8 3-9.4Z"
                fill="#5865F2"
              />
              <circle cx="12" cy="14.5" r="1.6" fill="#090b10" />
              <circle cx="20" cy="14.5" r="1.6" fill="#090b10" />
              <path
                d="M12.5 18c2.3 1.2 4.7 1.2 7 0"
                stroke="#090b10"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Discord
          </a>
        </div>
      </section>
    </main>
  );
}