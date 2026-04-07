import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: (() => { const p = process.env.BASE_PATH || "/"; return p.startsWith("/") ? p : "/" + p; })(),
  build: {
    target: "esnext",
  },
});
