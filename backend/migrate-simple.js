const { PrismaClient } = require(".prisma/client");

async function migrate() {
  console.log("🚀 Starting photoFeatured migration...\n");

  const prisma = new PrismaClient();

  try {
    const dogs = await prisma.dog.findMany({
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

    for (const dog of dogs) {
      const { id, name, photoFeatured_id, photoFeatured_filesize, photoFeatured_width, photoFeatured_height, photoFeatured_extension, photos } = dog;

      console.log(`Processing: ${name} (${id})`);

      if (!photoFeatured_id) {
        console.log(`  ⏭️  No photoFeatured - skipping`);
        skipped++;
        continue;
      }

      const existingFeaturedMedia = photos?.find(p => p.file_id === photoFeatured_id);

      if (existingFeaturedMedia) {
        console.log(`  ✅ Already migrated (Media ${existingFeaturedMedia.id})`);

        if (!existingFeaturedMedia.isFeatured) {
          await prisma.media.update({
            where: { id: existingFeaturedMedia.id },
            data: { isFeatured: true },
          });
          console.log(`  🔧 Set isFeatured=true`);
        }

        skipped++;
        continue;
      }

      const mediaId = `migrated_${id}_${Date.now()}`;

      await prisma.media.create({
        data: {
          id: mediaId,
          name: "Photo principale",
          file_id: photoFeatured_id,
          file_filesize: photoFeatured_filesize,
          file_width: photoFeatured_width,
          file_height: photoFeatured_height,
          file_extension: photoFeatured_extension,
          type: "photo",
          dog: { connect: { id } },
          isFeatured: true,
          status: "approved",
          uploadedAt: new Date().toISOString(),
        },
      });

      console.log(`  ✨ Created Media ${mediaId}`);
      created++;
    }

    console.log("\n📊 Migration Summary:");
    console.log(`  Created: ${created}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Total: ${dogs.length}`);

    console.log("\n✅ Migration completed successfully!");

  } catch (error) {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
