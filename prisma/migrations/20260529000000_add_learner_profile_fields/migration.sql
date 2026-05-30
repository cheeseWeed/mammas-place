-- Extend drive_users into a shared LearnerProfile across all learning sections.
-- Adds optional profile fields (age, grade, display name) and per-section
-- JSONB progress blobs for Spelling and (opt-in) Geography. All columns are
-- nullable or have JSONB defaults so the migration is safe to run against an
-- existing populated table without backfill.

ALTER TABLE "drive_users"
  ADD COLUMN "ageYears"    INTEGER,
  ADD COLUMN "gradeLevel"  TEXT,
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "spelling"    JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "geography"   JSONB NOT NULL DEFAULT '{}'::jsonb;
