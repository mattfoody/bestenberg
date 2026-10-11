<?php
/**
 * Style → utility classes.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg\Styles;

/**
 * Maps a node's responsive `style` and `hidden` to utility classes. Mirrors
 * styleToClasses()/visibilityClasses() in @bestenberg/schema; parity is
 * tested against fixtures generated from TypeScript.
 *
 * Input comes from block attributes and is untrusted: any value that does not
 * produce a known utility class is ignored, so nothing but generated class
 * names can reach the HTML.
 */
final class StyleClasses {

	/**
	 * Breakpoint => class variant prefix.
	 */
	private const VARIANTS = array(
		'base'    => '',
		'tablet'  => 'md:',
		'desktop' => 'lg:',
	);

	/**
	 * Constructor.
	 *
	 * @param Utilities $utilities Known utilities.
	 */
	public function __construct( private Utilities $utilities ) {}

	/**
	 * Known utility classes for a node: style first, then visibility.
	 *
	 * @param mixed $style  Responsive style (`base`, `tablet`, `desktop`).
	 * @param mixed $hidden Visibility per breakpoint.
	 * @return string[]
	 */
	public function for_node( mixed $style, mixed $hidden ): array {
		return $this->known( array_merge( $this->for_style( $style ), $this->visibility( $hidden ) ) );
	}

	/**
	 * Candidate classes for a responsive style (not yet filtered).
	 *
	 * @param mixed $style Responsive style.
	 * @return string[]
	 */
	public function for_style( mixed $style ): array {
		if ( ! is_array( $style ) ) {
			return array();
		}
		$out = array();
		foreach ( self::VARIANTS as $breakpoint => $variant ) {
			if ( isset( $style[ $breakpoint ] ) && is_array( $style[ $breakpoint ] ) ) {
				$out = array_merge( $out, $this->for_breakpoint( $style[ $breakpoint ], $variant ) );
			}
		}
		return $out;
	}

	/**
	 * Visibility classes.
	 *
	 * @param mixed $hidden Visibility per breakpoint.
	 * @return string[]
	 */
	public function visibility( mixed $hidden ): array {
		if ( ! is_array( $hidden ) ) {
			return array();
		}
		$out = array();
		foreach ( array_keys( self::VARIANTS ) as $breakpoint ) {
			$name = $this->utilities->hidden_class( $breakpoint );
			if ( ! empty( $hidden[ $breakpoint ] ) && null !== $name ) {
				$out[] = $name;
			}
		}
		return $out;
	}

	/**
	 * Keeps known utilities only, deduplicated, first occurrence wins.
	 *
	 * @param array<mixed> $classes Candidate classes.
	 * @return string[]
	 */
	public function known( array $classes ): array {
		$out = array();
		foreach ( $classes as $class_name ) {
			if ( is_string( $class_name ) && $this->utilities->has( $class_name ) && ! in_array( $class_name, $out, true ) ) {
				$out[] = $class_name;
			}
		}
		return $out;
	}

	/**
	 * Token name of a reference: "space.4" => "4".
	 *
	 * @param mixed $ref Token reference.
	 */
	private static function token( mixed $ref ): ?string {
		if ( ! is_string( $ref ) || '' === $ref ) {
			return null;
		}
		$dot = strpos( $ref, '.' );
		return false === $dot ? $ref : substr( $ref, $dot + 1 );
	}

	/**
	 * Non-empty string or null.
	 *
	 * @param mixed $value Value.
	 */
	private static function word( mixed $value ): ?string {
		return is_string( $value ) && '' !== $value ? $value : null;
	}

