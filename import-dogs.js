#!/usr/bin/env node

/**
 * Import dogs from HTML file and CSV
 * This script:
 * 1. Reads the CSV for dog metadata (name, gender, owner, breed)
 * 2. Extracts base64 images from the HTML file
 * 3. Saves images to backend/public/images/
 * 4. Creates Keystone records via GraphQL
 */

const fs = require('fs');
const path = require('path');
const { createReadStream } = require('fs');
const { createInterface } = require('readline');

// Parse CSV
function parseCSV(filePath) {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  const dogs = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const [name, sex, owner, breed] = line.split(',');
    if (name && name !== 'Nom du Chien') {
      dogs.push({
        name: name.trim(),
        sex: sex.trim() === 'Mâle' ? 'male' : 'female',
        owner: owner.trim(),
        breed: breed.trim()
      });
    }
  }

  return dogs;
}

// Extract images from HTML (streaming to avoid memory issues)
async function extractImages(htmlPath) {
  const images = {};
  let currentName = null;
  let buffer = '';

  const fileStream = createReadStream(htmlPath, { encoding: 'utf-8' });
  const rl = createInterface({ input: fileStream });

  for await (const line of rl) {
    buffer += line;

    // Look for dog names (text nodes in the diagram)
    const nameMatches = buffer.matchAll(/>([A-Z][a-z]+)</g);
    for (const match of nameMatches) {
      const potentialName = match[1];
      if (potentialName.length > 2 && potentialName.length < 15) {
        currentName = potentialName;
      }
    }

    // Look for image data
    const imageMatch = buffer.match(/data:image\/png,([^"]+)/);
    if (imageMatch && currentName) {
      const imageData = imageMatch[1];
      if (!images[currentName]) {
        images[currentName] = imageData;
        console.log(`Found image for: ${currentName}`);
      }
      // Clear buffer to free memory
      buffer = buffer.substring(buffer.indexOf(imageData) + imageData.length);
      currentName = null;
    }

    // Keep buffer manageable
    if (buffer.length > 100000) {
      buffer = buffer.substring(buffer.length - 50000);
    }
  }

  return images;
}

// Save image from data URL
function saveImage(imageData, outputPath) {
  // Remove data:image/png, prefix if present
  const base64Data = imageData.replace(/^data:image\/png,/, '');

  // PNG data is base64 encoded
  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(outputPath, buffer);
  console.log(`Saved: ${outputPath}`);
}

// Main execution
async function main() {
  console.log('Starting dog import...\n');

  // Parse CSV
  console.log('1. Parsing CSV...');
  const csvPath = path.join(__dirname, 'trombi.csv');
  const dogs = parseCSV(csvPath);
  console.log(`Found ${dogs.length} dogs in CSV\n`);

  // Extract images from HTML
  console.log('2. Extracting images from HTML (this may take a minute)...');
  const htmlPath = path.join(__dirname, 'MaisonDoggoTrombinoscope.drawio.html');
  const images = await extractImages(htmlPath);
  console.log(`Extracted ${Object.keys(images).length} images\n`);

  // Save images and prepare data
  console.log('3. Saving images...');
  const imagesDir = path.join(__dirname, 'backend', 'public', 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const dogsWithImages = dogs.map(dog => {
    const imageData = images[dog.name];
    if (imageData) {
      const filename = `${dog.name.toLowerCase()}-${Date.now()}.png`;
      const filepath = path.join(imagesDir, filename);
      try {
        saveImage(imageData, filepath);
        return { ...dog, imageFile: filename };
      } catch (err) {
        console.error(`Failed to save image for ${dog.name}:`, err.message);
        return dog;
      }
    } else {
      console.warn(`No image found for ${dog.name}`);
      return dog;
    }
  });

  // Save mapping to JSON for manual review/import
  const outputPath = path.join(__dirname, 'dogs-import-data.json');
  fs.writeFileSync(outputPath, JSON.stringify(dogsWithImages, null, 2));
  console.log(`\n4. Saved import data to: ${outputPath}`);
  console.log('\nNext steps:');
  console.log('- Review dogs-import-data.json');
  console.log('- Import to Keystone manually or run a GraphQL import script');
}

main().catch(console.error);
