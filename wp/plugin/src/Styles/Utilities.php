<?php
/**
 * Generated utility class map.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg\Styles;

/**
 * Reads generated/utilities.map.php and builds CSS for a set of classes.
 * Mirrors cssForClasses() in @bestenberg/tokens (TS/PHP parity).
 */
final class Utilities {

	/**
	 * Media queries keyed by media key ('md', 'lg', 'max-md', 'md-max-lg').
	 *
	 * @var array<string, string>
	 */
	private array $media;

	/**
	 * Class name => [order, media key, css].
	 *
	 * @var array<string, array{0: int, 1: string, 2: string}>
	 */
	private array $rules;

	/**
	 * Shared instance loaded from the plugin's generated map.
	 *
	 * @var Utilities|null
	 */
	private static ?Utilities $shared = null;

	/**
	 * Constructor.
	 *
	 * @param array{media: array<string, string>, rules: array<string, array{0: int, 1: string, 2: string}>} $map Utility map.
	 */
	public function __construct( array $map ) {
		$this->media = $map['media'];
		$this->rules = $map['rules'];
	}

	/**
	 * Loads the generated map shipped with the plugin.
	 *
	 * @param string|null $file Map file; defaults to generated/utilities.map.php.
	 */
	public static function from_file( ?string $file = null ): self {
		$file = $file ?? BESTENBERG_DIR . 'generated/utilities.map.php';
		/**
		 * Generated map.
		 *
		 * @var array{media: array<string, string>, rules: array<string, array{0: int, 1: string, 2: string}>} $map
		 */
		$map = require $file;
		return new self( $map );
	}

	/**
	 * The plugin's generated map, loaded once per request.
	 */
	public static function shared(): self {
		if ( null === self::$shared ) {
			self::$shared = self::from_file();
		}
		return self::$shared;
	}

	/**
	 * Whether a class is a known utility.
	 *
	 * @param string $class_name Class name, e.g. "bb:py-4".
	 */
	public function has( string $class_name ): bool {
		return isset( $this->rules[ $class_name ] );
	}

	/**
	 * Number of known utilities.
	 */
	public function count(): int {
		return count( $this->rules );
	}

	/**
	 * CSS for the given classes only, in cascade order, grouped by media query.
	 * Unknown classes are ignored.
	 *
	 * @param string[] $classes Class names.
	 */
	public function css_for( array $classes ): string {
		$used = array();
		foreach ( $classes as $class_name ) {
			if ( isset( $this->rules[ $class_name ] ) ) {
				$used[ $class_name ] = $this->rules[ $class_name ];
			}
		}

		usort(
			$used,
			/**
			 * Sorts rules by cascade order.
			 *
			 * @param array{0: int, 1: string, 2: string} $a First rule.
			 * @param array{0: int, 1: string, 2: string} $b Second rule.
			 */
			static fn( array $a, array $b ): int => $a[0] <=> $b[0]
		);

		// Group consecutive rules that share a media key.
		$groups = array();
		foreach ( $used as $rule ) {
			$last = count( $groups ) - 1;
			if ( $last >= 0 && $groups[ $last ]['media'] === $rule[1] ) {
				$groups[ $last ]['css'] .= $rule[2];
			} else {
				$groups[] = array(
					'media' => $rule[1],
					'css'   => $rule[2],
				);
			}
		}

		$out = array();
		foreach ( $groups as $group ) {
			$out[] = '' === $group['media']
				? $group['css']
				: '@media ' . $this->media[ $group['media'] ] . '{' . $group['css'] . '}';
		}

		return implode( "\n", $out );
	}
}