	/**
	 * Classes for one breakpoint. Same order as styleClasses() in TS.
	 *
	 * @param array<mixed> $style   Style for one breakpoint.
	 * @param string       $variant '', 'md:' or 'lg:'.
	 * @return string[]
	 */
	private function for_breakpoint( array $style, string $variant ): array {
		$out = array();
		$add = static function ( ?string $base ) use ( &$out, $variant ): void {
			if ( null !== $base ) {
				$out[] = 'bb:' . $variant . $base;
			}
		};
		$tok = static fn( string $prefix, mixed $ref ): ?string => null === self::token( $ref ) ? null : $prefix . self::token( $ref );

		$layout = $style['layout'] ?? null;
		if ( is_array( $layout ) ) {
			foreach ( self::layout_bases( $layout ) as $base ) {
				$add( $base );
			}
		}

		$width = $style['width'] ?? null;
		if ( 'auto' === $width ) {
			$add( 'w-auto' );
		} elseif ( 'full' === $width ) {
			$add( 'w-full' );
		} else {
			$add( $tok( 'container-', $width ) );
		}
		$add( $tok( 'h-', $style['height'] ?? null ) );

		$padding = is_array( $style['padding'] ?? null ) ? $style['padding'] : array();
		$add( $tok( 'px-', $padding['x'] ?? null ) );
		$add( $tok( 'py-', $padding['y'] ?? null ) );
		$margin = is_array( $style['margin'] ?? null ) ? $style['margin'] : array();
		$add( $tok( 'mt-', $margin['top'] ?? null ) );
		$add( $tok( 'mb-', $margin['bottom'] ?? null ) );

		$background = $style['background'] ?? null;
		if ( is_string( $background ) ) {
			$add( $tok( 'bg-', $background ) );
		} elseif ( is_array( $background ) ) {
			$add( 'bg-cover' );
			$add( $tok( 'overlay-', $background['overlay'] ?? null ) );
		}
		$add( $tok( 'text-', $style['color'] ?? null ) );

		$font = $style['font'] ?? null;
		if ( is_array( $font ) ) {
			$add( $tok( 'font-', $font['family'] ?? null ) );
			$add( $tok( 'text-', $font['size'] ?? null ) );
			$add( $tok( 'font-', $font['weight'] ?? null ) );
			$add( $tok( 'leading-', $font['lineHeight'] ?? null ) );
			$align = self::word( $font['align'] ?? null );
			$add( null === $align ? null : 'text-' . $align );
		}

		$add( $tok( 'rounded-', $style['radius'] ?? null ) );
		$add( $tok( 'shadow-', $style['shadow'] ?? null ) );
		$border = is_array( $style['border'] ?? null ) ? $style['border'] : array();
		if ( isset( $border['width'] ) && is_int( $border['width'] ) ) {
			$add( 'border-' . $border['width'] );
		}
		$add( $tok( 'border-', $border['color'] ?? null ) );

		$aspect = self::word( $style['aspect'] ?? null );
		$add( null === $aspect ? null : $this->utilities->aspect_name( $aspect ) );

		return $out;
	}

	/**
	 * Utility base names for a layout value. Same order as styleClasses() in TS.
	 *
	 * @param array<mixed> $layout Layout style.
	 * @return array<string|null>
	 */
	private static function layout_bases( array $layout ): array {
		$display = $layout['display'] ?? null;
		$out     = match ( $display ) {
			'stack' => array( 'flex', 'flex-col' ),
			'row'   => array( 'flex', 'flex-row' ),
			'grid'  => array( 'grid' ),
			default => array(),
		};

		if ( isset( $layout['columns'] ) && is_int( $layout['columns'] ) ) {
			$out[] = 'grid-cols-' . $layout['columns'];
		}
		$gap     = self::token( $layout['gap'] ?? null );
		$out[]   = null === $gap ? null : 'gap-' . $gap;
		$align   = self::word( $layout['align'] ?? null );
		$out[]   = null === $align ? null : 'items-' . $align;
		$justify = self::word( $layout['justify'] ?? null );
		$out[]   = null === $justify ? null : 'justify-' . $justify;
		if ( isset( $layout['wrap'] ) && is_bool( $layout['wrap'] ) ) {
			$out[] = $layout['wrap'] ? 'flex-wrap' : 'flex-nowrap';
		}
		return $out;
	}
}
