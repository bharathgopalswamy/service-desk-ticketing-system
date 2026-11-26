import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  test: {
    projects: [
      {
        extends: false,
        test: { name: "server", include: ["server/tests/**/*.test.js"], environment: "node" },
      },
      {
        extends: false,
        plugins: [react()],
        test: {
          name: "client",
          include: ["client/tests/**/*.test.jsx"],
          environment: "jsdom",
          setupFiles: ["client/tests/setup.js"],
        },
      },
    ],
  },
});
