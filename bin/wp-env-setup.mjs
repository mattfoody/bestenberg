#!/usr/bin/env node
/**
 * Runs after `wp-env start`: activates Bestenberg plugin + theme in both
 * environments, skips the WooCommerce onboarding wizard, and (re)creates the
 * demo page at /bestenberg-demo/ in the development environment.
 */
import { execFileSync } from 'node:child_process';

const environments = ['cli', 'tests-cli'];
const DEMO_SLUG = 'bestenberg-demo';
const DEMO_FILE = 'wp-content/plugins/bestenberg/tests/fixtures/demo-page.html';

function wp(env, args, { capture = false } = {}) {
  const output = execFileSync('npx', ['wp-env', 'run', env, 'wp', ...args], {
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
  });
  return capture ? output.trim() : '';
}

for (const env of environments) {
  wp(env, ['plugin', 'activate', 'bestenberg', 'woocommerce']);
  wp(env, ['theme', 'activate', 'bestenberg']);
  wp(env, [
    'option',
    'update',
    'woocommerce_onboarding_profile',
    '{"skipped":true}',
    '--format=json',
  ]);
  wp(env, ['option', 'update', 'woocommerce_coming_soon', 'no']);
  wp(env, ['rewrite', 'structure', '/%postname%/', '--hard']);
}

// Demo page: delete any previous copy, then create it from the fixture.
const existing = wp(
  'cli',
  ['post', 'list', '--post_type=page', `--name=${DEMO_SLUG}`, '--field=ID', '--post_status=any'],
  { capture: true },
)
  .split(/\s+/)
  .filter((id) => /^\d+$/.test(id));
if (existing.length > 0) wp('cli', ['post', 'delete', ...existing, '--force']);

wp('cli', [
  'post',
  'create',
  DEMO_FILE,
  '--post_type=page',
  '--post_status=publish',
  '--post_title=Bestenberg Demo',
  `--post_name=${DEMO_SLUG}`,
  '--user=admin',
]);
