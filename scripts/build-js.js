const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'js');
const distDir = path.join(__dirname, '..', 'dist', 'js');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const modules = ['early', 'boot', 'core', 'i18n', 'turnstile', 'chatbot', 'voice', 'voice-latency-patch', 'portfolio', 'contact', 'stage', 'cinematic'];

async function build() {
  console.log('Building JavaScript modules...\n');

  for (const module of modules) {
    const entryPoint = path.join(srcDir, `${module}.js`);
    const outFile = path.join(distDir, `${module}.min.js`);

    if (!fs.existsSync(entryPoint)) {
      console.warn(`Warning: ${entryPoint} not found, skipping...`);
      continue;
    }

    try {
      const result = await esbuild.build({
        entryPoints: [entryPoint],
        outfile: outFile,
        bundle: true,
        minify: true,
        sourcemap: false,
        target: ['es2020'],
        format: 'iife',
        metafile: true
      });

      const bytes = fs.statSync(outFile).size;
      const kb = (bytes / 1024).toFixed(2);
      console.log(`✓ ${module}.min.js - ${kb} KB`);
    } catch (error) {
      console.error(`Error building ${module}:`, error);
      process.exit(1);
    }
  }

  console.log('\nJavaScript build complete!');
}

build();
