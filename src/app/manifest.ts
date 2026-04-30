import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VocabCrafter 2.0",
    short_name: "VocabCrafter",
    description: "AI-powered vocabulary quiz platform",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f5f0e8",
    theme_color: "#15803d",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
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
