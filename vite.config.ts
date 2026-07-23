import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Ensures the published build always contains the backend env vars.
// If any required var is missing during `vite build`, the build fails
// fast with a clear message instead of shipping a blank app.
function requireBackendEnv(mode: string): Plugin {
  const REQUIRED = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"];
  return {
    name: "require-backend-env",
    apply: "build",
    configResolved() {
      const env = loadEnv(mode, process.cwd(), "");
      const missing = REQUIRED.filter(
        (k) => !env[k] && !process.env[k]
      );
      if (missing.length > 0) {
        throw new Error(
          `[build aborted] Missing required backend env var(s): ${missing.join(
            ", "
          )}. The app cannot be published without them — reconnect Lovable Cloud / restore the .env before republishing.`
        );
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    requireBackendEnv(mode),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
