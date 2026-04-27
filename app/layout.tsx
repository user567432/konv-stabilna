import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dušan Stil — Dashboard",
  description: "Dnevno praćenje prodaje i konverzije.",
  manifest: "/manifest.json",
  themeColor: "#9C7F4F",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DS Dashboard",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sr" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-ink-900">
        {children}
      </body>
    </html>
  );
}
