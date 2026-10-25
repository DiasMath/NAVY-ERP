import type { Metadata } from "next";
import "./globals.css";
import "./stitch-shell.css";
import "@/features/clients/clients.css";
import "@/features/services/services.css";
import "@/features/auth/login.css";
import { AuthProvider } from "@/features/auth/AuthProvider";

export const metadata: Metadata = {
  title: "NAVY | Gestão de estética",
  description: "Prévia de interface da NAVY",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" /></head><body><AuthProvider>{children}</AuthProvider></body></html>;
}
