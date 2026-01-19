const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const INPUT_DIR = path.join(__dirname, '..', 'assets', 'portfolio');
const OUTPUT_DIR = path.join(__dirname, '..', 'dist', 'images', 'portfolio');

// Quality settings
const WEBP_QUALITY = 80;
const JPEG_QUALITY = 85;
const MAX_WIDTH = 1200;
const THUMB_WIDTH = 20;

async function optimizeImages() {
  console.log('Optimizing images...');
  
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Get all image files
  const files = fs.readdirSync(INPUT_DIR).filter(f => 
    /\.(jpg|jpeg|png)$/i.test(f) && !f.startsWith('.')
  );
  
  let totalSaved = 0;
  
  for (const file of files) {
    const inputPath = path.join(INPUT_DIR, file);
    const baseName = path.parse(file).name;
    const originalSize = fs.statSync(inputPath).size;
    
    try {
      const image = sharp(inputPath);
      const metadata = await image.metadata();
      
      // Resize if larger than MAX_WIDTH
      const resizeOptions = metadata.width > MAX_WIDTH 
        ? { width: MAX_WIDTH, withoutEnlargement: true }
        : {};
      
      // WebP version
      const webpPath = path.join(OUTPUT_DIR, `${baseName}.webp`);
      await image
        .clone()
        .resize(resizeOptions)
        .webp({ quality: WEBP_QUALITY })
        .toFile(webpPath);
      
      // JPEG fallback
      const jpegPath = path.join(OUTPUT_DIR, `${baseName}.jpg`);
      await image
        .clone()
        .resize(resizeOptions)
        .jpeg({ quality: JPEG_QUALITY, progressive: true })
        .toFile(jpegPath);
      
      // Blur thumbnail for lazy loading
      const thumbPath = path.join(OUTPUT_DIR, `${baseName}-thumb.webp`);
      await image
        .clone()
        .resize({ width: THUMB_WIDTH })
        .blur(1)
        .webp({ quality: 60 })
        .toFile(thumbPath);
      
      const webpSize = fs.statSync(webpPath).size;
      const saved = originalSize - webpSize;
      totalSaved += saved;
      
      console.log(`  ✓ ${file}`);
      console.log(`    Original: ${(originalSize / 1024).toFixed(0)}KB`);
      console.log(`    WebP: ${(webpSize / 1024).toFixed(0)}KB (-${Math.round(saved / originalSize * 100)}%)`);
      
    } catch (err) {
      console.error(`  ✗ ${file}: ${err.message}`);
    }
  }
  
  console.log(`\nTotal saved: ${(totalSaved / 1024 / 1024).toFixed(2)}MB`);
  console.log('Image optimization complete!');
}

optimizeImages().catch(console.error);
