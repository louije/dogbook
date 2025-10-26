#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'http://localhost:3000';
const GRAPHQL_ENDPOINT = `${API_URL}/api/graphql`;

// Read CSV and match with existing images
function loadDogsData() {
  const csvContent = fs.readFileSync('trombi.csv', 'utf-8');
  const lines = csvContent.split('\n').slice(1);

  const dogs = lines
    .filter(line => line.trim())
    .map(line => {
      const [name, sex, owner, breed] = line.split(',').map(s => s.trim());

      // Find matching image file
      const imageBaseName = name.toLowerCase()
        .replace(/é/g, 'e')
        .replace(/è/g, 'e')
        .replace(/ê/g, 'e')
        .replace(/à/g, 'a')
        .replace(/ô/g, 'o')
        .replace(/[^a-z0-9]/g, '-');

      const imagesDir = path.join(__dirname, 'backend', 'public', 'images');
      const possibleFiles = [
        `${imageBaseName}.jpeg`,
        `${imageBaseName}.jpg`,
        `${imageBaseName}.png`,
      ];

      let imageFile = null;
      for (const file of possibleFiles) {
        if (fs.existsSync(path.join(imagesDir, file))) {
          imageFile = file;
          break;
        }
      }

      return {
        name,
        sex: sex === 'Mâle' ? 'male' : 'female',
        owner,
        breed,
        imageFile
      };
    });

  return dogs;
}

async function createOwner(name) {
  const query = `
    mutation CreateOwner($name: String!) {
      createOwner(data: { name: $name }) {
        id
        name
      }
    }
  `;

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { name } })
  });

  const result = await response.json();
  if (result.errors) throw new Error(JSON.stringify(result.errors));
  return result.data.createOwner;
}

async function createDog(dog, ownerId) {
  const query = `
    mutation CreateDog(
      $name: String!
      $sex: DogSexType
      $breed: String
      $owner: OwnerRelateToOneForCreateInput!
    ) {
      createDog(data: {
        name: $name
        sex: $sex
        breed: $breed
        owner: $owner
      }) {
        id
        name
      }
    }
  `;

  const variables = {
    name: dog.name,
    sex: dog.sex,
    breed: dog.breed || null,
    owner: { connect: { id: ownerId } }
  };

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });

  const result = await response.json();
  if (result.errors) {
    console.error('Error:', JSON.stringify(result.errors, null, 2));
    throw new Error(`Failed to create dog ${dog.name}`);
  }
  return result.data.createDog;
}

async function main() {
  console.log('Starting Keystone import...\n');

  // Check backend
  try {
    await fetch(`${API_URL}/api/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' })
    });
  } catch (err) {
    console.error('❌ Backend not running at', API_URL);
    console.error('   Start it with: cd backend && npm run dev');
    process.exit(1);
  }

  // Load dogs data
  const dogs = loadDogsData();
  console.log(`Loaded ${dogs.length} dogs from CSV\n`);

  // Check for missing images
  const dogsWithoutImages = dogs.filter(d => !d.imageFile);
  if (dogsWithoutImages.length > 0) {
    console.log('⚠ Dogs without images:');
    dogsWithoutImages.forEach(d => console.log(`  - ${d.name}`));
    console.log();
  }

  // Group by owner
  const ownerMap = new Map();
  for (const dog of dogs) {
    if (!ownerMap.has(dog.owner)) {
      ownerMap.set(dog.owner, []);
    }
    ownerMap.get(dog.owner).push(dog);
  }

  console.log(`Found ${ownerMap.size} unique owners\n`);
  console.log('--- Creating owners ---\n');

  const ownerIds = new Map();

  for (const [ownerName, ownerDogs] of ownerMap.entries()) {
    try {
      const owner = await createOwner(ownerName);
      ownerIds.set(ownerName, owner.id);
      console.log(`✓ ${ownerName} (${ownerDogs.length} dog${ownerDogs.length > 1 ? 's' : ''})`);
    } catch (err) {
      console.error(`✗ Failed to create owner ${ownerName}`);
    }
  }

  console.log('\n--- Creating dogs ---\n');

  const createdDogs = [];

  for (const dog of dogs) {
    const ownerId = ownerIds.get(dog.owner);
    if (!ownerId) {
      console.error(`✗ ${dog.name}: owner not found`);
      continue;
    }

    try {
      const created = await createDog(dog, ownerId);
      createdDogs.push({ ...dog, id: created.id });
      const imageStatus = dog.imageFile ? '📷' : '⚠ no image';
      console.log(`✓ ${dog.name} ${imageStatus}`);
    } catch (err) {
      console.error(`✗ ${dog.name}: ${err.message}`);
    }
  }

  console.log(`\n✅ Import complete! Created ${createdDogs.length}/${dogs.length} dogs\n`);

  // Save mapping for manual image upload
  const imageMapping = createdDogs
    .filter(d => d.imageFile)
    .map(d => ({
      dogId: d.id,
      dogName: d.name,
      imageFile: d.imageFile,
      imagePath: `backend/public/images/${d.imageFile}`
    }));

  fs.writeFileSync('image-upload-map.json', JSON.stringify(imageMapping, null, 2));
  console.log('📝 Saved image mapping to image-upload-map.json');
  console.log('\n⚠ NEXT STEP: Upload images via Keystone admin UI');
  console.log(`   Visit: ${API_URL}`);
  console.log('   For each dog, edit and upload the image from backend/public/images/');
}

main().catch(console.error);
