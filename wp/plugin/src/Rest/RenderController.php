<?php
/**
 * REST: render block markup to HTML.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg\Rest;

use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * POST /bestenberg/v1/render { markup } → { html }.
 *
 * The editor renders Bestenberg's own components itself; this endpoint is for
 * blocks it does not understand (raw nodes), which only WordPress can render.
 */
final class RenderController {

	public const NAMESPACE  = 'bestenberg/v1';
	public const MAX_LENGTH = 200000;

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
			self::NAMESPACE,
			'/render',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'render' ),
				'permission_callback' => static fn(): bool => current_user_can( 'edit_posts' ),
				'args'                => array(
					'markup' => array(
						'type'      => 'string',
						'required'  => true,
						'maxLength' => self::MAX_LENGTH,
					),
				),
			)
		);
	}

	/**
	 * Renders the markup.
	 *
	 * @param WP_REST_Request $request Request.
	 *
	 * @phpstan-param WP_REST_Request<array<string, mixed>> $request
	 */
	public function render( WP_REST_Request $request ): WP_REST_Response {
		$markup = (string) $request->get_param( 'markup' );
		// Users who may not post unfiltered HTML get the same filtering their saved content gets.
		if ( ! current_user_can( 'unfiltered_html' ) ) {
			$markup = wp_kses_post( $markup );
		}
		return new WP_REST_Response( array( 'html' => do_blocks( $markup ) ) );
	}
}
