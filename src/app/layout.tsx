import type { Metadata } from "next";
import { fraunces, inter, jetbrainsMono } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Black Circle OS",
  description: "Centre de contrôle Black Circle",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="bc-app min-h-full">{children}</body>
    </html>
  );
}
