<?php
/**
 * Rich text and URL sanitization.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg\Content;

/**
 * Server-side counterpart of sanitizeRichText()/isSafeUrl() in
 * @bestenberg/schema. Used wherever rich text enters WordPress from outside
 * the block editor (REST endpoints, AI output).
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
			$tag = $tags->get_tag();
			if ( 'SPAN' === $tag ) {
				$remove = array();
				foreach ( $tags->class_list() as $class_name ) {
					if ( 1 !== preg_match( '/^bb-[a-z0-9-]+$/', $class_name ) ) {
						$remove[] = $class_name;
					}
				}
				foreach ( $remove as $class_name ) {
					$tags->remove_class( $class_name );
				}
			} elseif ( 'A' === $tag ) {
				$target = $tags->get_attribute( 'target' );
				if ( null !== $target && ! in_array( $target, self::LINK_TARGETS, true ) ) {
					$tags->remove_attribute( 'target' );
				}
				$rel = $tags->get_attribute( 'rel' );
				if ( is_string( $rel ) ) {
					$parts  = preg_split( '/\s+/', strtolower( $rel ) );
					$tokens = array_values( array_intersect( array_unique( false === $parts ? array() : $parts ), self::LINK_RELS ) );
					if ( array() === $tokens ) {
						$tags->remove_attribute( 'rel' );
					} else {
						$tags->set_attribute( 'rel', implode( ' ', $tokens ) );
					}
				}
			}
		}
		return $tags->get_updated_html();
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
