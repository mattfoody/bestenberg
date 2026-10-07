<?php
/**
 * Style runtime tests: utility map, collector, output.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg\Tests\phpunit;

use Bestenberg\Styles\Collector;
use Bestenberg\Styles\StyleOutput;
use Bestenberg\Styles\Utilities;
use WP_UnitTestCase;

final class StylesTest extends WP_UnitTestCase {

	private Utilities $utilities;

	public function set_up(): void {
		parent::set_up();
		$this->utilities = Utilities::shared();
		wp_cache_flush();
	}

	public function tear_down(): void {
		foreach ( array( StyleOutput::TOKENS_HANDLE, StyleOutput::UTILITIES_HANDLE, StyleOutput::LATE_HANDLE ) as $handle ) {
			wp_dequeue_style( $handle );
			wp_deregister_style( $handle );
		}
		parent::tear_down();
	}

	public function test_map_matches_generated_json(): void {
		$json = json_decode( (string) file_get_contents( BESTENBERG_DIR . 'generated/utilities.map.json' ), true );
		$this->assertSame( count( $json['rules'] ), $this->utilities->count() );
		$this->assertTrue( $this->utilities->has( 'bb:md:py-4' ) );
		$this->assertFalse( $this->utilities->has( 'bb:py-13px' ) );
	}

	public function test_css_for_matches_typescript_for_every_class(): void {
		// utilities.css is cssForClasses(all) from @bestenberg/tokens, after a one-line header.
		$generated = (string) file_get_contents( BESTENBERG_DIR . 'generated/utilities.css' );
		$expected  = trim( substr( $generated, strpos( $generated, "\n" ) + 1 ) );
		$json      = json_decode( (string) file_get_contents( BESTENBERG_DIR . 'generated/utilities.map.json' ), true );

		$this->assertSame( $expected, $this->utilities->css_for( array_reverse( array_keys( $json['rules'] ) ) ) );
	}

	public function test_css_for_groups_media_in_cascade_order_and_ignores_unknown(): void {
		$css = $this->utilities->css_for( array( 'bb:lg:py-8', 'nope', 'bb:md:py-6', 'bb:py-4', 'bb:md:px-4' ) );
		$this->assertSame(
			'.bb\:py-4{padding-block:var(--bb-space-4)}' . "\n"
			. '@media (min-width: 768px){.bb\:md\:px-4{padding-inline:var(--bb-space-4)}.bb\:md\:py-6{padding-block:var(--bb-space-6)}}' . "\n"
			. '@media (min-width: 1024px){.bb\:lg\:py-8{padding-block:var(--bb-space-8)}}',
			$css
		);
		$this->assertSame( '', $this->utilities->css_for( array( 'nope' ) ) );
	}

	public function test_collector_keeps_only_known_utilities(): void {
		$collector = new Collector( $this->utilities );
		$collector->record_class_string( "wp-block-group  bb:py-4\nbb:nope bb:lg:grid-cols-3" );
		$collector->record( array( 'bb:py-4', 'bb:bg-primary' ) );
		$this->assertSame( array( 'bb:bg-primary', 'bb:lg:grid-cols-3', 'bb:py-4' ), $collector->all() );
	}

	public function test_collector_reads_classes_from_html(): void {
		$collector = new Collector( $this->utilities );
		$collector->record_html( '<div class="x bb:py-4"><p class="bb:text-lg">Hi</p><span>no classes</span></div>' );
		$this->assertSame( array( 'bb:py-4', 'bb:text-lg' ), $collector->all() );
	}

	public function test_take_unprinted_returns_each_class_once(): void {
		$collector = new Collector( $this->utilities );
		$collector->record( array( 'bb:py-4' ) );
		$this->assertSame( array( 'bb:py-4' ), $collector->take_unprinted() );
		$collector->record( array( 'bb:py-4', 'bb:px-4' ) );
		$this->assertSame( array( 'bb:px-4' ), $collector->take_unprinted() );
		$this->assertSame( array(), $collector->take_unprinted() );
	}

	public function test_render_block_collects_class_name_attribute(): void {
		$collector = new Collector( $this->utilities );
		$output    = new StyleOutput( $collector, $this->utilities );
		$html      = '<p class="bb:py-4">x</p>';

		$this->assertSame(
			$html,
			$output->collect_block( $html, array( 'attrs' => array( 'className' => 'foo bb:py-4 bb:md:py-8' ) ) )
		);
		$output->collect_block( '', array( 'attrs' => array() ) );
		$this->assertSame( array( 'bb:md:py-8', 'bb:py-4' ), $collector->all() );
	}

	public function test_enqueue_adds_tokens_and_only_used_utilities(): void {
		$collector = new Collector( $this->utilities );
		$output    = new StyleOutput( $collector, $this->utilities );
		$collector->record( array( 'bb:py-4', 'bb:lg:grid-cols-3' ) );

		$output->enqueue();

		$this->assertTrue( wp_style_is( StyleOutput::TOKENS_HANDLE, 'enqueued' ) );
		$this->assertTrue( wp_style_is( StyleOutput::UTILITIES_HANDLE, 'enqueued' ) );
		$inline = implode( '', (array) wp_styles()->get_data( StyleOutput::UTILITIES_HANDLE, 'after' ) );
		$this->assertStringContainsString( '.bb\:py-4{', $inline );
		$this->assertStringContainsString( '.bb\:lg\:grid-cols-3{', $inline );
		$this->assertStringNotContainsString( '.bb\:px-4{', $inline );
	}

	public function test_late_output_contains_only_new_classes(): void {
		$collector = new Collector( $this->utilities );
		$output    = new StyleOutput( $collector, $this->utilities );
		$collector->record( array( 'bb:py-4' ) );
		$output->enqueue();
		$collector->record( array( 'bb:py-4', 'bb:px-4' ) );

		$output->enqueue_late();

		$late = implode( '', (array) wp_styles()->get_data( StyleOutput::LATE_HANDLE, 'after' ) );
		$this->assertStringContainsString( '.bb\:px-4{', $late );
		$this->assertStringNotContainsString( '.bb\:py-4{', $late );
	}

	public function test_nothing_is_enqueued_without_classes(): void {
		$output = new StyleOutput( new Collector( $this->utilities ), $this->utilities );
		$output->enqueue();
		$this->assertTrue( wp_style_is( StyleOutput::TOKENS_HANDLE, 'enqueued' ) );
		$this->assertFalse( wp_style_is( StyleOutput::UTILITIES_HANDLE, 'registered' ) );
	}

	public function test_css_is_cached_by_class_set(): void {
		$output  = new StyleOutput( new Collector( $this->utilities ), $this->utilities );
		$classes = array( 'bb:py-4' );
		$css     = $output->css_for( $classes );
		$key     = 'utilities:' . BESTENBERG_VERSION . ':' . md5( 'bb:py-4' );
		$this->assertSame( $css, wp_cache_get( $key, StyleOutput::CACHE_GROUP ) );
	}

	public function test_plugin_registers_style_hooks(): void {
		$this->assertNotFalse( has_filter( 'render_block' ) );
		$this->assertNotFalse( has_action( 'wp_enqueue_scripts' ) );
	}
}
