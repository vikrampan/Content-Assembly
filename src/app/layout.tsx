import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { NetworkBanner } from "@/components/ui/Network";

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
      <body>
        <ToastProvider>
          <NetworkBanner />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
