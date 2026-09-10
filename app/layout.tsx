import type { Metadata } from "next";
import Script from "next/script";
import { GameProvider } from "@/components/game-provider";
import { SettingsProvider } from "@/components/settings-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mini Mystics",
  description: "Build a Mystic lineup, battle rival Handlers, and grow your collection.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body suppressHydrationWarning>
    <GameProvider><SettingsProvider>{children}</SettingsProvider></GameProvider>
    <Script src="https://www.googletagmanager.com/gtag/js?id=G-H7XZ64CTJT" strategy="afterInteractive" />
    <Script id="google-analytics" strategy="afterInteractive">{`
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-H7XZ64CTJT');
    `}</Script>
  </body></html>;
}
