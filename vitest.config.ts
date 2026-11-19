import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // .test.tsx files (component tests) opt into jsdom via a
    // `// @vitest-environment jsdom` docblock; everything else (.test.ts)
    // stays on the faster node environment.
    // The guard scripts are plain .mjs outside src, but they carry logic like
    // anything else and nothing else exercises them.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.mjs"],
  },
});
