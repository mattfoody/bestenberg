<?php
/**
 * Renders markup produced by the TypeScript adapter (tests/fixtures/adapter-page.html,
 * generated from packages/adapter-blocks/fixtures/adapter-page.json).
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg\Tests\phpunit;

use WP_HTML_Tag_Processor;
use WP_UnitTestCase;

final class AdapterPageTest extends WP_UnitTestCase {

	private static function render(): string {
		return do_blocks( (string) file_get_contents( BESTENBERG_DIR . 'tests/fixtures/adapter-page.html' ) );
	}

	/**
	 * Class attribute of the first element matching a query.
	 *
	 * @param array<string, string> $query Tag processor query.
	 */
	private static function class_of( string $html, array $query ): ?string {
		$tags = new WP_HTML_Tag_Processor( $html );
		while ( $tags->next_tag( $query ) ) {
			$class = $tags->get_attribute( 'class' );
			return is_string( $class ) ? $class : '';
		}
		return null;
	}

	public function test_renders_without_leftover_block_comments(): void {
		$html = self::render();
		$this->assertStringNotContainsString( '<!-- wp:', $html );
		$this->assertStringNotContainsString( 'bestenberg/', $html );
	}

	public function test_bestenberg_blocks_render_with_classes(): void {
		$html = self::render();
		$tags = new WP_HTML_Tag_Processor( $html );
		$this->assertTrue( $tags->next_tag( array( 'tag_name' => 'section' ) ) );
		$this->assertSame( 'adapter-hero', $tags->get_attribute( 'id' ) );
		$this->assertSame(
			'bb-section bb:px-6 bb:py-16 bb:bg-primary bb:text-on-primary bb:lg:py-24',
			$tags->get_attribute( 'class' )
		);
		$this->assertSame(
			'bb-grid bb:grid bb:grid-cols-1 bb:gap-6 bb:md:grid-cols-2 bb:lg:grid-cols-3',
			self::class_of( $html, array( 'class_name' => 'bb-grid' ) )
		);
		$this->assertSame( 3, substr_count( $html, '<article ' ) );
		$this->assertStringContainsString( 'bb-spacer bb:h-8', $html );
	}

	public function test_core_blocks_render_with_classes_from_bestenberg_data(): void {
		$html = self::render();
		$this->assertSame(
			'wp-block-heading bb:text-4xl bb:font-bold bb:text-center bb:lg:text-5xl',
			self::class_of( $html, array( 'tag_name' => 'h1' ) )
		);
		$this->assertStringContainsString(
			'bb:bg-accent',
			(string) self::class_of( $html, array( 'class_name' => 'wp-block-button__link' ) )
		);
		$this->assertStringContainsString( 'bb:rounded-md', (string) self::class_of( $html, array( 'tag_name' => 'img' ) ) );
		$this->assertStringContainsString( 'bb:lg:hidden', $html );
		$this->assertStringContainsString( '<cite>Ada Lovelace</cite>', $html );
		$this->assertStringContainsString( '<ol class="wp-block-list', $html );
	}

	public function test_raw_blocks_render_as_their_own_block(): void {
		$this->assertStringContainsString( 'Inside a group Bestenberg does not edit.', self::render() );
	}
}
