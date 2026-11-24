import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { ThemeProvider } from "@/components/theme-provider";
import { ColorThemeProvider } from "@/components/providers/color-theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
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

const COLOR_THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("vocab-crafter:color-theme");if(t&&t!=="forest"){document.documentElement.dataset.colorTheme=t;}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: COLOR_THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} antialiased`}
      >
        <NextTopLoader
          color="var(--primary)"
          showSpinner={false}
          height={3}
        />
        <ThemeProvider>
          <ColorThemeProvider>{children}</ColorThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
