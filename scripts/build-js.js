const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// Ensure dist directory exists
const distDir = path.join(__dirname, '..', 'dist', 'js');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const modules = [
  { entry: 'src/js/core.js', out: 'core.min.js' },
  { entry: 'src/js/chatbot.js', out: 'chatbot.min.js' },
  { entry: 'src/js/neural.js', out: 'neural.min.js' },
  { entry: 'src/js/portfolio.js', out: 'portfolio.min.js' },
  { entry: 'src/js/contact.js', out: 'contact.min.js' }
];

async function build() {
  console.log('Building JavaScript modules...');
  
  for (const mod of modules) {
    const entryPath = path.join(__dirname, '..', mod.entry);
    
    // Skip if source file doesn't exist yet
    if (!fs.existsSync(entryPath)) {
      console.log(`  Skipping ${mod.entry} (not found)`);
      continue;
    }
    
    try {
      await esbuild.build({
        entryPoints: [entryPath],
        bundle: true,
        minify: true,
        sourcemap: false,
        target: ['es2020'],
        outfile: path.join(distDir, mod.out),
        format: 'iife'
      });
      
      const stats = fs.statSync(path.join(distDir, mod.out));
      console.log(`  ✓ ${mod.out} (${(stats.size / 1024).toFixed(1)}KB)`);
    } catch (err) {
      console.error(`  ✗ ${mod.entry}: ${err.message}`);
    }
  }
  
  console.log('JavaScript build complete!');
}

build().catch(console.error);
