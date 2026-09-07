import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));
const requiredPublicEnv = [
  "VITE_CLERK_PUBLISHABLE_KEY",
  "VITE_CONVEX_URL",
  "VITE_SITE_URL",
] as const;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "");
  const missingEnv = requiredPublicEnv.filter((name) => !env[name]?.trim());

  if (missingEnv.length > 0) {
    throw new Error(`Missing required public environment variables: ${missingEnv.join(", ")}`);
  }

  return {
    server: {
      port: 3001,
    },
    resolve: {
      alias: {
        "@": root,
      },
    },
    plugins: [
      cloudflare({
        inspectorPort: false,
        viteEnvironment: { name: "ssr" },
      }),
      tanstackStart({
        srcDirectory: "src",
        router: {
          autoCodeSplitting: true,
        },
      }),
      react(),
    ],
  };
});
