import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Destiny — Your SEO growth companion",
  description: "Turn SEO into one clear, compounding weekly habit.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
