import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LinguaRead · AI 英语精读",
  description:
    "粘贴任意英文材料，AI 帮你翻译、提炼生词、生成阅读理解题，并提供逐词点击查词与朗读功能。",
  keywords: [
    "English learning",
    "英语学习",
    "reading",
    "vocabulary",
    "AI tutor",
  ],
  authors: [{ name: "LinguaRead" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "LinguaRead · AI 英语精读",
    description: "粘贴英文材料，AI 帮你翻译、提炼生词、出题。",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LinguaRead",
    description: "AI-powered English reading companion.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <SonnerToaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
