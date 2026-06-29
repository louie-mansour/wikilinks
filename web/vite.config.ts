import { defineConfig, type Plugin, type ResolvedConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

function inlineCssPlugin(): Plugin {
  let resolvedConfig: ResolvedConfig;
  return {
    name: 'inline-css',
    apply: 'build',
    configResolved(config) {
      resolvedConfig = config;
    },
    closeBundle() {
      const outDir = path.resolve(resolvedConfig.root, resolvedConfig.build.outDir);
      const htmlPath = path.join(outDir, 'index.html');
      let html = fs.readFileSync(htmlPath, 'utf-8');

      const cssMatch = html.match(/<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/);
      if (!cssMatch) return;

      const cssFile = cssMatch[1].replace(/^\//, '');
      const css = fs.readFileSync(path.join(outDir, cssFile), 'utf-8');

      html = html.replace(cssMatch[0], `<style>${css}</style>`);
      fs.writeFileSync(htmlPath, html);
    },
  };
}

export default defineConfig({
  plugins: [react(), inlineCssPlugin()],
  build: {
    target: 'esnext',
  },
});
