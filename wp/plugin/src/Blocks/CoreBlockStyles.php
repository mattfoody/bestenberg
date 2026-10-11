<?php
/**
 * Utility classes for core blocks.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg\Blocks;

use Bestenberg\Styles\Collector;
use Bestenberg\Styles\StyleClasses;

/**
 * Core blocks keep their own saved HTML; Bestenberg's style for them lives in
 * the `bestenberg` attribute and is turned into classes at render time, so
 * saved content never contains utility class names.
 */
final class CoreBlockStyles {

	/**
	 * Constructor.
	 *
	 * @param array<string, array{type: string, target: string|null}> $core          Core block name => config.
	 * @param StyleClasses                                            $style_classes Style mapper.
	 * @param Collector                                               $collector     Request class collector.
	 */
	public function __construct(
		private array $core,
		private StyleClasses $style_classes,
		private Collector $collector
	) {}

	/**
	 * Registers hooks.
	 */
	public function register(): void {
		add_filter( 'render_block', array( $this, 'apply' ), 10, 2 );
	}

	/**
	 * Adds utility classes to the block's target element.
	 *
	 * @param string               $block_content Rendered block HTML.
	 * @param array<string, mixed> $block         Parsed block.
	 */
	public function apply( string $block_content, array $block ): string {
		$name = $block['blockName'] ?? null;
		if ( ! is_string( $name ) || ! isset( $this->core[ $name ] ) || '' === $block_content ) {
			return $block_content;
		}
		$attrs = is_array( $block['attrs'] ?? null ) ? $block['attrs'] : array();
		$meta  = $attrs['bestenberg'] ?? null;
		if ( ! is_array( $meta ) ) {
			return $block_content;
		}

		$classes = $this->style_classes->for_node( $meta['style'] ?? null, $meta['hidden'] ?? null );
		if ( array() === $classes ) {
			return $block_content;
		}

		$tags = new \WP_HTML_Tag_Processor( $block_content );
		if ( ! self::seek( $tags, $this->core[ $name ]['target'] ) ) {
			return $block_content;
		}
		foreach ( $classes as $class_name ) {
			$tags->add_class( $class_name );
		}
		$this->collector->record( $classes );
		return $tags->get_updated_html();
	}

	/**
	 * Moves to the element that receives classes.
	 *
	 * @param \WP_HTML_Tag_Processor $tags   Processor.
	 * @param string|null            $target `.class`, tag name, or null for the first tag.
	 */
	private static function seek( \WP_HTML_Tag_Processor $tags, ?string $target ): bool {
		if ( null === $target ) {
			return $tags->next_tag();
		}
		if ( str_starts_with( $target, '.' ) ) {
			return $tags->next_tag( array( 'class_name' => substr( $target, 1 ) ) );
		}
		return $tags->next_tag( array( 'tag_name' => $target ) );
	}
}
