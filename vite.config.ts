import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: "client",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
    hmr: {
      overlay: true,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@components": path.resolve(__dirname, "./client/src/components"),
      "@city": path.resolve(__dirname, "./client/src/components/city"),
      "@game": path.resolve(__dirname, "./client/src/game"),
      "@world": path.resolve(__dirname, "./client/src/world"),
      "@server": path.resolve(__dirname, "./client/src/server"),
      "@intellectus": path.resolve(__dirname, "./client/src/intellectus"),
      "@admin": path.resolve(__dirname, "./client/src/admin"),
      "@store": path.resolve(__dirname, "./client/src/store"),
      "@types": path.resolve(__dirname, "./client/src/types"),
      "@utils": path.resolve(__dirname, "./client/src/utils"),
      "@lib": path.resolve(__dirname, "./client/src/lib"),
    },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three') || id.includes('@react-three')) {
              return 'vendor-three';
            }
            if (id.includes('colyseus')) {
              return 'vendor-colyseus';
            }
            return 'vendor';
          }
        },
      },
    },
  },
});