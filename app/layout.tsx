import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Experience } from "@/components/Experience";

const display = Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz", "wdth"], variable: "--f-display", display: "swap" });
const sans = Inter_Tight({ subsets: ["latin"], weight: ["300", "400", "500", "700"], variable: "--f-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--f-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Dizrupt — Solutions designed for what’s next",
  description: "Dizrupt is a solutions-led full stack digital marketing agency headquartered in Mumbai.",
};

export const viewport: Viewport = { themeColor: "#050507", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={[display, sans, mono].map((f) => f.variable).join(" ")}>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Experience>{children}</Experience>
      </body>
    </html>
  );
}
