<?php
/**
 * Frontend style output.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg\Styles;

/**
 * Enqueues token variables and prints only the utility rules a page uses.
 *
 * Block themes render the template before `wp_head`, so by `wp_enqueue_scripts`
 * every block's classes are already collected and go out as one inline style in
 * <head>. Anything rendered later (classic themes, footer widgets) is printed by
 * a late inline style in the footer.
 */
final class StyleOutput {

	public const TOKENS_HANDLE    = 'bestenberg-tokens';
	public const UTILITIES_HANDLE = 'bestenberg-utilities';
	public const LATE_HANDLE      = 'bestenberg-utilities-late';
	public const CACHE_GROUP      = 'bestenberg';

	/**
	 * Constructor.
	 *
	 * @param Collector $collector Class collector for this request.
	 * @param Utilities $utilities Utility map.
	 */
	public function __construct(
		private Collector $collector,
		private Utilities $utilities
	) {}

	/**
	 * Registers hooks.
	 */
	public function register(): void {
		add_filter( 'render_block', array( $this, 'collect_block' ), 10, 2 );
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue' ), 20 );
		add_action( 'wp_footer', array( $this, 'enqueue_late' ), 10 );
	}

	/**
	 * Records utility classes from a block's className attribute.
	 *
	 * @param string               $block_content Rendered block HTML (returned unchanged).
	 * @param array<string, mixed> $block         Parsed block.
	 */
	public function collect_block( string $block_content, array $block ): string {
		$attrs = $block['attrs'] ?? null;
		if ( is_array( $attrs ) && isset( $attrs['className'] ) && is_string( $attrs['className'] ) ) {
			$this->collector->record_class_string( $attrs['className'] );
		}
		return $block_content;
	}

	/**
	 * Enqueues token variables and the utilities collected so far.
	 */
	public function enqueue(): void {
		wp_enqueue_style(
			self::TOKENS_HANDLE,
			BESTENBERG_URL . 'generated/variables.css',
			array(),
			BESTENBERG_VERSION
		);
		$this->add_inline( self::UTILITIES_HANDLE );
	}

	/**
	 * Enqueues utilities first seen after <head> was printed.
	 */
	public function enqueue_late(): void {
		$this->add_inline( self::LATE_HANDLE );
	}

	/**
	 * CSS for a set of classes, cached by the class set's hash.
	 *
	 * @param string[] $classes Sorted class names.
	 */
	public function css_for( array $classes ): string {
		if ( array() === $classes ) {
			return '';
		}
		$key = 'utilities:' . BESTENBERG_VERSION . ':' . md5( implode( ' ', $classes ) );
		$css = wp_cache_get( $key, self::CACHE_GROUP );
		if ( ! is_string( $css ) ) {
			$css = $this->utilities->css_for( $classes );
			wp_cache_set( $key, $css, self::CACHE_GROUP, DAY_IN_SECONDS );
		}
		return $css;
	}

	/**
	 * Adds an inline style for classes not printed yet.
	 *
	 * @param string $handle Style handle.
	 */
	private function add_inline( string $handle ): void {
		$css = $this->css_for( $this->collector->take_unprinted() );
		if ( '' === $css ) {
			return;
		}
		wp_register_style( $handle, false, array( self::TOKENS_HANDLE ), BESTENBERG_VERSION );
		wp_add_inline_style( $handle, $css );
		wp_enqueue_style( $handle );
	}
}
