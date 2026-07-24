-- AlterTable
ALTER TABLE "Turn" ADD COLUMN     "beatText" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "rewriteAccepted" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing turns: the beat starts as the original transcript
UPDATE "Turn" SET "beatText" = "transcript" WHERE "beatText" = '';
