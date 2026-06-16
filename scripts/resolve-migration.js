#!/usr/bin/env node
// Cross-platform: marks broken migration 001 as applied so prisma migrate deploy skips it.
const { execSync } = require('child_process')
try {
  execSync(
    'npx prisma migrate resolve --applied 20260511000001_direction_athlete_trainergroups',
    { stdio: 'pipe' }
  )
} catch {
  // already marked or not found — safe to ignore
}
