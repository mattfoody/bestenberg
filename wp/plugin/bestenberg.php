<?php
/**
 * Plugin Name:       Bestenberg
 * Plugin URI:        https://mattfoody.com
 * Description:       AI-native visual editor on Gutenberg.
 * Version:           0.1.0
 * Requires at least: 7.1
 * Requires PHP:      8.1
 * Author:            Matt Foody
 * Author URI:        https://mattfoody.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       bestenberg
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

defined( 'ABSPATH' ) || exit;

define( 'BESTENBERG_VERSION', '0.1.0' );
define( 'BESTENBERG_FILE', __FILE__ );
define( 'BESTENBERG_DIR', plugin_dir_path( __FILE__ ) );
define( 'BESTENBERG_URL', plugin_dir_url( __FILE__ ) );

if ( is_readable( BESTENBERG_DIR . 'vendor/autoload.php' ) ) {
	require_once BESTENBERG_DIR . 'vendor/autoload.php';
} else {
	// Fallback PSR-4 autoloader for builds shipped without Composer's vendor directory.
	spl_autoload_register(
		static function ( string $class_name ): void {
			$prefix = 'Bestenberg\\';
			if ( ! str_starts_with( $class_name, $prefix ) ) {
				return;
			}
			$relative = substr( $class_name, strlen( $prefix ) );
			$file     = BESTENBERG_DIR . 'src/' . str_replace( '\\', '/', $relative ) . '.php';
			if ( is_readable( $file ) ) {
				require_once $file;
			}
		}
	);
}

add_action( 'plugins_loaded', array( \Bestenberg\Plugin::instance(), 'register' ) );
