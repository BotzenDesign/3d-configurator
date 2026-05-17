import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Explicitly load .env variables into process.env for Node.js server
Object.assign(process.env, loadEnv("development", process.cwd(), ""));

// @ts-check
/** @type {import('@remix-run/dev').AppConfig} */
export default defineConfig({
  plugins: [
    remix({
      ignoredRouteFiles: ["**/.*"],
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
      },
    }),
    tsconfigPaths(),
  ],
  server: {
    port: 3000,
    host: true,
    allowedHosts: [
      ".ngrok-free.dev",
      ".ngrok-free.app",
      ".ngrok.io",
      ".ngrok.app"
    ]
  },
  build: {
    assetsInlineLimit: 0,
  },
});
