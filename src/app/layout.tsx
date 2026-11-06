import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "T23 Reservation Hub", template: "%s · T23 Reservation Hub" },
  description: "Reservation & booking management for Turtle23 restaurant group",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#2f7d4f" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
