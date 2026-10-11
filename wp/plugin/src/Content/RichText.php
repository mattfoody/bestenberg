<?php
/**
 * Rich text and URL sanitization.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg\Content;

/**
 * Server-side counterpart of sanitizeRichText() and isSafeUrl() in the schema
 * package. Used wherever rich text enters WordPress from outside the block
 * editor (REST endpoints, AI output).
 */
final class RichText {

	public const PROTOCOLS    = array( 'http', 'https', 'mailto', 'tel' );
	public const LINK_TARGETS = array( '_blank', '_self' );
	public const LINK_RELS    = array( 'noopener', 'noreferrer', 'nofollow', 'ugc', 'sponsored' );

	/**
	 * Allows strong, em, a (href, target, rel), br and span.bb-* only.
	 *
	 * @param string $html Inline HTML.
	 */
	public static function sanitize( string $html ): string {
		$allowed = array(
			'strong' => array(),
			'em'     => array(),
			'br'     => array(),
			'a'      => array(
				'href'   => true,
				'target' => true,
				'rel'    => true,
			),
			'span'   => array( 'class' => true ),
		);
		$clean   = wp_kses( $html, $allowed, self::PROTOCOLS );

		$tags = new \WP_HTML_Tag_Processor( $clean );
		while ( $tags->next_tag() ) {
			if ( 'SPAN' === $tags->get_tag() ) {
				self::filter_span( $tags );
			} elseif ( 'A' === $tags->get_tag() ) {
				self::filter_link( $tags );
			}
		}
		return $tags->get_updated_html();
	}

	/**
	 * Keeps only bb-* classes on a span.
	 *
	 * @param \WP_HTML_Tag_Processor $tags Processor positioned on a span.
	 */
	private static function filter_span( \WP_HTML_Tag_Processor $tags ): void {
		$remove = array();
		foreach ( $tags->class_list() as $class_name ) {
			if ( 1 !== preg_match( '/^bb-[a-z0-9-]+$/', $class_name ) ) {
				$remove[] = $class_name;
			}
		}
		foreach ( $remove as $class_name ) {
			$tags->remove_class( $class_name );
		}
	}

	/**
	 * Restricts target and rel on a link.
	 *
	 * @param \WP_HTML_Tag_Processor $tags Processor positioned on a link.
	 */
	private static function filter_link( \WP_HTML_Tag_Processor $tags ): void {
		$target = $tags->get_attribute( 'target' );
		if ( null !== $target && ! in_array( $target, self::LINK_TARGETS, true ) ) {
			$tags->remove_attribute( 'target' );
		}

		$rel = $tags->get_attribute( 'rel' );
		if ( ! is_string( $rel ) ) {
			return;
		}
		$parts  = preg_split( '/\s+/', strtolower( $rel ) );
		$tokens = array_values( array_intersect( array_unique( false === $parts ? array() : $parts ), self::LINK_RELS ) );
		if ( array() === $tokens ) {
			$tags->remove_attribute( 'rel' );
		} else {
			$tags->set_attribute( 'rel', implode( ' ', $tokens ) );
		}
	}

	/**
	 * Safe URL or empty string.
	 *
	 * @param string $url URL.
	 */
	public static function url( string $url ): string {
		return esc_url_raw( $url, self::PROTOCOLS );
	}
}
