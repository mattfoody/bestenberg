<?php
/**
 * Editor canvas: the real frontend page with an empty content area.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg\Editor;

/**
 * The editor shows a page inside an iframe that loads the site's own frontend
 * (theme, header, footer, global styles), so what you edit is what visitors
 * get. In canvas mode the post content is replaced by an empty root element
 * that the editor app fills, and the full utility stylesheet is loaded so any
 * style can be previewed instantly.
 *
 * URL: /?bestenberg-canvas=<post id>&_wpnonce=<nonce>. Only users who can edit
 * that post get a canvas; everyone else gets the normal page. Templates and
 * template parts use /?bestenberg-canvas=template: a bare page with the same
 * styles, for users who can edit theme options.
 */
final class Canvas {

	public const QUERY_ARG    = 'bestenberg-canvas';
	public const NONCE_ACTION = 'bestenberg-canvas';
	public const ROOT_ID      = 'bb-canvas-root';
	public const TEMPLATE     = 'template';

	/**
	 * Post being edited in this request (0 = not a canvas request).
	 *
	 * @var int
	 */
	private int $post_id = 0;

	/**
	 * Whether this request renders the bare canvas for a template or part.
	 *
	 * @var bool
	 */
	private bool $blank = false;

	/**
	 * Registers hooks.
	 */
	public function register(): void {
		add_filter( 'request', array( $this, 'route' ) );
	}

	/**
	 * Canvas URL for a post.
	 *
	 * @param int $post_id Post ID.
	 */
	public static function url( int $post_id ): string {
		return add_query_arg(
			array(
				self::QUERY_ARG => $post_id,
				'_wpnonce'      => wp_create_nonce( self::NONCE_ACTION ),
			),
			home_url( '/' )
		);
	}

	/**
	 * Whether this request renders a canvas.
	 */
	public function is_active(): bool {
		return $this->post_id > 0 || $this->blank;
	}

	/**
	 * Canvas URL for templates and template parts.
	 */
	public static function template_url(): string {
		return add_query_arg(
			array(
				self::QUERY_ARG => self::TEMPLATE,
				'_wpnonce'      => wp_create_nonce( self::NONCE_ACTION ),
			),
			home_url( '/' )
		);
	}

	/**
	 * The bare canvas page.
	 */
	public function blank_template(): string {
		return BESTENBERG_DIR . 'templates/canvas.php';
	}

	/**
	 * Points the main query at the edited post when the request is a valid canvas request.
	 *
	 * @param array<string, mixed> $query_vars Parsed query variables.
	 * @return array<string, mixed>
	 */
	public function route( array $query_vars ): array {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Verified below.
		$value     = isset( $_GET[ self::QUERY_ARG ] ) ? sanitize_key( wp_unslash( $_GET[ self::QUERY_ARG ] ) ) : '';
		$requested = absint( $value );
		$nonce     = isset( $_GET['_wpnonce'] ) ? sanitize_text_field( wp_unslash( $_GET['_wpnonce'] ) ) : '';
		if ( '' === $value || false === wp_verify_nonce( $nonce, self::NONCE_ACTION ) ) {
			return $query_vars;
		}
		// Templates and template parts are edited on a bare page, not inside a post.
		if ( self::TEMPLATE === $value ) {
			if ( current_user_can( 'edit_theme_options' ) ) {
				$this->blank = true;
				$this->activate();
				add_filter( 'template_include', array( $this, 'blank_template' ), PHP_INT_MAX );
			}
			return $query_vars;
		}
		if ( $requested <= 0 ) {
			return $query_vars;
		}
		$post = get_post( $requested );
		if ( null === $post || ! current_user_can( 'edit_post', $post->ID ) ) {
			return $query_vars;
		}

		$this->post_id = $post->ID;
		$this->activate();

		return 'page' === $post->post_type
			? array( 'page_id' => $post->ID )
			: array(
				'p'         => $post->ID,
				'post_type' => $post->post_type,
			);
	}

	/**
	 * Hooks that only apply to a canvas request.
	 */
	private function activate(): void {
		if ( ! defined( 'DONOTCACHEPAGE' ) ) {
			define( 'DONOTCACHEPAGE', true ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- Convention shared by caching plugins.
		}
		nocache_headers();
		add_filter( 'show_admin_bar', '__return_false' );
		add_filter( 'redirect_canonical', '__return_false' );
		add_filter( 'wp_robots', 'wp_robots_no_robots' );
		add_filter( 'pre_render_block', array( $this, 'replace_post_content' ), 10, 2 );
		add_filter( 'the_content', array( $this, 'replace_the_content' ), PHP_INT_MAX );
		add_filter( 'body_class', array( $this, 'body_class' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue' ), 30 );
	}

	/**
	 * The empty element the editor renders into.
	 */
	private function root(): string {
		return sprintf( '<div id="%s" data-post="%d"></div>', esc_attr( self::ROOT_ID ), $this->post_id );
	}

	/**
	 * Block themes: replaces the Post Content block.
	 *
	 * @param string|null          $pre_render   Short-circuit value.
	 * @param array<string, mixed> $parsed_block Parsed block.
	 */
	public function replace_post_content( ?string $pre_render, array $parsed_block ): ?string {
		return 'core/post-content' === ( $parsed_block['blockName'] ?? null ) ? $this->root() : $pre_render;
	}

	/**
	 * Classic themes: replaces the main post's content.
	 *
	 * @param string $content Post content.
	 */
	public function replace_the_content( string $content ): string {
		return in_the_loop() && is_main_query() && get_the_ID() === $this->post_id ? $this->root() : $content;
	}

	/**
	 * Marks the body so canvas styles can target it.
	 *
	 * @param string[] $classes Body classes.
	 * @return string[]
	 */
	public function body_class( array $classes ): array {
		$classes[] = 'bb-canvas';
		return $classes;
	}

	/**
	 * Loads every style the editor may need: all core block styles, all
	 * utilities, and the canvas affordances (outlines, placeholders).
	 */
	public function enqueue(): void {
		wp_enqueue_style( 'bestenberg-canvas-blocks', includes_url( 'css/dist/block-library/style.css' ), array(), get_bloginfo( 'version' ) );
		wp_enqueue_style( 'bestenberg-canvas-utilities', BESTENBERG_URL . 'generated/utilities.css', array( 'bestenberg-tokens' ), BESTENBERG_VERSION );
		wp_enqueue_style( 'bestenberg-canvas', BESTENBERG_URL . 'assets/canvas.css', array( 'bestenberg-canvas-utilities' ), BESTENBERG_VERSION );
	}
}
