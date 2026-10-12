#!/usr/bin/env node
/**
 * Release tooling for the self-hosted update server (see RELEASING.md).
 *
 *   node bin/release.mjs bump <version>   set the version everywhere, commit, tag v<version>
 *   node bin/release.mjs build [--expect <version>]
 *                                         package plugin + theme zips and info.json into release/public
 *   node bin/release.mjs deploy           upload release/public to BESTENBERG_DEPLOY_TARGET via rsync/ssh
 *
 * The update base URL comes from the plugin's `Update URI` header.
 * Deploy env: BESTENBERG_DEPLOY_TARGET (user@host:/path/), optional BESTENBERG_DEPLOY_SSH (ssh command).
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const path = (p) => join(root, p);
const read = (p) => readFileSync(path(p), 'utf8');
const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

const FILES = {
  plugin: 'wp/plugin/bestenberg.php',
  readme: 'wp/plugin/readme.txt',
  theme: 'wp/theme/style.css',
  changelog: 'CHANGELOG.md',
};

/** Paths (relative to wp/plugin) never shipped in the plugin zip. */
const PLUGIN_EXCLUDES = [
  'tests',
  'vendor',
  'node_modules',
  'composer.json',
  'composer.lock',
  'phpcs.xml.dist',
  'phpstan.neon.dist',
  'phpunit.xml.dist',
  '.gitignore',
  '.phpunit.result.cache',
];

function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

function header(source, name) {
  const match = new RegExp(`^[\\s*]*${name}:\\s*(.+?)\\s*$`, 'm').exec(source);
  return match ? match[1] : '';
}

function versions() {
  const plugin = read(FILES.plugin);
  return {
    'plugin header': header(plugin, 'Version'),
    BESTENBERG_VERSION: /define\(\s*'BESTENBERG_VERSION',\s*'([^']+)'\s*\)/.exec(plugin)?.[1] ?? '',
    'readme Stable tag': header(read(FILES.readme), 'Stable tag'),
    'theme Version': header(read(FILES.theme), 'Version'),
  };
}

function currentVersion() {
  const found = versions();
  const unique = [...new Set(Object.values(found))];
  if (unique.length !== 1 || !SEMVER.test(unique[0])) {
    fail(`version mismatch:\n${Object.entries(found).map(([k, v]) => `  ${k}: ${v}`).join('\n')}`);
  }
  return unique[0];
}

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Bullet list of a CHANGELOG section as [markdown, html]. */
function changelogSection(version) {
  const lines = read(FILES.changelog).split('\n');
  const start = lines.findIndex((line) => line.startsWith(`## ${version}`));
  if (start === -1) return ['', ''];
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break;
    body.push(line);
  }
  const markdown = body.join('\n').trim();
  const items = body.filter((l) => l.startsWith('- ')).map((l) => `<li>${escapeHtml(l.slice(2))}</li>`);
  return [markdown, items.length > 0 ? `<ul>${items.join('')}</ul>` : ''];
}

// ── bump ───────────────────────────────────────────────────────────────────

