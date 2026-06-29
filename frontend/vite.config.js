
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api/ws": {
        target: "ws://localhost:8000",
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/api": {
        target: "http://localhost:8000",
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
