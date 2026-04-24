import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baseUrlRaw =
  process.env.NEXT_PUBLIC_CONSTRUNEVES_URL?.trim() || "http://localhost:3000";
const baseUrl = baseUrlRaw.replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  applicationName: "Painel Construneves",
  title: "Painel — Construneves",
  description: "Indicadores e finanças — Construneves",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/icons/icon-192.png",
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    title: "Painel — Construneves",
    description: "Indicadores e finanças — Construneves",
    url: baseUrl,
    siteName: "Construneves",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "Construneves" }],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Painel — Construneves",
    description: "Indicadores e finanças — Construneves",
    images: [`${baseUrl}/icons/icon-512.png`],
  },
  appleWebApp: {
    capable: true,
    title: "Construneves",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full`}
    >
      <body className="min-h-screen min-h-dvh antialiased bg-black text-zinc-100">
        {children}
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
