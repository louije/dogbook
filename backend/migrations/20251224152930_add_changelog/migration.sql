-- CreateTable
CREATE TABLE "ChangeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL DEFAULT '',
    "entityName" TEXT NOT NULL DEFAULT '',
    "operation" TEXT NOT NULL,
    "changes" TEXT,
    "changesSummary" TEXT NOT NULL DEFAULT '',
    "changedBy" TEXT DEFAULT 'public',
    "status" TEXT DEFAULT 'pending'
);

