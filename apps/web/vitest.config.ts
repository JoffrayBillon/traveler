import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { appAliases } from "./vite.aliases.ts";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: appAliases,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    clearMocks: true,
    restoreMocks: true,
  },
});
