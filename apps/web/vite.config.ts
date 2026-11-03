import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { appAliases } from "./vite.aliases";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: appAliases,
  },
  build: {
    rolldownOptions: {
      output: {
        strictExecutionOrder: true,
        codeSplitting: {
          groups: [
            {
              name: "react-aria",
              test: /node_modules[\\/](react-aria-components|@react-aria|@react-stately|@react-types|@internationalized)[\\/]/,
              priority: 20,
              maxSize: 440_000,
            },
            {
              name: "vendor",
              test: /node_modules[\\/]/,
              priority: 10,
              minSize: 100_000,
              maxSize: 440_000,
            },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:3001" },
  },
});
