import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
// Edition CSS — résolu vers globals.css (CE) ou ../architecture-enterprise/styles/edition.css (EE)
// par l'alias `#edition-styles` configuré dans next.config.ts selon NEXT_PUBLIC_EDITION.
import "#edition-styles";
import { SwRegister } from "@/components/layout/SwRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ARCH.SIM — Architecture Simulator",
  description: "Testez votre architecture avant de la construire. Simulez la charge, visualisez les flux, identifiez les ruptures.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ARCH.SIM",
  },
};

export const viewport: Viewport = {
  themeColor: "#c8930a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning className="dark" id="html-root">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} antialiased`}
      >
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
