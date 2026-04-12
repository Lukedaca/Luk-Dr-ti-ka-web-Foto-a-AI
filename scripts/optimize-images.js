const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputDir = path.join(__dirname, '..', 'assets', 'portfolio');
const outputDir = path.join(__dirname, '..', 'dist', 'images', 'portfolio');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const MAX_WIDTH = 1100;
const JPEG_QUALITY = 82;
const WEBP_QUALITY = 72;
const AVIF_QUALITY = 50;
const BLUR_SIZE = 20;

async function optimizeImages() {
  // Check if input directory exists
  if (!fs.existsSync(inputDir)) {
    console.log('No portfolio images directory found, skipping optimization...');
    return;
  }

  const files = fs.readdirSync(inputDir).filter(file =>
    /\.(jpg|jpeg|png|webp)$/i.test(file)
  );

  if (files.length === 0) {
    console.log('No images found to optimize.');
    return;
  }

  console.log(`Optimizing ${files.length} images...\n`);

  let totalOriginal = 0;
  let totalOptimized = 0;

  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const baseName = path.parse(file).name;

    const originalSize = fs.statSync(inputPath).size;
    totalOriginal += originalSize;

    try {
      const image = sharp(inputPath);
      const metadata = await image.metadata();

      // Resize if wider than MAX_WIDTH
      const resizeOptions = metadata.width > MAX_WIDTH ? { width: MAX_WIDTH } : {};

      // Create AVIF version
      const avifPath = path.join(outputDir, `${baseName}.avif`);
      await image
        .clone()
        .resize(resizeOptions)
        .avif({ quality: AVIF_QUALITY, effort: 7 })
        .toFile(avifPath);

      const avifSize = fs.statSync(avifPath).size;
      totalOptimized += avifSize;

      // Create WebP version
      const webpPath = path.join(outputDir, `${baseName}.webp`);
      await image
        .clone()
        .resize(resizeOptions)
        .webp({ quality: WEBP_QUALITY, effort: 6 })
        .toFile(webpPath);

      // Create JPEG fallback
      const jpegPath = path.join(outputDir, `${baseName}.jpg`);
      await image
        .clone()
        .resize(resizeOptions)
        .jpeg({ quality: JPEG_QUALITY, progressive: true, mozjpeg: true })
        .toFile(jpegPath);

      const webpSize = fs.statSync(webpPath).size;

      // Create blur placeholder (tiny image for lazy loading)
      const blurPath = path.join(outputDir, `${baseName}-blur.jpg`);
      await image
        .clone()
        .resize({ width: BLUR_SIZE })
        .blur(5)
        .jpeg({ quality: 30 })
        .toFile(blurPath);

      const savings = ((1 - webpSize / originalSize) * 100).toFixed(1);
      console.log(`✓ ${file} → WebP (${savings}% smaller)`);

    } catch (error) {
      console.error(`Error optimizing ${file}:`, error.message);
    }
  }

  const totalSavings = ((1 - totalOptimized / totalOriginal) * 100).toFixed(1);
  console.log(`\nTotal: ${(totalOriginal / 1024 / 1024).toFixed(2)} MB → ${(totalOptimized / 1024 / 1024).toFixed(2)} MB (${totalSavings}% savings)`);
}

optimizeImages().catch(console.error);
