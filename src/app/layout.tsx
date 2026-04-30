import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import "@livekit/components-styles";
import "@livekit/components-styles/prefabs";
import { ThemeProvider } from "@/components/theme-provider";
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
  title: "VocabCrafter 2.0",
  description: "AI-powered vocabulary quiz platform",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#15803d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          async
          crossOrigin="anonymous"
          src="https://tweakcn.com/live-preview.min.js"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextTopLoader
          color="oklch(0.5234 0.1347 144.1672)"
          showSpinner={false}
          height={3}
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
