<?php
/**
 * Bestenberg blocks: registration, rendering, TS/PHP parity, security.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg\Tests\phpunit;

use Bestenberg\Blocks\LayoutBlocks;
use Bestenberg\Plugin;
use Bestenberg\Styles\Collector;
use Bestenberg\Styles\StyleClasses;
use Bestenberg\Styles\Utilities;
use WP_Block_Type_Registry;
use WP_HTML_Tag_Processor;
use WP_UnitTestCase;

final class BlocksTest extends WP_UnitTestCase {

	private const BLOCKS = array(
		'bestenberg/section',
		'bestenberg/container',
		'bestenberg/stack',
		'bestenberg/row',
		'bestenberg/grid',
		'bestenberg/card',
		'bestenberg/spacer',
	);

	/**
	 * First element of rendered HTML: [tag, attributes].
	 *
	 * @return array{0: string, 1: WP_HTML_Tag_Processor}
	 */
	private static function first_tag( string $html ): array {
		$tags = new WP_HTML_Tag_Processor( $html );
		$tags->next_tag();
		return array( (string) $tags->get_tag(), $tags );
	}

	public function test_all_blocks_are_registered_dynamic_with_bestenberg_attributes(): void {
		$registry = WP_Block_Type_Registry::get_instance();
		foreach ( self::BLOCKS as $name ) {
			$type = $registry->get_registered( $name );
			$this->assertNotNull( $type, $name );
			$this->assertTrue( $type->is_dynamic(), $name );
			foreach ( array( 'bbId', 'props', 'style', 'bind', 'locked', 'hidden' ) as $attribute ) {
				$this->assertArrayHasKey( $attribute, $type->attributes, "$name.$attribute" );
			}
			$this->assertContains( LayoutBlocks::EDITOR_SCRIPT, $type->editor_script_handles, $name );
		}
	}

	public function test_classes_match_typescript_for_every_parity_case(): void {
		$utilities = Utilities::shared();
		$styles    = new StyleClasses( $utilities );
		$blocks    = new LayoutBlocks( LayoutBlocks::config()['blocks'], $styles, new Collector( $utilities ) );
		$cases     = json_decode( (string) file_get_contents( BESTENBERG_DIR . 'tests/fixtures/style-classes.json' ), true );

		$this->assertGreaterThan( 500, count( $cases ) );
		foreach ( $cases as $i => $case ) {
			$actual = isset( $case['block'] )
				? $blocks->classes( $case['block'], $case['style'] ?? null, $case['hidden'] ?? null )
				: $styles->for_node( $case['style'] ?? null, $case['hidden'] ?? null );
			$this->assertSame( $case['classes'], $actual, "parity case $i: " . wp_json_encode( $case ) );
		}
	}

	public function test_section_renders_tag_anchor_classes_and_inner_blocks(): void {
		$html = do_blocks(
			'<!-- wp:bestenberg/section {"bbId":"s1","props":{"tag":"header","anchor":"top"},"style":{"base":{"padding":{"y":"space.8"}},"desktop":{"padding":{"y":"space.16"}}},"hidden":{"base":true}} -->' . "\n"
			. '<!-- wp:bestenberg/spacer {"bbId":"sp1","style":{"base":{"height":"space.4"}}} /-->' . "\n"
			. '<!-- /wp:bestenberg/section -->'
		);

		[ $tag, $section ] = self::first_tag( $html );
		$this->assertSame( 'HEADER', $tag );
		$this->assertSame( 'top', $section->get_attribute( 'id' ) );
		$this->assertSame( 'bb-section bb:py-8 bb:lg:py-16 bb:max-md:hidden', $section->get_attribute( 'class' ) );

		$this->assertTrue( $section->next_tag() );
		$this->assertSame( 'DIV', $section->get_tag() );
		$this->assertSame( 'bb-spacer bb:h-4', $section->get_attribute( 'class' ) );
		$this->assertSame( 'true', $section->get_attribute( 'aria-hidden' ) );
		$this->assertStringEndsWith( '</header>', trim( $html ) );
	}

	public function test_layout_blocks_get_their_implied_display(): void {
		foreach (
			array(
				'stack' => 'bb-stack bb:flex bb:flex-col bb:gap-4',
				'row'   => 'bb-row bb:flex bb:flex-row bb:gap-4',
				'grid'  => 'bb-grid bb:grid bb:gap-4',
			) as $type => $expected
		) {
			[ , $tags ] = self::first_tag( do_blocks( "<!-- wp:bestenberg/$type {\"bbId\":\"x\",\"style\":{\"base\":{\"layout\":{\"gap\":\"space.4\"}}}} /-->" ) );
			$this->assertSame( $expected, $tags->get_attribute( 'class' ), $type );
		}
	}

	public function test_card_accepts_only_whitelisted_tags(): void {
		[ $tag ] = self::first_tag( do_blocks( '<!-- wp:bestenberg/card {"bbId":"c","props":{"tag":"article"}} /-->' ) );
		$this->assertSame( 'ARTICLE', $tag );
		[ $tag ] = self::first_tag( do_blocks( '<!-- wp:bestenberg/card {"bbId":"c","props":{"tag":"main"}} /-->' ) );
		$this->assertSame( 'DIV', $tag );
	}

	public function test_hostile_attributes_cannot_inject_markup(): void {
		$html = do_blocks(
			'<!-- wp:bestenberg/section {"bbId":"x","props":{"tag":"script","anchor":"a\\u0022 onmouseover=\\u0022alert(1)"},'
			. '"style":{"base":{"padding":{"y":"\\u0022\\u003e\\u003cscript\\u003ealert(1)\\u003c/script\\u003e"},"layout":{"align":"x onload=alert(1)"},"background":{"image":{"url":"javascript:alert(1)"}}},"tablet":"nope"},'
			. '"hidden":{"desktop":"\\u003cb\\u003e"}} /-->'
		);

		$this->assertStringNotContainsString( '<script', $html );
		$this->assertStringNotContainsString( 'onmouseover', $html );
		$this->assertStringNotContainsString( 'onload', $html );
		$this->assertStringNotContainsString( 'javascript:', $html );
		[ $tag, $tags ] = self::first_tag( $html );
		$this->assertSame( 'SECTION', $tag );
		$this->assertNull( $tags->get_attribute( 'id' ) );
		$this->assertSame( 'bb-section bb:bg-cover bb:lg:hidden', $tags->get_attribute( 'class' ) );
	}

	public function test_rendering_records_utilities_for_style_output(): void {
		do_blocks( '<!-- wp:bestenberg/grid {"bbId":"g","style":{"base":{"layout":{"columns":4}}}} /-->' );
		$recorded = Plugin::instance()->collector()->all();
		$this->assertContains( 'bb:grid', $recorded );
		$this->assertContains( 'bb:grid-cols-4', $recorded );
		$this->assertNotContains( 'bb-grid', $recorded );
	}
}
