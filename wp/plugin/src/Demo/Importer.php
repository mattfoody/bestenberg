<?php
/**
 * Demo site: a few ready-made pages for a new install.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg\Demo;

use WP_Error;
use WP_REST_Response;
use WP_REST_Server;

/**
 * Creates the demo pages from demo/pages.json (generated from
 * packages/adapter-blocks/src/demo.ts).
 *
 * Pages that already exist are left alone, so running it twice never
 * overwrites someone's edits. The first demo page becomes the front page only
 * if the site still shows its latest posts there.
 *
 * In the editor: "Add demo pages". From the command line:
 * wp eval '\Bestenberg\Demo\Importer::run();' --user=admin
 */
final class Importer {

	public const META_KEY = '_bestenberg_demo';

	/**
	 * Registers hooks.
	 */
	public function register(): void {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Registers POST /bestenberg/v1/demo.
	 */
	public function register_routes(): void {
		register_rest_route(
			'bestenberg/v1',
			'/demo',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => static function () {
					$result = self::run();
					return is_wp_error( $result ) ? $result : new WP_REST_Response( $result );
				},
				'permission_callback' => static fn(): bool => current_user_can( 'edit_theme_options' ) && current_user_can( 'publish_pages' ),
			)
		);
	}

	/**
	 * Path of the generated demo content.
	 */
	public static function file(): string {
		return BESTENBERG_DIR . 'demo/pages.json';
	}

	/**
	 * Creates the demo pages that do not exist yet.
	 *
	 * @return array{pages: list<array{id: int, slug: string, title: string, created: bool}>, front: int}|WP_Error
	 */
	public static function run(): array|WP_Error {
		$file = self::file();
		$data = is_readable( $file ) ? json_decode( (string) file_get_contents( $file ), true ) : null; // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local file.
		if ( ! is_array( $data ) || ! is_array( $data['pages'] ?? null ) ) {
			return new WP_Error( 'bestenberg_demo_missing', __( 'The demo content is missing from this copy of Bestenberg.', 'bestenberg' ), array( 'status' => 500 ) );
		}

		$image_base = is_string( $data['imageBase'] ?? null ) ? $data['imageBase'] : '';
		$pages      = array();
		$front      = 0;
		foreach ( $data['pages'] as $page ) {
			if ( ! is_array( $page ) || ! is_string( $page['slug'] ?? null ) || ! is_string( $page['title'] ?? null ) || ! is_string( $page['content'] ?? null ) ) {
				continue;
			}
			$id      = self::existing( $page['slug'] );
			$created = 0 === $id;
			if ( $created ) {
				$content = '' === $image_base ? $page['content'] : str_replace( $image_base, BESTENBERG_URL . 'demo/', $page['content'] );
				$id      = wp_insert_post(
					wp_slash(
						array(
							'post_type'    => 'page',
							'post_status'  => 'publish',
							'post_title'   => $page['title'],
							'post_name'    => $page['slug'],
							'post_content' => $content,
							'meta_input'   => array( self::META_KEY => $page['slug'] ),
						)
					),
					true
				);
				if ( is_wp_error( $id ) ) {
					return $id;
				}
			}
			if ( true === ( $page['front'] ?? false ) ) {
				$front = $id;
			}
			$pages[] = array(
				'id'      => $id,
				'slug'    => $page['slug'],
				'title'   => $page['title'],
				'created' => $created,
			);
		}//end foreach

		// Take over the front page only when the site has not chosen one.
		if ( $front > 0 && 'page' !== get_option( 'show_on_front' ) ) {
			update_option( 'show_on_front', 'page' );
			update_option( 'page_on_front', $front );
		}

		return array(
			'pages' => $pages,
			'front' => $front,
		);
	}

	/**
	 * ID of the demo page already created for a slug (0 = none).
	 *
	 * @param string $slug Demo page slug.
	 */
	private static function existing( string $slug ): int {
		$found = get_posts(
			array(
				'post_type'   => 'page',
				'post_status' => array( 'publish', 'draft', 'pending', 'private', 'future' ),
				'meta_key'    => self::META_KEY, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- One-off lookup.
				'meta_value'  => $slug, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value -- One-off lookup.
				'numberposts' => 1,
				'fields'      => 'ids',
			)
		);
		return isset( $found[0] ) ? (int) $found[0] : 0;
	}
}
