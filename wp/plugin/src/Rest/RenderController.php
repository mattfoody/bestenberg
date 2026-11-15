<?php
/**
 * REST: render block markup to HTML.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg\Rest;

use WP_Post;
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
					'markup'   => array(
						'type'      => 'string',
						'required'  => true,
						'maxLength' => self::MAX_LENGTH,
					),
					'postId'   => array(
						'type'    => 'integer',
						'default' => 0,
					),
					'postType' => array(
						'type'    => 'string',
						'default' => '',
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

		$context = $this->context_post( (int) $request->get_param( 'postId' ), (string) $request->get_param( 'postType' ) );
		if ( null === $context ) {
			return new WP_REST_Response( array( 'html' => do_blocks( $markup ) ) );
		}

		// Blocks such as Title or Featured image show the post they are rendered for.
		global $post;
		$previous = $post;
		$post     = $context; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- Restored below.
		setup_postdata( $post );
		$provide = static function ( array $block_context ) use ( $context ): array {
			return $block_context + array(
				'postId'   => $context->ID,
				'postType' => $context->post_type,
			);
		};
		add_filter( 'render_block_context', $provide );
		$html = do_blocks( $markup );
		remove_filter( 'render_block_context', $provide );
		$post = $previous; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- Restoring.
		wp_reset_postdata();

		return new WP_REST_Response( array( 'html' => $html ) );
	}

	/**
	 * The post that post-related blocks should show: the one being edited, or
	 * for templates the latest published post of the given type.
	 *
	 * @param int    $post_id   Post being edited (0 = none).
	 * @param string $post_type Post type to sample when no post is given.
	 */
	private function context_post( int $post_id, string $post_type ): ?WP_Post {
		if ( $post_id > 0 ) {
			$post = get_post( $post_id );
			return $post instanceof WP_Post && current_user_can( 'edit_post', $post->ID ) ? $post : null;
		}
		if ( '' === $post_type || ! post_type_exists( $post_type ) ) {
			return null;
		}
		$posts = get_posts(
			array(
				'post_type'        => $post_type,
				'post_status'      => 'publish',
				'numberposts'      => 1,
				'suppress_filters' => false,
			)
		);
		return $posts[0] ?? null;
	}
}
