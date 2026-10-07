<?php
/**
 * PHPUnit bootstrap: loads the WordPress test library (provided by wp-env) and the plugin.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

$bestenberg_tests_dir = getenv( 'WP_TESTS_DIR' );
if ( false === $bestenberg_tests_dir || '' === $bestenberg_tests_dir ) {
	$bestenberg_tests_dir = '/wordpress-phpunit';
}

if ( ! is_readable( $bestenberg_tests_dir . '/includes/functions.php' ) ) {
	fwrite( STDERR, "WordPress test library not found in {$bestenberg_tests_dir}. Run tests via `pnpm test:php`.\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite, WordPress.Security.EscapeOutput.OutputNotEscaped
	exit( 1 );
}

define( 'WP_TESTS_PHPUNIT_POLYFILLS_PATH', dirname( __DIR__ ) . '/vendor/yoast/phpunit-polyfills' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- Required by the WP test library.

require_once dirname( __DIR__ ) . '/vendor/autoload.php';
require_once $bestenberg_tests_dir . '/includes/functions.php';

tests_add_filter(
	'muplugins_loaded',
	static function (): void {
		require dirname( __DIR__ ) . '/bestenberg.php';
	}
);

require $bestenberg_tests_dir . '/includes/bootstrap.php';
