import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Screenshot to Text - OCR Tool | Extract Text from Images",
  description: "Extract text from images using AI-powered OCR. Upload screenshots and images to get instant text extraction with high accuracy.",
  keywords: ["OCR", "text extraction", "image to text", "screenshot OCR", "AI OCR", "image recognition"],
  authors: [{ name: "Screenshot to Text" }],
  openGraph: {
    title: "Screenshot to Text - OCR Tool",
    description: "Extract text from images using AI-powered OCR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
