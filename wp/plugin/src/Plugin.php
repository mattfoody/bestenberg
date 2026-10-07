<?php
/**
 * Plugin bootstrap.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg;

use Bestenberg\Admin\EditorPage;

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
	}

	/**
	 * Whether register() has run.
	 */
	public function is_registered(): bool {
		return $this->registered;
	}
}
