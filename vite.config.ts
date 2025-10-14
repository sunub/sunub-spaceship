import path from "path";
import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

// https://vite.dev/config/
export default defineConfig({
  plugins: [visualizer()],
  base: "/",
  assetsInclude: ["**/*.glb", "**/*.hdr", "**/*.gltf", "**/*.bin"],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  publicDir: "public",
  build: {
    minify: "esbuild",
    assetsDir: "assets",
    modulePreload: {
      polyfill: true,
    },
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
      output: {
        experimentalMinChunkSize: 30000,
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          const fileName = assetInfo.name ?? "unknown";
          const extType = fileName.split(".").pop()?.toLowerCase() ?? "";

          if (/glb|hdr|gltf|bin/i.test(extType)) {
            return `assets/models/[name]-[hash][extname]`;
          }

          return `assets/[name]-[hash][extname]`;
        },
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@react-three")) {
              return "vendor-react-three";
            } else if (id.includes("three")) {
              return "vendor-three";
            } else if (id.includes("@dimforge/rapier3d")) {
              return "vendor-rapier3d";
            }
            return "vendor";
          }
        },
      },
    },
  },
});
