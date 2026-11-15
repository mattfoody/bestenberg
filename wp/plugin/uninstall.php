<?php
/**
 * Removes what Bestenberg stored outside of content when the plugin is deleted.
 * Pages keep their blocks; they are regular WordPress content.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

delete_metadata( 'user', 0, 'bestenberg_onboarded', '', true );
delete_option( 'bestenberg_license_key' );
delete_site_transient( 'bestenberg_update_plugin' );
delete_site_transient( 'bestenberg_update_theme' );
