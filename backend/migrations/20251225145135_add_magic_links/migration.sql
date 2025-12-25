-- CreateTable for EditToken
CREATE TABLE "EditToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL DEFAULT '',
    "token" TEXT NOT NULL DEFAULT '',
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME,
    "usageCount" INTEGER NOT NULL DEFAULT 0
);

-- Create unique index on token
CREATE UNIQUE INDEX "EditToken_token_key" ON "EditToken"("token");

-- Add status field to Dog table
ALTER TABLE "Dog" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';

-- Add changedByLabel to ChangeLog
ALTER TABLE "ChangeLog" ADD COLUMN "changedByLabel" TEXT;

-- Update existing dogs to approved status (backward compatibility)
UPDATE "Dog" SET "status" = 'approved';
