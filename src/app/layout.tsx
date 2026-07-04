import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Outfit, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/context/theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh"
      className={`${instrumentSerif.variable} ${outfit.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("bldcam-theme")||"dark";if(t==="dark")document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full bg-background text-foreground flex flex-col">
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
