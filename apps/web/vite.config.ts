import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api(?=\/|$)/, ""),
      },
      "/ws": { target: "ws://127.0.0.1:3000", ws: true, changeOrigin: true },
    },
  },
  test: { environment: "jsdom", setupFiles: "./src/test/setup.ts" },
});