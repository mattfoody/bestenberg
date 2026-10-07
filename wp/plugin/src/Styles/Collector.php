<?php
/**
 * Records utility classes used while rendering a request.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg\Styles;

/**
 * Collects `bb:` utility classes from rendered HTML and tracks which have
 * already been printed, so late output only adds what is new.
 */
final class Collector {

	public const PREFIX = 'bb:';

	/**
	 * Recorded classes (as keys) in first-seen order.
	 *
	 * @var array<string, true>
	 */
	private array $classes = array();

	/**
	 * Classes already printed.
	 *
	 * @var array<string, true>
	 */
	private array $printed = array();

	/**
	 * Constructor.
	 *
	 * @param Utilities $utilities Known utilities; unknown classes are ignored.
	 */
	public function __construct( private Utilities $utilities ) {}

	/**
	 * Records classes. Only known utilities are kept.
	 *
	 * @param string[] $classes Class names.
	 */
	public function record( array $classes ): void {
		foreach ( $classes as $class_name ) {
			if ( $this->utilities->has( $class_name ) ) {
				$this->classes[ $class_name ] = true;
			}
		}
	}

	/**
	 * Records `bb:` classes from a space-separated class string.
	 *
	 * @param string $class_attribute Class attribute value.
	 */
	public function record_class_string( string $class_attribute ): void {
		if ( ! str_contains( $class_attribute, self::PREFIX ) ) {
			return;
		}
		$classes = preg_split( '/\s+/', trim( $class_attribute ) );
		$this->record( false === $classes ? array() : $classes );
	}

	/**
	 * Records every `bb:` class found in an HTML fragment.
	 *
	 * @param string $html Rendered HTML.
	 */
	public function record_html( string $html ): void {
		if ( ! str_contains( $html, self::PREFIX ) ) {
			return;
		}

		$tags = new \WP_HTML_Tag_Processor( $html );
		while ( $tags->next_tag() ) {
			$found = array();
			foreach ( $tags->class_list() as $class_name ) {
				if ( str_starts_with( $class_name, self::PREFIX ) ) {
					$found[] = $class_name;
				}
			}
			$this->record( $found );
		}
	}

	/**
	 * All recorded classes, sorted for stable cache keys.
	 *
	 * @return string[]
	 */
	public function all(): array {
		$classes = array_keys( $this->classes );
		sort( $classes );
		return $classes;
	}

	/**
	 * Recorded classes not yet printed; marks them printed.
	 *
	 * @return string[]
	 */
	public function take_unprinted(): array {
		$new = array_keys( array_diff_key( $this->classes, $this->printed ) );
		foreach ( $new as $class_name ) {
			$this->printed[ $class_name ] = true;
		}
		sort( $new );
		return $new;
	}
}
