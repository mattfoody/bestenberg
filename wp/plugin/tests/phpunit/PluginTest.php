<?php
/**
 * Plugin bootstrap tests.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg\Tests\phpunit;

use Bestenberg\Admin\EditorPage;
use Bestenberg\Plugin;
use WP_UnitTestCase;

final class PluginTest extends WP_UnitTestCase {

	public function test_constants_are_defined(): void {
		$this->assertSame( '0.1.0', BESTENBERG_VERSION );
		$this->assertDirectoryExists( BESTENBERG_DIR );
	}

	public function test_plugin_registers_on_plugins_loaded(): void {
		$this->assertTrue( Plugin::instance()->is_registered() );
	}

	public function test_register_is_idempotent(): void {
		$before = has_action( 'admin_menu' );
		Plugin::instance()->register();
		$this->assertSame( $before, has_action( 'admin_menu' ) );
	}

	public function test_editor_page_is_added_for_admins(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
		set_current_screen( 'dashboard' );

		$page = new EditorPage();
		$page->add_menu_page();

		$this->assertNotEmpty( menu_page_url( EditorPage::SLUG, false ) );
	}

	public function test_render_prints_mount_point_when_assets_exist(): void {
		if ( ! is_readable( BESTENBERG_DIR . 'build/editor/index.asset.php' ) ) {
			$this->markTestSkipped( 'Editor assets not built.' );
		}

		ob_start();
		( new EditorPage() )->render();
		$html = (string) ob_get_clean();

		$this->assertStringContainsString( 'id="bestenberg-root"', $html );
	}
}
