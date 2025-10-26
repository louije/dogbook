#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('Smart extraction: matching dog names to images in draw.io HTML...\n');

// Read CSV for dog names
const csvContent = fs.readFileSync('trombi.csv', 'utf-8');
const lines = csvContent.split('\n').slice(1);
const dogs = lines
  .filter(line => line.trim())
  .map(line => {
    const [name, sex, owner, breed] = line.split(',').map(s => s.trim());
    return { name, sex: sex === 'Mâle' ? 'male' : 'female', owner, breed };
  });

console.log(`Found ${dogs.length} dogs in CSV\n`);

// Read HTML and split into chunks around each image
const htmlContent = fs.readFileSync('MaisonDoggoTrombinoscope.drawio.html', 'utf-8');

// Find all images with surrounding context
const imagePattern = /(.{0,500})data:image\/(jpeg|png),([^"\\]{100,}?)(.{0,500})/g;
const imageChunks = [];
let match;

while ((match = imagePattern.exec(htmlContent)) !== null) {
  const before = match[1];
  const format = match[2];
  const data = match[3];
  const after = match[4];

  // Look for dog names in surrounding text
  const context = before + after;
  let foundName = null;

  for (const dog of dogs) {
    // Look for the dog name in the context (case insensitive)
    if (context.toLowerCase().includes(dog.name.toLowerCase())) {
      foundName = dog.name;
      break;
    }
  }

  imageChunks.push({ format, data, foundName, contextSample: context.substring(0, 100) });
}

console.log(`Found ${imageChunks.length} images in HTML\n`);

// Match images to dogs
const imagesDir = path.join(__dirname, 'backend', 'public', 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

const dogImageMap = new Map();
const unmatched = [];

for (const img of imageChunks) {
  if (img.foundName) {
    if (!dogImageMap.has(img.foundName)) {
      dogImageMap.set(img.foundName, img);
      console.log(`✓ Matched: ${img.foundName}`);
    }
  } else {
    unmatched.push(img);
  }
}

console.log(`\nMatched ${dogImageMap.size} dogs`);
console.log(`Unmatched images: ${unmatched.length}\n`);

// Save matched images
const dogsWithImages = dogs.map(dog => {
  const img = dogImageMap.get(dog.name);
  if (!img) {
    console.log(`⚠ No image found for: ${dog.name}`);
    return dog;
  }

  const filename = `${dog.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.${img.format}`;
  const filepath = path.join(imagesDir, filename);

  try {
    const buffer = Buffer.from(img.data, 'base64');
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

// Save to JSON
fs.writeFileSync('dogs-data.json', JSON.stringify(dogsWithImages, null, 2));

console.log(`\n✓ Saved ${dogsWithImages.length} dogs to dogs-data.json`);
console.log('\nIf matches look wrong, dog names in HTML might be formatted differently.');
console.log('Check: backend/public/images/ to verify');
