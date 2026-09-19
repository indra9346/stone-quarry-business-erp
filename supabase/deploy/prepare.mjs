// Builds a Supabase-CLI-compatible working directory for ONE hosted project.
//
// The CLI only discovers migrations directly under <workdir>/supabase/migrations
// as "<14-digit version>_<name>.sql", so the repo's sub-folders
// (central/, business-template/) cannot be pushed as-is. This copies the SQL
// UNCHANGED (byte for byte), only renaming files, keeping filename order.
//
//   node supabase/deploy/prepare.mjs business-template   -> .deploy/business-template/
//   node supabase/deploy/prepare.mjs central             -> .deploy/central/
//
// Contains no secrets. `.deploy/` is git-ignored.
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const set = process.argv[2]
if (!['central', 'business-template'].includes(set)) {
  console.error('usage: node supabase/deploy/prepare.mjs <central|business-template>')
  process.exit(1)
}
const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const src = join(repo, 'supabase', 'migrations', set)
const out = join(repo, '.deploy', set)
rmSync(out, { recursive: true, force: true })
const dest = join(out, 'supabase', 'migrations')
mkdirSync(dest, { recursive: true })

const files = readdirSync(src).filter((f) => f.endsWith('.sql')).sort()
files.forEach((f, i) => {
  const version = String(20260920000000 + i + 1) // strictly increasing, stable
  copyFileSync(join(src, f), join(dest, `${version}_${f}`))
  console.log(`${version}_${f}`)
})
// Minimal CLI config; the project ref is supplied later by `supabase link`.
writeFileSync(join(out, 'supabase', 'config.toml'), `project_id = "stonequarryerp-${set}"\n`)
console.log(`\nPrepared ${files.length} migrations in ${out}`)
