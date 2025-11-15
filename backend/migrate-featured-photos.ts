/**
 * Migration Script: Convert Dog.photoFeatured (image) to Media relationship
 *
 * What this does:
 * 1. For each dog with a photoFeatured image
 * 2. Create a new Media item that references the same image file
 * 3. Link it to the dog via photos relationship
 * 4. Set isFeatured: true
 *
 * This is idempotent - safe to run multiple times.
 */

import { getContext } from '@keystone-6/core/context';
import config from './keystone';
import * as PrismaModule from '.prisma/client';

async function migrate() {
  console.log('🚀 Starting photoFeatured migration...\n');

  const context = getContext(config, PrismaModule);

  // Get all dogs with their current photoFeatured data using Prisma directly
  // (because photoFeatured is already removed from Keystone schema.ts)
  const dogs = await context.prisma.dog.findMany({
    select: {
      id: true,
      name: true,
      photoFeatured_id: true,
      photoFeatured_filesize: true,
      photoFeatured_width: true,
      photoFeatured_height: true,
      photoFeatured_extension: true,
      photos: {
        select: {
          id: true,
          file_id: true,
          isFeatured: true,
        },
      },
    },
  });

  console.log(`Found ${dogs.length} dogs to process\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const dog of dogs) {
    const { id, name, photoFeatured_id, photoFeatured_filesize, photoFeatured_width, photoFeatured_height, photoFeatured_extension, photos } = dog;

    console.log(`Processing: ${name} (${id})`);

    // Skip if no photoFeatured
    if (!photoFeatured_id) {
      console.log(`  ⏭️  No photoFeatured - skipping`);
      skipped++;
      continue;
    }

    // Check if we already migrated this dog's featured photo
    const existingFeaturedMedia = photos?.find(
      (p: any) => p.file_id === photoFeatured_id
    );

    if (existingFeaturedMedia) {
      console.log(`  ✅ Already migrated (Media ${existingFeaturedMedia.id})`);

      // Ensure it's marked as featured
      if (!existingFeaturedMedia.isFeatured) {
        await context.prisma.media.update({
          where: { id: existingFeaturedMedia.id },
          data: { isFeatured: true },
        });
        console.log(`  🔧 Set isFeatured=true on existing Media`);
      }

      skipped++;
      continue;
    }

    // Create new Media item referencing the same image file
    try {
      const mediaId = `migrated_${id}_${Date.now()}`;

      await context.prisma.media.create({
        data: {
          id: mediaId,
          name: 'Photo principale',
          file_id: photoFeatured_id,
          file_filesize: photoFeatured_filesize,
          file_width: photoFeatured_width,
          file_height: photoFeatured_height,
          file_extension: photoFeatured_extension,
          type: 'photo',
          dog: { connect: { id } },
          isFeatured: true,
          status: 'approved',
          uploadedAt: new Date().toISOString(),
        },
      });

      console.log(`  ✨ Created Media ${mediaId}`);
      created++;
    } catch (error) {
      console.error(`  ❌ Error creating Media:`, error);
      errors++;
    }
  }

  console.log('\n📊 Migration Summary:');
  console.log(`  Created: ${created}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total: ${dogs.length}`);

  if (errors === 0) {
    console.log('\n✅ Migration completed successfully!');
  } else {
    console.log('\n⚠️  Migration completed with errors');
  }

  process.exit(errors > 0 ? 1 : 0);
}

migrate().catch((error) => {
  console.error('💥 Migration failed:', error);
  process.exit(1);
});