function bump(version) {
  if (!SEMVER.test(version ?? '')) fail('usage: bump <version>, e.g. bump 0.2.0');
  if (git('status', '--porcelain') !== '') fail('working tree is not clean; commit or stash first');
  if (git('tag', '--list', `v${version}`) !== '') fail(`tag v${version} already exists`);

  const replaceIn = (file, pattern, replacement) => {
    const source = read(file);
    if (!pattern.test(source)) fail(`could not find version in ${file}`);
    writeFileSync(path(file), source.replace(pattern, replacement));
  };

  replaceIn(FILES.plugin, /(^\s*\*\s*Version:\s*).+$/m, `$1${version}`);
  replaceIn(FILES.plugin, /(define\(\s*'BESTENBERG_VERSION',\s*')[^']+('\s*\))/, `$1${version}$2`);
  replaceIn(FILES.readme, /(^Stable tag:\s*).+$/m, `$1${version}`);
  replaceIn(FILES.theme, /(^Version:\s*).+$/m, `$1${version}`);

  const today = new Date().toISOString().slice(0, 10);
  replaceIn(FILES.changelog, /^## Unreleased\n/m, `## Unreleased\n\n## ${version} — ${today}\n`);

  git('add', ...Object.values(FILES));
  git('commit', '-m', `Release v${version}`);
  git('tag', '-a', `v${version}`, '-m', `Bestenberg ${version}`);
  console.log(`Bumped to ${version}, committed and tagged v${version}.`);
  console.log('Publish with: git push --follow-tags');
}

// ── build ──────────────────────────────────────────────────────────────────

function zipDirectory(stageParent, folder, zipFile) {
  mkdirSync(dirname(zipFile), { recursive: true });
  rmSync(zipFile, { force: true });
  execFileSync('zip', ['-rqX', zipFile, folder], { cwd: stageParent });
}

function build(expected) {
  const version = currentVersion();
  if (expected && expected !== version) fail(`tag says ${expected} but files say ${version}`);

  const pluginSource = read(FILES.plugin);
  const base = header(pluginSource, 'Update URI');
  if (!/^https:\/\/[^/]+\/.*\/$/.test(base)) fail(`Update URI must be https and end with "/": ${base}`);

  for (const required of [
    'wp/plugin/build/editor/index.js',
    'wp/plugin/build/editor/blocks.js',
    'wp/plugin/generated/utilities.map.php',
    'wp/plugin/generated/components.php',
  ]) {
    if (!existsSync(path(required))) fail(`${required} is missing; run "pnpm build" first`);
  }

  const out = path('release');
  rmSync(out, { recursive: true, force: true });
  const stage = join(out, 'stage');
  const publicDir = join(out, 'public');

  // Plugin.
  const pluginStage = join(stage, 'plugin');
  cpSync(path('wp/plugin'), join(pluginStage, 'bestenberg'), {
    recursive: true,
    filter: (source) => {
      const rel = relative(path('wp/plugin'), source);
      return !PLUGIN_EXCLUDES.some((x) => rel === x || rel.startsWith(`${x}/`));
    },
  });
  const pluginZip = `bestenberg-${version}.zip`;
  zipDirectory(pluginStage, 'bestenberg', join(publicDir, 'plugin', pluginZip));

  // Theme.
  const themeStage = join(stage, 'theme');
  cpSync(path('wp/theme'), join(themeStage, 'bestenberg'), { recursive: true });
  const themeZip = `bestenberg-theme-${version}.zip`;
  zipDirectory(themeStage, 'bestenberg', join(publicDir, 'theme', themeZip));

  // Metadata.
  const [notes, changelogHtml] = changelogSection(version);
  const common = {
    version,
    homepage: header(pluginSource, 'Plugin URI'),
    requires: header(pluginSource, 'Requires at least'),
    requires_php: header(pluginSource, 'Requires PHP'),
    tested: header(read(FILES.readme), 'Tested up to'),
    last_updated: new Date().toISOString().replace('T', ' ').slice(0, 19),
  };
  const info = (name, kind, file, description) => ({
    name,
    ...common,
    download_url: `${base}${kind}/${file}`,
    sections: {
      description: `<p>${escapeHtml(description)}</p>`,
      ...(changelogHtml ? { changelog: changelogHtml } : {}),
    },
  });
  writeFileSync(
    join(publicDir, 'plugin', 'info.json'),
    `${JSON.stringify(info('Bestenberg', 'plugin', pluginZip, header(pluginSource, 'Description')), null, 2)}\n`,
  );
  writeFileSync(
    join(publicDir, 'theme', 'info.json'),
    `${JSON.stringify(info('Bestenberg theme', 'theme', themeZip, header(read(FILES.theme), 'Description')), null, 2)}\n`,
  );
  writeFileSync(join(out, 'notes.md'), `${notes || `Bestenberg ${version}`}\n`);
  rmSync(stage, { recursive: true, force: true });

  for (const [kind, file] of [
    ['plugin', pluginZip],
    ['theme', themeZip],
  ]) {
    const listing = execFileSync('unzip', ['-Z1', join(publicDir, kind, file)], { encoding: 'utf8' });
    const entries = listing.split('\n').filter(Boolean);
    const main = kind === 'plugin' ? 'bestenberg/bestenberg.php' : 'bestenberg/style.css';
    if (!entries.includes(main)) fail(`${file} is missing ${main}`);
    if (entries.some((e) => /\/(tests|vendor|node_modules)\//.test(e))) fail(`${file} contains dev files`);
    console.log(`  ${kind}: ${file} (${entries.length} files)`);
  }
  console.log(`Release ${version} ready in release/public (base ${base}).`);
}

// ── deploy ─────────────────────────────────────────────────────────────────

function deploy() {
  const target = process.env.BESTENBERG_DEPLOY_TARGET;
  if (!target || !/^[^@\s]+@[^:\s]+:\S+\/$/.test(target)) {
    fail('set BESTENBERG_DEPLOY_TARGET to user@host:/path/to/updates/bestenberg/ (trailing slash)');
  }
  const publicDir = path('release/public');
  if (!existsSync(join(publicDir, 'plugin', 'info.json'))) fail('nothing to deploy; run "build" first');

  const ssh = process.env.BESTENBERG_DEPLOY_SSH;
  const rsync = (extra) =>
    execFileSync(
      'rsync',
      ['-az', '--chmod=D755,F644', ...(ssh ? ['-e', ssh] : []), ...extra, `${publicDir}/`, target],
      { stdio: 'inherit' },
    );

  // Zips first, then info.json, so sites never see an update whose zip is not there yet.
  rsync(['--exclude', 'info.json']);
  rsync([]);
  console.log(`Deployed to ${target}`);
}

// ── main ───────────────────────────────────────────────────────────────────

const [command, ...args] = process.argv.slice(2);
switch (command) {
  case 'bump':
    bump(args[0]);
    break;
  case 'build': {
    const index = args.indexOf('--expect');
    build(index === -1 ? undefined : args[index + 1]);
    break;
  }
  case 'deploy':
    deploy();
    break;
  default:
    fail(`unknown command "${command ?? ''}". Use bump <version>, build [--expect <version>] or deploy.`);
}

