import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "IZA 書類管理",
    short_name: "IZA書類",
    description: "IZA株式会社 領収書・請求書・見積書管理システム",
    start_url: "/documents",
    display: "standalone",
    background_color: "#f5f5f5",
    theme_color: "#1e3a8a",
    orientation: "portrait",
    lang: "ja",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
