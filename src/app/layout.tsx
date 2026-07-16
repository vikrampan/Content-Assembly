import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Content Assembly Line",
  description:
    "Automated assembly line for social media content — the 4-Layer SOP, digitized.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
