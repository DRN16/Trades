import type { Metadata, Viewport } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Trading Screener & Journal",
  description: "Reversal screener + trade journal for SOL/BNB/HYPE futures",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0b0f14",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <NavBar />
          <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
