import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  // Allow importing APP_* env vars without needing VITE_ prefix.
  // This makes it easy to use APP_ENV and other runtime config values.
  envPrefix: ["VITE_", "APP_"],
  plugins: [react()],
});
