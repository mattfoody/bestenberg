<?php
/**
 * REST: remember which editor introductions a user has seen.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg\Rest;

use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * POST /bestenberg/v1/onboarding { mode } → { onboarded }.
 *
 * The editor shows a short introduction the first time someone uses design
 * mode or client mode; this stores that they have seen it.
 */
final class OnboardingController {

	public const META_KEY = 'bestenberg_onboarded';
	public const MODES    = array( 'design', 'client' );

	/**
	 * Registers hooks.
	 */
	public function register(): void {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Registers the route.
	 */
	public function register_routes(): void {
		register_rest_route(
			RenderController::NAMESPACE,
			'/onboarding',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'mark' ),
				'permission_callback' => static fn(): bool => current_user_can( 'edit_posts' ),
				'args'                => array(
					'mode' => array(
						'type'     => 'string',
						'required' => true,
						'enum'     => self::MODES,
					),
				),
			)
		);
	}

	/**
	 * Modes whose introduction a user has seen.
	 *
	 * @param int $user_id User ID.
	 * @return list<string>
	 */
	public static function seen( int $user_id ): array {
		$stored = get_user_meta( $user_id, self::META_KEY, true );
		if ( ! is_array( $stored ) ) {
			return array();
		}
		return array_values( array_intersect( self::MODES, $stored ) );
	}

	/**
	 * Stores that the current user has seen a mode's introduction.
	 *
	 * @param WP_REST_Request $request Request.
	 * @phpstan-param WP_REST_Request<array<string, mixed>> $request
	 */
	public function mark( WP_REST_Request $request ): WP_REST_Response {
		$user_id = get_current_user_id();
		$seen    = self::seen( $user_id );
		$mode    = (string) $request->get_param( 'mode' );
		if ( ! in_array( $mode, $seen, true ) ) {
			$seen[] = $mode;
			update_user_meta( $user_id, self::META_KEY, $seen );
		}
		return new WP_REST_Response( array( 'onboarded' => self::seen( $user_id ) ) );
	}
}
