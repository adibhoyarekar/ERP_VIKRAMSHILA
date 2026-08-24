import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.resolve(__dirname, '../public');
const logoPath = path.resolve(publicDir, 'logo.png');

async function generateIcons() {
  console.log('Generating PWA icons from:', logoPath);

  if (!fs.existsSync(logoPath)) {
    throw new Error(`Source logo not found at ${logoPath}`);
  }

  const metadata = await sharp(logoPath).metadata();
  console.log(`Original logo size: ${metadata.width}x${metadata.height}`);

  // 1. Standard 192x192 (with subtle padding on white/transparent background)
  await sharp(logoPath)
    .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .extend({
      top: 6,
      bottom: 6,
      left: 6,
      right: 6,
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .toFile(path.resolve(publicDir, 'pwa-192x192.png'));

  // 2. Standard 512x512
  await sharp(logoPath)
    .resize(480, 480, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .extend({
      top: 16,
      bottom: 16,
      left: 16,
      right: 16,
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .toFile(path.resolve(publicDir, 'pwa-512x512.png'));

  // 3. Maskable 192x192 (W3C safe area: content occupies 75% center with #1e3a8a background and white container)
  const inner192 = await sharp(logoPath)
    .resize(130, 130, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 192,
      height: 192,
      channels: 4,
      background: { r: 30, g: 58, b: 138, alpha: 1 } // #1e3a8a brand navy
    }
  })
    .composite([
      {
        input: Buffer.from(`
          <svg width="192" height="192" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
            <circle cx="96" cy="96" r="76" fill="#ffffff" />
          </svg>
        `),
        top: 0,
        left: 0
      },
      {
        input: inner192,
        top: 31,
        left: 31
      }
    ])
    .png()
    .toFile(path.resolve(publicDir, 'pwa-maskable-192x192.png'));

  // 4. Maskable 512x512 (W3C safe area: content in center with safe padding)
  const inner512 = await sharp(logoPath)
    .resize(350, 350, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 30, g: 58, b: 138, alpha: 1 } // #1e3a8a brand navy
    }
  })
    .composite([
      {
        input: Buffer.from(`
          <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
            <circle cx="256" cy="256" r="204" fill="#ffffff" />
          </svg>
        `),
        top: 0,
        left: 0
      },
      {
        input: inner512,
        top: 81,
        left: 81
      }
    ])
    .png()
    .toFile(path.resolve(publicDir, 'pwa-maskable-512x512.png'));

  // 5. Apple Touch Icon (180x180 with clean white/brand background)
  const appleInner = await sharp(logoPath)
    .resize(140, 140, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .composite([
      {
        input: appleInner,
        top: 20,
        left: 20
      }
    ])
    .png()
    .toFile(path.resolve(publicDir, 'apple-touch-icon.png'));

  // 6. Favicon 48x48 and 32x32
  await sharp(logoPath)
    .resize(48, 48, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toFile(path.resolve(publicDir, 'favicon-48x48.png'));

  await sharp(logoPath)
    .resize(32, 32, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toFile(path.resolve(publicDir, 'favicon-32x32.png'));

  console.log('Successfully generated all PWA icons:');
  console.log('- pwa-192x192.png');
  console.log('- pwa-512x512.png');
  console.log('- pwa-maskable-192x192.png');
  console.log('- pwa-maskable-512x512.png');
  console.log('- apple-touch-icon.png');
  console.log('- favicon-48x48.png');
  console.log('- favicon-32x32.png');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
