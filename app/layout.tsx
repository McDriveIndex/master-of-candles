import type { Metadata } from "next";
import { Geist, Geist_Mono, Press_Start_2P } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const pixelFont = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
});

export const metadata: Metadata = {
  title: "Master of Candles",
  description: "Master of Candles",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    title: "Master of Candles",
    description: "How long can you survive the candles?",
    url: "https://masterofcandles.com",
    siteName: "Master of Candles",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Master of Candles",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Master of Candles",
    description: "How long can you survive the candles?",
    images: ["/og-image.png"],
  },
};

export const viewport = {
  themeColor: "#000000",
} as const;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${pixelFont.variable}`}>
        {children}
      </body>
    </html>
  );
}
