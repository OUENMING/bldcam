import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
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
  title: {
    default: "BLDcam — 摄影作品集",
    template: "%s · BLDcam",
  },
  description:
    "菠萝丁的个人星空摄影与旅行摄影作品集。收录都柏林、广州等城市风光、自然景色、街头纪实的精选照片，由 AI 自动分类整理。",
  keywords: ["摄影", "星空摄影", "旅行摄影", "作品集", "都柏林", "广州", "风光摄影"],
  openGraph: {
    title: "BLDcam — 摄影作品集",
    description: "星空与旅行摄影作品 · 由 AI 自动分类整理",
    url: "https://bldcam.page",
    siteName: "BLDcam",
    locale: "zh_CN",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  verification: {
    other: {
      "baidu-site-verification": ["codeva-m22jiAvU7p"],
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
