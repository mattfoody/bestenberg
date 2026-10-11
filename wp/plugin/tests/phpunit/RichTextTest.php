<?php
/**
 * Server-side rich text and URL sanitization.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg\Tests\phpunit;

use Bestenberg\Content\RichText;
use WP_UnitTestCase;

final class RichTextTest extends WP_UnitTestCase {

	public function test_keeps_allowed_inline_html(): void {
		$this->assertSame(
			'<strong>b</strong> <em>i</em> <a href="/p" target="_blank" rel="noopener">l</a><br />',
			RichText::sanitize( '<strong>b</strong> <em>i</em> <a href="/p" target="_blank" rel="noopener evil" onclick="x()">l</a><br />' )
		);
		$this->assertSame( '<span class="bb-hl">x</span>', RichText::sanitize( '<span class="bb-hl foo">x</span>' ) );
	}

	/**
	 * Payloads.
	 *
	 * @return array<string, array{0: string}>
	 */
	public static function payloads(): array {
		$list = array(
			'<script>alert(1)</script>',
			'<img src=x onerror=alert(1)>',
			'<svg/onload=alert(1)>',
			'<a href="javascript:alert(1)">x</a>',
			'<a href="java&#115;cript:alert(1)">x</a>',
			'<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>',
			'<span class="bb-x" onmouseover="alert(1)" style="color:red">x</span>',
			'<iframe src="javascript:alert(1)"></iframe>',
			'"><img src=x onerror=alert(1)>',
			'<a href="/ok" target="evil" rel="opener">x</a>',
		);
		return array_combine( $list, array_map( static fn( $p ) => array( $p ), $list ) );
	}

	/**
	 * Hostile input.
	 *
	 * @dataProvider payloads
	 */
	public function test_neutralizes_payloads( string $payload ): void {
		$out = RichText::sanitize( $payload );
		$this->assertDoesNotMatchRegularExpression( '/<(?!\/?(strong|em|a|br|span)\b)/i', $out );
		$this->assertDoesNotMatchRegularExpression( '/\son[a-z]+\s*=/i', $out );
		$this->assertDoesNotMatchRegularExpression( '/javascript:|data:|style=/i', $out );
		$this->assertStringNotContainsString( 'target="evil"', $out );
		$this->assertStringNotContainsString( 'opener"', $out );
	}

	public function test_urls(): void {
		$this->assertSame( 'https://example.com/a?b=1', RichText::url( 'https://example.com/a?b=1' ) );
		$this->assertSame( '/relative', RichText::url( '/relative' ) );
		$this->assertSame( 'mailto:a@example.com', RichText::url( 'mailto:a@example.com' ) );
		$this->assertSame( '', RichText::url( 'javascript:alert(1)' ) );
		$this->assertSame( '', RichText::url( 'data:text/html,x' ) );
	}
}
