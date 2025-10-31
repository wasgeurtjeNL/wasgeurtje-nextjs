import { getPlaiceholder } from 'plaiceholder';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateBlurData() {
  console.log('🎨 Generating blur placeholders for hero images...\n');

  const images = [
    {
      name: 'hero-desktop',
      path: path.join(__dirname, '../public/figma/hero-image-287.png'),
    },
    {
      name: 'hero-mobile',
      path: path.join(__dirname, '../public/figma/Mobile-Background-2.webp'),
    },
  ];

  const blurData = {};

  for (const image of images) {
    try {
      console.log(`Processing: ${image.name}...`);
      
      const file = await fs.readFile(image.path);
      const { base64 } = await getPlaiceholder(file, { size: 10 });
      
      blurData[image.name] = base64;
      console.log(`✅ Generated blur for ${image.name}`);
    } catch (error) {
      console.error(`❌ Error processing ${image.name}:`, error.message);
    }
  }

  // Save to JSON file
  const outputPath = path.join(__dirname, '../src/data/blur-placeholders.json');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(blurData, null, 2));

  console.log('\n✅ Blur placeholders saved to: src/data/blur-placeholders.json');
  console.log('📦 Import them in your components for instant blur loading!');
}

generateBlurData().catch(console.error);

