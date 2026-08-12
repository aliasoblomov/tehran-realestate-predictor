import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ajor AI | ارزیاب هوشمند ملک تهران",
  description:
    "قیمت ملک در تهران را با استفاده از یادگیری ماشین، داده‌های اقتصادی زنده و تحلیل مکانی پیش‌بینی کنید. روی نقشه کلیک کنید و ارزیابی دریافت کنید.",
  keywords: [
    "قیمت ملک تهران",
    "خرید آپارتمان تهران",
    "ارزیابی هوشمند مسکن",
    "Tehran real estate price prediction",
    "ML property valuation",
  ],
  openGraph: {
    title: "Ajor AI | ارزیاب هوشمند ملک تهران",
    description:
      "ارزیابی هوشمند ملک در تهران با مدل XGBoost و داده‌های مکانی BigQuery.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {/* Ambient background blobs */}
        <div
          className="ambient-blob"
          style={{
            width: "700px",
            height: "700px",
            background: "rgba(249, 115, 22, 0.055)",
            top: "-250px",
            left: "-150px",
          }}
        />
        <div
          className="ambient-blob"
          style={{
            width: "500px",
            height: "500px",
            background: "rgba(45, 212, 191, 0.035)",
            bottom: "-100px",
            right: "-150px",
          }}
        />
        <div className="noise-overlay" />

        {/* Main content */}
        <div style={{ position: "relative", zIndex: 1 }}>
          {children}
        </div>
      </body>
    </html>
  );
}
