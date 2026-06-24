-- Pools were previously mirrored in an in-process map, so a price update was
-- lost on every API restart. Persist the value and expose an update timestamp
-- for the list snapshot instead.
ALTER TABLE "pool"
  ADD COLUMN IF NOT EXISTS "currentPrice" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
