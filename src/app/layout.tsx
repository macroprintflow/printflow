import type { Metadata } from "next";
import "./globals.css";

import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import { DisableNumberScroll } from "@/components/DisableNumberScroll";

/* ———————————————————————————————————————————————
   Route-segment metadata  (NO viewport here)
   ——————————————————————————————————————————————— */
export const metadata: Metadata = {
  title: "PrintFlow",
  description: "Offset Printing and Packaging Job Management",
};

/* ———————————————————————————————————————————————
   Stand-alone viewport export  ✅
   ——————————————————————————————————————————————— */
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,      // optional — remove if you don’t need it
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* preload fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap"
          rel="stylesheet"
        />
      </head>

      <body className="font-body antialiased text-foreground" suppressHydrationWarning>
        <AuthProvider>
          <DisableNumberScroll />
          {children}
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
