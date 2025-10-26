#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'http://localhost:3000';
const GRAPHQL_ENDPOINT = `${API_URL}/api/graphql`;

// GraphQL mutation to create owner
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

// Upload image and create dog
async function createDogWithImage(dog, ownerId, imagePath) {
  const query = `
    mutation CreateDog(
      $name: String!
      $sex: DogSexType
      $breed: String
      $owner: OwnerRelateToOneForCreateInput
      $photoFeatured: ImageFieldInput
    ) {
      createDog(data: {
        name: $name
        sex: $sex
        breed: $breed
        owner: $owner
        photoFeatured: $photoFeatured
      }) {
        id
        name
      }
    }
  `;

  // For KeystoneJS image uploads, we need to use the file upload approach
  // Since GraphQL mutations with file uploads require multipart/form-data
  // Let's use a simpler approach: upload via REST if available, or create without image first

  const variables = {
    name: dog.name,
    sex: dog.sex,
    breed: dog.breed || null,
    owner: { connect: { id: ownerId } },
    photoFeatured: null // We'll need to handle this separately
  };

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });

  const result = await response.json();
  if (result.errors) {
    console.error('GraphQL Error:', JSON.stringify(result.errors, null, 2));
    throw new Error(`Failed to create dog ${dog.name}`);
  }
  return result.data.createDog;
}

async function main() {
  console.log('Starting Keystone import...\n');

  // Check if backend is running
  try {
    const response = await fetch(`${API_URL}/api/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' })
    });
    if (!response.ok) throw new Error('Backend not accessible');
  } catch (err) {
    console.error('❌ Error: Backend is not running at', API_URL);
    console.error('   Start it with: cd backend && npm run dev');
    process.exit(1);
  }

  // Read extracted dogs data
  const dogsData = JSON.parse(fs.readFileSync('dogs-data.json', 'utf-8'));
  console.log(`Loaded ${dogsData.length} dogs from dogs-data.json\n`);

  // Group dogs by owner
  const ownerMap = new Map();
  for (const dog of dogsData) {
    if (!ownerMap.has(dog.owner)) {
      ownerMap.set(dog.owner, []);
    }
    ownerMap.get(dog.owner).push(dog);
  }

  console.log(`Found ${ownerMap.size} unique owners\n`);

  const ownerIds = new Map();

  // Create owners
  for (const [ownerName, dogs] of ownerMap.entries()) {
    try {
      const owner = await createOwner(ownerName);
      ownerIds.set(ownerName, owner.id);
      console.log(`✓ Created owner: ${ownerName} (${dogs.length} dogs)`);
    } catch (err) {
      console.error(`✗ Failed to create owner ${ownerName}:`, err.message);
    }
  }

  console.log('\n--- Creating dogs ---\n');

  // Create dogs
  for (const dog of dogsData) {
    const ownerId = ownerIds.get(dog.owner);
    if (!ownerId) {
      console.error(`✗ Skipping ${dog.name}: owner not found`);
      continue;
    }

    const imagePath = dog.imageFile
      ? path.join(__dirname, 'backend', 'public', 'images', dog.imageFile)
      : null;

    try {
      const createdDog = await createDogWithImage(dog, ownerId, imagePath);
      console.log(`✓ Created dog: ${dog.name}`);
    } catch (err) {
      console.error(`✗ Failed to create ${dog.name}:`, err.message);
    }
  }

  console.log('\n✓ Import complete!');
  console.log('\nNote: Images are in backend/public/images/');
  console.log('You\'ll need to manually upload them via the Keystone admin UI.');
  console.log(`Visit: ${API_URL}`);
}

main().catch(console.error);
