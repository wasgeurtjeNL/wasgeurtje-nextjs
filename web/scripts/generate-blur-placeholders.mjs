#!/usr/bin/env node

/**
 * Generate Blur Placeholders for Next.js Images
 * 
 * This script generates optimized blur placeholders for all critical images
 * using the Plaiceholder library (recommended by Next.js)
 * 
 * Usage: node scripts/generate-blur-placeholders.mjs
 */

import { getPlaiceholder } from 'plaiceholder';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Images to generate blur placeholders for
const images = [
  {
    name: 'Hero Desktop',
    path: '../public/figma/hero-image-287.png',
    component: 'HeroSection',
    variable: 'imgImage287',
  },
  {
    name: 'Hero Mobile',
    path: '../public/figma/Mobile-Background-2.webp',
    component: 'HeroSection',
    variable: 'imgImage288',
  },
  {
    name: 'Category - Premium Wasparfums',
    path: '../public/figma/categories-image-283.png',
    component: 'Categories',
    variable: 'imgImage283',
  },
  {
    name: 'Category - Proefpakket',
    path: '../public/figma/categories-trial.png',
    component: 'Categories',
    variable: 'imgImage',
  },
  {
    name: 'Category - Cadeauset',
    path: '../public/figma/categories-gift.png',
    component: 'Categories',
    variable: 'imgImage1',
  },
];

async function generateBlurPlaceholder(imagePath) {
  try {
    const fullPath = path.join(__dirname, imagePath);
    const buffer = await fs.readFile(fullPath);
    
    const { base64 } = await getPlaiceholder(buffer, {
      size: 10, // 10x10 pixels (tiny but effective)
    });
    
    return base64;
  } catch (error) {
    console.error(`❌ Error processing ${imagePath}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🎨 Generating blur placeholders for Next.js images...\n');
  
  const results = [];
  
  for (const image of images) {
    console.log(`Processing: ${image.name}...`);
    const blurDataURL = await generateBlurPlaceholder(image.path);
    
    if (blurDataURL) {
      results.push({
        ...image,
        blurDataURL,
      });
      console.log(`✅ Generated blur placeholder for ${image.name}`);
    } else {
      console.log(`⚠️  Failed to generate blur for ${image.name}`);
    }
  }
  
  // Generate output file with results
  const outputPath = path.join(__dirname, '../blur-placeholders.json');
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
  
  console.log(`\n✨ Done! Results saved to: blur-placeholders.json`);
  console.log('\n📋 Copy these blur data URLs to your components:\n');
  
  results.forEach(result => {
    console.log(`// ${result.name} (${result.component})`);
    console.log(`blurDataURL="${result.blurDataURL}"\n`);
  });
}

main().catch(console.error);

