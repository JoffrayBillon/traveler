import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const sourceDirectory = fileURLToPath(new URL("./src/", import.meta.url));
const sourceAliases = [
  "components",
  "features",
  "hooks",
  "i18n",
  "lib",
  "routes",
  "test",
  "theme",
  "types",
];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: /^@traveler\/api\//,
        replacement: `${sourceDirectory}api/`,
      },
      ...sourceAliases.map((directory) => ({
        find: new RegExp(`^@traveler/${directory}/`),
        replacement: `${sourceDirectory}${directory}/`,
      })),
      {
        find: "@traveler/router",
        replacement: `${sourceDirectory}router.tsx`,
      },
      {
        find: "@traveler/i18n",
        replacement: `${sourceDirectory}i18n/index.ts`,
      },
    ],
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
