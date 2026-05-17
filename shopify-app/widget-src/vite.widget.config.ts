import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        tailwindcss(path.resolve(__dirname, "./tailwind.config.js")),
        autoprefixer(),
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    "process.env": {},
  },
  build: {
    outDir: path.resolve(__dirname, "../extensions/3d-configurator/assets"),
    emptyOutDir: false, // Don't wipe the assets folder
    lib: {
      entry: path.resolve(__dirname, "widget-main.tsx"),
      name: "Polar3DWidget",
      formats: ["iife"],
      fileName: () => "configurator.js",
    },
    rollupOptions: {
      // Don't externalize react/react-dom since it's meant to run standalone in the storefront
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === "style.css") return "configurator.css";
          return assetInfo.name;
        },
      },
    },
  },
});
