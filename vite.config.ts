import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Split vendor dependencies into separate cacheable chunks.
        // Keeps the main app bundle small and lets the browser cache
        // unchanged vendor code across deploys.
        manualChunks: (id) => {
          // React core — changes least often, cache longest
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "vendor-react";
          }
          // Radix UI component primitives
          if (id.includes("node_modules/@radix-ui")) {
            return "vendor-radix";
          }
          // Charting / visualisation — recharts + its d3 deps
          if (id.includes("node_modules/recharts") || id.includes("node_modules/d3-")) {
            return "vendor-charts";
          }
          // Animation
          if (id.includes("node_modules/motion") || id.includes("node_modules/framer-motion")) {
            return "vendor-motion";
          }
          // Remaining node_modules go in a shared vendor chunk
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },
  server: {
    // Vite dev server is now wired as Express middleware (see server.ts).
    // This port is only used when running `vite` standalone (rare).
    port: Number(process.env.PORT) || 5173,
    host: "0.0.0.0",
  },
  preview: {
    port: Number(process.env.PORT) || 5173,
    host: "0.0.0.0",
  },
});
