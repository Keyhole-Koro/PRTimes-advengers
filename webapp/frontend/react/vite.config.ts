import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      "@tiptap/react",
      "@tiptap/extension-document",
      "@tiptap/extension-heading",
      "@tiptap/extension-paragraph",
      "@tiptap/extension-text",
      "@tiptap/extension-bullet-list",
      "@tiptap/extension-ordered-list",
      "@tiptap/extension-list-item",
      "@tiptap/extension-image",
    ],
  },
});
