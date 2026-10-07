#!/usr/bin/env node
/**
 * Runs after `wp-env start`: activates Bestenberg plugin + theme in both
 * environments and skips the WooCommerce onboarding wizard.
 */
import { execFileSync } from 'node:child_process';

const environments = ['cli', 'tests-cli'];

function wp(env, args) {
  execFileSync('npx', ['wp-env', 'run', env, 'wp', ...args], { stdio: 'inherit' });
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
