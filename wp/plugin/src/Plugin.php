<?php
/**
 * Plugin bootstrap.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg;

use Bestenberg\Admin\EditorPage;
use Bestenberg\Styles\Collector;
use Bestenberg\Styles\StyleOutput;
use Bestenberg\Styles\Utilities;

/**
 * Wires up Bestenberg's services. Holds no logic of its own.
 */
final class Plugin {

	/**
	 * Shared instance.
	 *
	 * @var Plugin|null
	 */
	private static ?Plugin $instance = null;

	/**
	 * Whether hooks have been registered.
	 *
	 * @var bool
	 */
	private bool $registered = false;

	/**
	 * Utility class collector for the current request.
	 *
	 * @var Collector|null
	 */
	private ?Collector $collector = null;

	/**
	 * Returns the shared instance.
	 */
	public static function instance(): Plugin {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Registers all services. Safe to call more than once.
	 */
	public function register(): void {
		if ( $this->registered ) {
			return;
		}
		$this->registered = true;

		( new EditorPage() )->register();
		( new StyleOutput( $this->collector(), Utilities::shared() ) )->register();
	}

	/**
	 * Request-wide utility class collector (blocks record the classes they use).
	 */
	public function collector(): Collector {
		if ( null === $this->collector ) {
			$this->collector = new Collector( Utilities::shared() );
		}
		return $this->collector;
	}

	/**
	 * Whether register() has run.
	 */
	public function is_registered(): bool {
		return $this->registered;
	}
}
