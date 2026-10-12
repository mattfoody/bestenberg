<?php
/**
 * Self-hosted updates.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg\Tests\phpunit;

use Bestenberg\Updates\Updater;
use WP_UnitTestCase;

final class UpdaterTest extends WP_UnitTestCase {

	private const BASE = 'https://updates.mattfoody.com/bestenberg/';

	/**
	 * Responses by URL for the fake HTTP layer.
	 *
	 * @var array<string, array{0: int, 1: string}>
	 */
	private array $responses = array();

	private int $requests = 0;

	public function set_up(): void {
		parent::set_up();
		delete_site_transient( 'bestenberg_update_plugin' );
		delete_site_transient( 'bestenberg_update_theme' );
		$this->responses = array();
		$this->requests  = 0;
		add_filter( 'pre_http_request', array( $this, 'fake_http' ), 10, 3 );
	}

	public function tear_down(): void {
		remove_filter( 'pre_http_request', array( $this, 'fake_http' ) );
		parent::tear_down();
	}

	public function fake_http( $preempt, array $args, string $url ) {
		++$this->requests;
		if ( ! isset( $this->responses[ $url ] ) ) {
			return new \WP_Error( 'http_request_failed', 'offline' );
		}
		[ $code, $body ] = $this->responses[ $url ];
		return array(
			'headers'  => array(),
			'body'     => $body,
			'response' => array(
				'code'    => $code,
				'message' => 'x',
			),
			'cookies'  => array(),
			'filename' => null,
		);
	}

	private function info( string $kind, array $overrides = array() ): void {
		$file = 'theme' === $kind ? 'bestenberg-theme-9.9.9.zip' : 'bestenberg-9.9.9.zip';
		$body = array(
			'name'         => 'Bestenberg',
			'version'      => '9.9.9',
			'download_url' => self::BASE . "$kind/$file",
			'homepage'     => 'https://mattfoody.com',
			'requires'     => '7.1',
			'requires_php' => '8.1',
			'tested'       => '7.1',
			'last_updated' => '2026-10-12 10:00:00',
			'sections'     => array( 'changelog' => '<ul><li>New</li></ul><script>x</script>' ),
		);

		$this->responses[ self::BASE . "$kind/info.json" ] = array( 200, (string) wp_json_encode( array_merge( $body, $overrides ) ) );
	}

	private function updater(): Updater {
		return new Updater( self::BASE, 'bestenberg/bestenberg.php' );
	}

	public function test_reads_base_url_from_plugin_header(): void {
		$updater = Updater::from_plugin_header();
		$this->assertNotNull( $updater );
		$this->assertNotFalse( has_filter( 'update_plugins_updates.mattfoody.com' ) );
		$this->assertNotFalse( has_filter( 'update_themes_updates.mattfoody.com' ) );
	}

	public function test_plugin_update_from_info_json(): void {
		$this->info( 'plugin' );
		$update = $this->updater()->plugin_update( false, array(), 'bestenberg/bestenberg.php' );
		$this->assertIsArray( $update );
		$this->assertSame( '9.9.9', $update['version'] );
		$this->assertSame( self::BASE . 'plugin/bestenberg-9.9.9.zip', $update['package'] );
		$this->assertSame( '8.1', $update['requires_php'] );
	}

	public function test_ignores_other_plugins(): void {
		$this->info( 'plugin' );
		$this->assertFalse( $this->updater()->plugin_update( false, array(), 'akismet/akismet.php' ) );
		$this->assertSame( 0, $this->requests );
	}

	public function test_theme_update_from_info_json(): void {
		$this->info( 'theme' );
		$update = $this->updater()->theme_update( false, array(), 'bestenberg' );
		$this->assertSame( self::BASE . 'theme/bestenberg-theme-9.9.9.zip', $update['package'] );
		$this->assertFalse( $this->updater()->theme_update( false, array(), 'twentytwentyfive' ) );
	}

	public function test_rejects_packages_outside_the_update_url(): void {
		foreach ( array( 'https://evil.example/bestenberg.zip', 'http://updates.mattfoody.com/bestenberg/plugin/x.zip', self::BASE . '../../x.zip' ) as $url ) {
			delete_site_transient( 'bestenberg_update_plugin' );
			$this->info( 'plugin', array( 'download_url' => $url ) );
			$this->assertFalse( $this->updater()->plugin_update( false, array(), 'bestenberg/bestenberg.php' ), $url );
		}
	}

	public function test_rejects_malformed_versions(): void {
		$this->info( 'plugin', array( 'version' => '1.0; rm -rf' ) );
		$this->assertFalse( $this->updater()->plugin_update( false, array(), 'bestenberg/bestenberg.php' ) );
	}

	public function test_caches_results_and_failures(): void {
		$this->info( 'plugin' );
		$updater = $this->updater();
		$updater->plugin_update( false, array(), 'bestenberg/bestenberg.php' );
		$updater->plugin_update( false, array(), 'bestenberg/bestenberg.php' );
		$this->assertSame( 1, $this->requests );

		$this->responses = array();
		$updater->flush();
		$this->assertFalse( $updater->plugin_update( false, array(), 'bestenberg/bestenberg.php' ) );
		$this->assertFalse( $updater->plugin_update( false, array(), 'bestenberg/bestenberg.php' ) );
		$this->assertSame( 2, $this->requests );
	}

	public function test_plugin_information_for_view_details(): void {
		$this->info( 'plugin' );
		$result = $this->updater()->plugin_information( false, 'plugin_information', (object) array( 'slug' => 'bestenberg' ) );
		$this->assertIsObject( $result );
		$this->assertSame( '9.9.9', $result->version );
		$this->assertSame( '<ul><li>New</li></ul>x', $result->sections['changelog'] );
		$this->assertFalse( $this->updater()->plugin_information( false, 'plugin_information', (object) array( 'slug' => 'other' ) ) );
	}
}
