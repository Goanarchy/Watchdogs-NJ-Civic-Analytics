import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

/**
 * Compila la app completa en un único archivo HTML autocontenido.
 * El resultado se publica como `index.html` en la raíz del proyecto,
 * de modo que la app se abre con doble clic, sin servidor local.
 */
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "standalone",
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 4000,
    reportCompressedSize: false,
    rollupOptions: {
      input: "dev.html",
    },
  },
});
