<?php
/**
 * Tests for the demo site importer.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg\Tests\phpunit;

use Bestenberg\Demo\Importer;
use WP_REST_Request;
use WP_UnitTestCase;

final class DemoTest extends WP_UnitTestCase {

	public function test_import_creates_pages_and_a_front_page(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		update_option( 'show_on_front', 'posts' );

		$result = Importer::run();

		$this->assertIsArray( $result );
		$this->assertCount( 4, $result['pages'] );
		foreach ( $result['pages'] as $page ) {
			$this->assertTrue( $page['created'] );
			$this->assertSame( 'publish', get_post_status( $page['id'] ) );
		}
		$this->assertSame( 'page', get_option( 'show_on_front' ) );
		$this->assertSame( $result['front'], (int) get_option( 'page_on_front' ) );

		$home = get_post( $result['front'] );
		$this->assertStringContainsString( '<!-- wp:bestenberg/section {"bbId":"demo-home-0001"', $home->post_content );
		$this->assertStringContainsString( BESTENBERG_URL . 'demo/loaves.svg', $home->post_content );
		$this->assertStringNotContainsString( 'bestenberg.invalid', $home->post_content );

		$html = do_blocks( $home->post_content );
		$this->assertStringContainsString( 'Bread worth waking up for', $html );
		$this->assertStringContainsString( 'bb-section', $html );
	}

	public function test_import_does_not_overwrite_or_duplicate(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$first = Importer::run();
		$this->assertIsArray( $first );
		wp_update_post(
			array(
				'ID'           => $first['front'],
				'post_content' => 'Edited by the site owner',
			)
		);
		$other_front = self::factory()->post->create( array( 'post_type' => 'page' ) );
		update_option( 'page_on_front', $other_front );

		$second = Importer::run();

		$this->assertIsArray( $second );
		$this->assertSame( array_column( $first['pages'], 'id' ), array_column( $second['pages'], 'id' ) );
		$this->assertNotContains( true, array_column( $second['pages'], 'created' ) );
		$this->assertSame( 'Edited by the site owner', get_post( $first['front'] )->post_content );
		$this->assertSame( $other_front, (int) get_option( 'page_on_front' ) );
	}

	public function test_rest_route_is_for_designers(): void {
		$request = new WP_REST_Request( 'POST', '/bestenberg/v1/demo' );

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );
		$this->assertSame( 403, rest_get_server()->dispatch( $request )->get_status() );

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$response = rest_get_server()->dispatch( $request );
		$this->assertSame( 200, $response->get_status() );
		$this->assertCount( 4, $response->get_data()['pages'] );
	}
}
