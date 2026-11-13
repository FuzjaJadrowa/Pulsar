import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cpSync } from "node:fs";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [
    react(),
    {
      name: "copy-static-assets",
      closeBundle() {
        cpSync("assets", "dist/assets", { recursive: true });
      },
    },
  ],
  publicDir: false,
  assetsInlineLimit: 0,
    clearScreen: false,
    server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
        ignored: ["**/src-tauri/**"],
    },
  },
}));