#!/usr/bin/env node
/**
 * Publishes every non-private package under `packages/` whose current
 * `version` isn't on the registry yet.
 *
 * Not `changeset publish` / `pnpm publish` — both go through pnpm's own
 * registry client, which 404'd on every publish attempt in this repo's
 * first real release (step 18) for reasons that survived a correctly-
 * scoped, correctly-permissioned granular access token, a permissive
 * per-package "Publishing access" setting, and a from-scratch token
 * regeneration — narrowing it to pnpm's publish implementation itself
 * rather than anything about this repo's npm setup. `npm publish` is what
 * actually worked for this project's first (manual, interactive) release.
 *
 * `pnpm pack` still does the packing — it's what correctly rewrites a
 * workspace:* dependency to a real version before the tarball is built
 * (confirmed directly: step 18's 0.1.0 release, packed and published via
 * plain `npm publish` on the source directory instead of a pnpm-built
 * tarball, shipped three packages with a literal, unresolvable
 * "workspace:*" in `dependencies`). `npm publish <tarball>` afterward
 * never has to resolve the workspace protocol at all — the tarball pnpm
 * built already has real versions in it.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const packagesDir = join(process.cwd(), 'packages');

function isPublished(name, version) {
  try {
    execSync(`npm view ${name}@${version} version`, { stdio: 'pipe' });
    return true;
  } catch {
    return false; // npm view exits non-zero (404) when the version doesn't exist yet
  }
}

const packageDirs = readdirSync(packagesDir).filter((dir) => existsSync(join(packagesDir, dir, 'package.json')));

for (const dir of packageDirs) {
  const packagePath = join(packagesDir, dir);
  const pkg = JSON.parse(readFileSync(join(packagePath, 'package.json'), 'utf8'));
  if (pkg.private) continue;

  const { name, version } = pkg;

  if (isPublished(name, version)) {
    console.log(`skip ${name}@${version} — already published`);
    continue;
  }

  console.log(`packing ${name}@${version}...`);
  const tmpDir = mkdtempSync(join(tmpdir(), 'brandrail-pack-'));
  execSync(`pnpm pack --pack-destination ${tmpDir}`, { cwd: packagePath, stdio: 'inherit' });

  const tarball = readdirSync(tmpDir).find((file) => file.endsWith('.tgz'));
  if (!tarball) throw new Error(`pnpm pack produced no tarball for ${name} in ${tmpDir}`);

  console.log(`publishing ${name}@${version}...`);
  execSync(`npm publish ${join(tmpDir, tarball)} --access public`, { stdio: 'inherit' });
  console.log(`published ${name}@${version}`);

  // `changeset publish`'s own tagging convention (`name@version`) — kept
  // here since a custom publish command skips changesets' own tagging step.
  const tag = `${name}@${version}`;
  execSync(`git tag ${tag}`, { stdio: 'inherit' });
  execSync(`git push origin ${tag}`, { stdio: 'inherit' });
}
