import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/classify": "http://127.0.0.1:5000",
      "/tts":      "http://127.0.0.1:5000",
      "/health":   "http://127.0.0.1:5000",
      "/classes":  "http://127.0.0.1:5000"
    },
  },
});
