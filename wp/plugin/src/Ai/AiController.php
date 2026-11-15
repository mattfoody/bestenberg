<?php
/**
 * REST routes that connect the editor's AI pipeline to a language model.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg\Ai;

use Bestenberg\Admin\EditorPage;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * The pipeline (prompting, validation, repair, token snapping) runs in
 *
 * @bestenberg/ai; this controller only forwards one model call to the
 * WordPress AI Client, which uses whichever provider the site has connected.
 */
final class AiController {

	public const NAMESPACE     = 'bestenberg/v1';
	public const MAX_SYSTEM    = 40000;
	public const MAX_PROMPT    = 60000;
	public const MAX_IMAGES    = 2;
	public const MAX_IMAGE_LEN = 8000000;
	public const MAX_TOKENS    = 8000;

	/**
	 * Registers hooks.
	 */
	public function register(): void {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Registers the routes.
	 */
	public function register_routes(): void {
		$permission = static fn(): bool => current_user_can( EditorPage::CAPABILITY );

		register_rest_route(
			self::NAMESPACE,
			'/ai/status',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'status' ),
				'permission_callback' => $permission,
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/ai/generate',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'generate' ),
				'permission_callback' => $permission,
				'args'                => array(
					'system' => array(
						'type'      => 'string',
						'required'  => true,
						'minLength' => 1,
						'maxLength' => self::MAX_SYSTEM,
					),
					'prompt' => array(
						'type'      => 'string',
						'required'  => true,
						'minLength' => 1,
						'maxLength' => self::MAX_PROMPT,
					),
					'images' => array(
						'type'     => 'array',
						'maxItems' => self::MAX_IMAGES,
						'default'  => array(),
						'items'    => array(
							'type'       => 'object',
							'required'   => array( 'url', 'mimeType' ),
							'properties' => array(
								'url'      => array(
									'type'      => 'string',
									'maxLength' => self::MAX_IMAGE_LEN,
								),
								'mimeType' => array(
									'type' => 'string',
									'enum' => array( 'image/png', 'image/jpeg', 'image/webp' ),
								),
							),
						),
					),
				),
			)
		);
	}

	/**
	 * Whether a model can be reached, and where to connect one if not.
	 */
	public function status(): WP_REST_Response {
		return new WP_REST_Response(
			array(
				'available'     => self::is_available(),
				'connectorsUrl' => current_user_can( 'manage_options' ) ? admin_url( 'options-connectors.php' ) : '',
			)
		);
	}

	/**
	 * Runs one model call and returns its text.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 *
	 * @phpstan-param WP_REST_Request<array<string, mixed>> $request
	 */
	public function generate( WP_REST_Request $request ) {
		$system = (string) $request->get_param( 'system' );
		$prompt = (string) $request->get_param( 'prompt' );
		$images = array();
		foreach ( (array) $request->get_param( 'images' ) as $image ) {
			$url  = is_array( $image ) ? (string) ( $image['url'] ?? '' ) : '';
			$mime = is_array( $image ) ? (string) ( $image['mimeType'] ?? '' ) : '';
			// Only inline images: the server never fetches a URL on the user's behalf.
			if ( ! str_starts_with( $url, 'data:' . $mime . ';base64,' ) ) {
				return new WP_Error(
					'bestenberg_ai_invalid_image',
					__( 'The screenshot could not be read. Use a PNG, JPEG or WebP image.', 'bestenberg' ),
					array( 'status' => 400 )
				);
			}
			$images[] = array(
				'url'      => $url,
				'mimeType' => $mime,
			);
		}

		/**
		 * Short-circuits the model call. Return a string to use it as the model's answer.
		 *
		 * Used by the hosted Bestenberg service and by tests.
		 *
		 * @param string|null                                                               $answer Answer, or null to call the model.
		 * @param array{system: string, prompt: string, images: list<array<string, string>>} $call   The call.
		 */
		$answer = apply_filters(
			'bestenberg_pre_ai_generate',
			null,
			array(
				'system' => $system,
				'prompt' => $prompt,
				'images' => $images,
			)
		);
		if ( is_string( $answer ) ) {
			return new WP_REST_Response( array( 'text' => $answer ) );
		}

		if ( ! self::is_available() ) {
			return new WP_Error(
				'bestenberg_ai_unavailable',
				__( 'No AI provider is connected. An administrator can connect one under Settings → Connectors.', 'bestenberg' ),
				array( 'status' => 501 )
			);
		}

		$builder = wp_ai_client_prompt( $prompt )
			->using_system_instruction( $system )
			->using_temperature( 0.4 )
			->using_max_tokens( self::MAX_TOKENS );
		foreach ( $images as $image ) {
			$builder = $builder->with_file( $image['url'], $image['mimeType'] );
		}

		$text = $builder->generate_text();
		if ( is_wp_error( $text ) ) {
			return new WP_Error(
				'bestenberg_ai_failed',
				sprintf(
					/* translators: %s: error message from the AI provider. */
					__( 'The AI provider returned an error: %s', 'bestenberg' ),
					$text->get_error_message()
				),
				array( 'status' => 502 )
			);
		}

		return new WP_REST_Response( array( 'text' => (string) $text ) );
	}

	/**
	 * Whether text generation is available on this site.
	 */
	public static function is_available(): bool {
		/**
		 * Filters whether Bestenberg AI features are available (e.g. the hosted service is active).
		 *
		 * @param bool $available Whether a model can be reached.
		 */
		return (bool) apply_filters( 'bestenberg_ai_available', self::has_text_model() );
	}

	/**
	 * Whether the WordPress AI Client has a provider that can generate text.
	 */
	private static function has_text_model(): bool {
		if ( ! function_exists( 'wp_ai_client_prompt' ) || ! function_exists( 'wp_supports_ai' ) || ! wp_supports_ai() ) {
			return false;
		}
		return (bool) wp_ai_client_prompt( 'ping' )->is_supported_for_text_generation();
	}
}
