import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "NAVY Clinical ERP",
    short_name: "NAVY",
    description: "Gestão e atendimento da NAVY Matriz.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#eff4fb",
    theme_color: "#173b52",
    icons: [
      { src: "/icons/navy-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/navy-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/navy-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
