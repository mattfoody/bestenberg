<?php
/**
 * License key handling.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg\Tests\phpunit;

use Bestenberg\Licensing\License;
use WP_UnitTestCase;

final class LicenseTest extends WP_UnitTestCase {

	private const BASE = 'https://updates.mattfoody.com/bestenberg/';

	public function test_key_is_sanitized(): void {
		$this->assertSame( '', License::key() );
		$this->assertSame( 'ABCD-1234-efgh', License::sanitize( ' ABCD-1234-efgh ' ) );
		$this->assertSame( 'ab', License::sanitize( 'a<>"b' ) );
		$this->assertSame( '', License::sanitize( array( 'x' ) ) );
		$this->assertSame( License::MAX_LENGTH, strlen( License::sanitize( str_repeat( 'a', 500 ) ) ) );
	}

	public function test_key_is_sent_to_the_update_server_only(): void {
		update_option( License::OPTION, 'KEY-123' );
		$license = new License( self::BASE );

		$args = $license->request_args( array( 'headers' => array( 'Accept' => 'application/json' ) ), self::BASE . 'plugin/info.json' );
		$this->assertSame( 'KEY-123', $args['headers'][ License::HEADER ] );
		$this->assertSame( 'application/json', $args['headers']['Accept'] );

		$this->assertArrayNotHasKey( 'headers', $license->request_args( array(), 'https://example.com/bestenberg/plugin/info.json' ) );
		$this->assertArrayNotHasKey( 'headers', $license->request_args( array(), 'https://updates.mattfoody.com.evil.example/bestenberg/' ) );
	}

	public function test_nothing_is_sent_without_a_key_or_update_url(): void {
		$this->assertArrayNotHasKey( 'headers', ( new License( self::BASE ) )->request_args( array(), self::BASE . 'plugin/info.json' ) );

		update_option( License::OPTION, 'KEY-123' );
		$this->assertArrayNotHasKey( 'headers', ( new License( '' ) )->request_args( array(), self::BASE . 'plugin/info.json' ) );
	}
}
