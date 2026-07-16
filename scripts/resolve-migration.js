#!/usr/bin/env node
// Baseline: marks pre-Season migrations as applied in _prisma_migrations.
// Needed when the DB was created via `prisma db push` with no migration history.
// Safe to run on every deployment — already-tracked migrations are caught silently.
//
// Migrations strictly before CUTOFF → resolve --applied (baseline, no SQL runs)
// Migrations >= CUTOFF → handled by `prisma migrate deploy` (SQL is applied)
//
// When adding a new migration in the future: no changes needed here.
// The new migration will have a later timestamp and `migrate deploy` will apply it.

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const CUTOFF = '20260716000001_season_feature'

const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations')

const migrations = fs
  .readdirSync(migrationsDir)
  .filter(e => e !== 'migration_lock.toml' && e < CUTOFF)
  .sort()

console.log(`Baseline: marking ${migrations.length} pre-Season migrations as applied...`)

let marked = 0
for (const name of migrations) {
  try {
    execSync(`npx prisma migrate resolve --applied ${name}`, {
      stdio: ['ignore', 'ignore', 'ignore'],
    })
    console.log(`  ✓ ${name}`)
    marked++
  } catch {
    console.log(`  ~ ${name} (already tracked)`)
  }
}

console.log(`Baseline complete: ${marked} new, ${migrations.length - marked} already tracked.`)
