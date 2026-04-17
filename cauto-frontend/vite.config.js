import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  base: (() => { const p = process.env.BASE_PATH || "/"; return p.startsWith("/") ? p : "/" + p; })(),
  build: {
    target: "esnext",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("leaflet")) return "vendor-leaflet";
          if (id.includes("konva") || id.includes("react-konva")) return "vendor-konva";
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          if (id.includes("jspdf") || id.includes("html2canvas")) return "vendor-export";
          if (id.includes("@azure/msal")) return "vendor-msal";
        },
      },
    },
  },
});
