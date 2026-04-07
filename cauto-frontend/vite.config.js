import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // BASE_PATH is set by GitHub Actions to match the repo name (e.g. /fleetcc/)
  base: process.env.BASE_PATH || "/",
});
