import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css"; // Hapus huruf 's' jika nama file aslinya global.css

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "TentorSebaya — Tanya, langsung nyambung ke tentor sebaya",
  description:
    "Ajukan pertanyaan pelajaran, dicocokkan otomatis dengan tentor sesama pelajar SMA yang sedang online — buat cari teman belajar.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen bg-ink-50 font-sans text-ink-900 antialiased">
        {children}
      </body>
    </html>
  );
}
