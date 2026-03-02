import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "VPA - Virtual Stenographer & Personal Assistant",
  description: "Real-time transcription, speaker diarization, and AI-powered assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-ink-900 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
