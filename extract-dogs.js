#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('Extracting dog images from draw.io HTML...\n');

// Read CSV for dog names in order
const csvContent = fs.readFileSync('trombi.csv', 'utf-8');
const lines = csvContent.split('\n').slice(1); // Skip header
const dogs = lines
  .filter(line => line.trim())
  .map(line => {
    const [name, sex, owner, breed] = line.split(',').map(s => s.trim());
    return { name, sex: sex === 'Mâle' ? 'male' : 'female', owner, breed };
  });

console.log(`Found ${dogs.length} dogs in CSV`);

// Extract all images from HTML file (stream to avoid loading 15MB into memory)
const htmlPath = 'MaisonDoggoTrombinoscope.drawio.html';
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

// Find all data:image occurrences
const imageRegex = /data:image\/(jpeg|png),([^"\\]+)/g;
const images = [];
let match;

while ((match = imageRegex.exec(htmlContent)) !== null) {
  const format = match[1];
  const data = match[2];
  images.push({ format, data });
}

console.log(`Found ${images.length} images in HTML`);
console.log(`Skipping first image (likely logo/header)\n`);

// Skip first image (likely logo), match rest to dogs
const dogImages = images.slice(1);

// Match dogs with images by position
const imagesDir = path.join(__dirname, 'backend', 'public', 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

const dogsWithImages = dogs.slice(0, Math.min(dogs.length, dogImages.length)).map((dog, index) => {
  const image = dogImages[index];
  if (!image) return dog;

  const filename = `${dog.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.${image.format}`;
  const filepath = path.join(imagesDir, filename);

  try {
    // Decode base64 image data
    const buffer = Buffer.from(image.data, 'base64');
    fs.writeFileSync(filepath, buffer);
    console.log(`✓ Saved: ${filename} (${(buffer.length / 1024).toFixed(1)}KB)`);

    return {
      ...dog,
      imagePath: `/images/${filename}`,
      imageFile: filename
    };
  } catch (err) {
    console.error(`✗ Failed to save ${dog.name}:`, err.message);
    return dog;
  }
});

// Save to JSON for import
const outputPath = 'dogs-data.json';
fs.writeFileSync(outputPath, JSON.stringify(dogsWithImages, null, 2));

console.log(`\n✓ Saved ${dogsWithImages.length} dogs to ${outputPath}`);
console.log('\nNext: Create Keystone import script to populate database');
