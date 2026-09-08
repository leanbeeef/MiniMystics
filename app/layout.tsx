import type { Metadata } from "next";
import { GameProvider } from "@/components/game-provider";
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
  return <html lang="en"><body suppressHydrationWarning><GameProvider>{children}</GameProvider></body></html>;
}
