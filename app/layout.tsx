import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tehran Real Estate Price Predictor | AI-Powered Property Valuation",
  description:
    "Instantly predict Tehran property prices using advanced machine learning, live economic data, and spatial analysis. Drop a pin, enter details, get your estimate.",
  keywords: [
    "Tehran real estate",
    "Iran property price",
    "house price prediction",
    "ML real estate",
    "Tehran property valuation",
  ],
  openGraph: {
    title: "Tehran Real Estate Price Predictor",
    description:
      "AI-powered property valuation for Tehran using spatial ML and live economic data.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="antialiased">
        {/* Ambient background blobs */}
        <div
          className="ambient-blob"
          style={{
            width: "600px",
            height: "600px",
            background: "rgba(249, 115, 22, 0.06)",
            top: "-200px",
            right: "-150px",
          }}
        />
        <div
          className="ambient-blob"
          style={{
            width: "500px",
            height: "500px",
            background: "rgba(45, 212, 191, 0.04)",
            bottom: "-100px",
            left: "-150px",
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
