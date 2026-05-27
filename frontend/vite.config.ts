import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    compress: false,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        timeout: 0,
        proxyTimeout: 0,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            if (req.url?.includes("stream")) {
              proxyReq.setHeader("Accept", "text/event-stream");
              proxyReq.setHeader("Cache-Control", "no-cache");
            }
          });
          proxy.on("proxyRes", (proxyRes, req) => {
            if (req.url?.includes("stream")) {
              proxyRes.headers["cache-control"] = "no-cache, no-transform";
              proxyRes.headers["x-accel-buffering"] = "no";
              delete proxyRes.headers["content-length"];
            }
          });
        },
      },
      "/health": "http://localhost:3001",
    },
  },
});
