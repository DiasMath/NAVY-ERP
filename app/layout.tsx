import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./stitch-shell.css";
import "@/features/clients/clients.css";
import "@/features/services/services.css";
import "@/features/auth/login.css";
import { AuthProvider } from "@/features/auth/AuthProvider";

export const metadata: Metadata = {
  title: "NAVY | Gestão de estética",
  description: "Plataforma de gestão para clínicas de estética.",
  applicationName: "NAVY Clinical ERP",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/navy-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/navy-apple-180.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "NAVY", statusBarStyle: "default" },
  verification: { google: "EKqk0MHLqi-2C1Qm40QFy0R-M0paKIhDDVYNUIc-1rY" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#173b52" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" /></head><body><AuthProvider>{children}</AuthProvider></body></html>;
}
