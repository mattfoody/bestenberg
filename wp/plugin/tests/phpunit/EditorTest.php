<?php
/**
 * Editor canvas, render endpoint and background image tests (M3).
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg\Tests\phpunit;

use Bestenberg\Admin\EditorPage;
use Bestenberg\Blocks\LayoutBlocks;
use Bestenberg\Editor\Canvas;
use Bestenberg\Rest\OnboardingController;
use WP_REST_Request;
use WP_UnitTestCase;

final class EditorTest extends WP_UnitTestCase {

	private function render_request( string $markup ): \WP_REST_Response {
		$request = new WP_REST_Request( 'POST', '/bestenberg/v1/render' );
		$request->set_param( 'markup', $markup );
		return rest_get_server()->dispatch( $request );
	}

	public function test_render_endpoint_requires_an_editor(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'subscriber' ) ) );
		$this->assertSame( 403, $this->render_request( '<!-- wp:paragraph --><p>x</p><!-- /wp:paragraph -->' )->get_status() );

		wp_set_current_user( 0 );
		$this->assertSame( 401, $this->render_request( '<!-- wp:paragraph --><p>x</p><!-- /wp:paragraph -->' )->get_status() );
	}

	public function test_render_endpoint_renders_blocks(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );
		$response = $this->render_request( '<!-- wp:paragraph --><p>Hello</p><!-- /wp:paragraph -->' );

		$this->assertSame( 200, $response->get_status() );
		$this->assertStringContainsString( 'Hello</p>', $response->get_data()['html'] );
	}

	public function test_render_endpoint_filters_html_for_users_without_unfiltered_html(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'author' ) ) );
		$response = $this->render_request( '<!-- wp:html --><script>alert(1)</script><p>ok</p><!-- /wp:html -->' );

		$this->assertSame( 200, $response->get_status() );
		$this->assertStringNotContainsString( '<script', $response->get_data()['html'] );
	}

	public function test_canvas_url_carries_post_and_nonce(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$post_id = self::factory()->post->create( array( 'post_type' => 'page' ) );
		$url     = Canvas::url( $post_id );
		parse_str( (string) wp_parse_url( $url, PHP_URL_QUERY ), $query );

		$this->assertSame( (string) $post_id, $query[ Canvas::QUERY_ARG ] );
		$this->assertSame( 1, wp_verify_nonce( $query['_wpnonce'], Canvas::NONCE_ACTION ) );
	}

	public function test_canvas_request_is_ignored_without_a_valid_nonce(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$post_id = self::factory()->post->create( array( 'post_type' => 'page' ) );

		$this->go_to(
			add_query_arg(
				array(
					Canvas::QUERY_ARG => $post_id,
					'_wpnonce'        => 'invalid',
				),
				home_url( '/' )
			)
		);

		$this->assertFalse( is_page( $post_id ) );
		$this->assertNotContains( 'bb-canvas', get_body_class() );
	}

	public function test_canvas_request_is_ignored_for_users_who_cannot_edit_the_post(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'subscriber' ) ) );
		$post_id = self::factory()->post->create( array( 'post_type' => 'page' ) );

		$this->go_to( Canvas::url( $post_id ) );

		$this->assertFalse( is_page( $post_id ) );
		$this->assertNotContains( 'bb-canvas', get_body_class() );
	}

	public function test_canvas_request_shows_the_post_to_its_editor(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$post_id = self::factory()->post->create(
			array(
				'post_type'   => 'page',
				'post_status' => 'draft',
			)
		);

		$this->go_to( Canvas::url( $post_id ) );

		$this->assertTrue( is_page( $post_id ) );
		$this->assertContains( 'bb-canvas', get_body_class() );
	}

	public function test_render_endpoint_shows_post_blocks_for_the_post_being_edited(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );
		$post_id = self::factory()->post->create( array( 'post_title' => 'Edited post title' ) );

		$request = new WP_REST_Request( 'POST', '/bestenberg/v1/render' );
		$request->set_param( 'markup', '<!-- wp:post-title /-->' );
		$request->set_param( 'postId', $post_id );
		$html = rest_get_server()->dispatch( $request )->get_data()['html'];

		$this->assertStringContainsString( 'Edited post title', $html );
	}

	public function test_render_endpoint_samples_a_published_post_for_templates(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );
		self::factory()->post->create(
			array(
				'post_title'  => 'Unpublished draft',
				'post_status' => 'draft',
				'post_date'   => '2030-01-01 00:00:00',
			)
		);
		self::factory()->post->create( array( 'post_title' => 'Sample for templates' ) );

		$request = new WP_REST_Request( 'POST', '/bestenberg/v1/render' );
		$request->set_param( 'markup', '<!-- wp:post-title /-->' );
		$request->set_param( 'postType', 'post' );
		$html = rest_get_server()->dispatch( $request )->get_data()['html'];

		$this->assertStringContainsString( 'Sample for templates', $html );
		$this->assertStringNotContainsString( 'Unpublished draft', $html );
	}

	public function test_render_endpoint_ignores_a_post_the_user_cannot_edit(): void {
		$post_id = self::factory()->post->create(
			array(
				'post_title'  => 'Private to someone else',
				'post_status' => 'private',
			)
		);
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'author' ) ) );

		$request = new WP_REST_Request( 'POST', '/bestenberg/v1/render' );
		$request->set_param( 'markup', '<!-- wp:post-title /-->' );
		$request->set_param( 'postId', $post_id );
		$response = rest_get_server()->dispatch( $request );

		$this->assertSame( 200, $response->get_status() );
		$this->assertStringNotContainsString( 'Private to someone else', $response->get_data()['html'] );
	}

	public function test_template_canvas_needs_the_design_capability(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );
		$this->go_to( Canvas::template_url() );
		$this->assertNotContains( 'bb-canvas', get_body_class() );

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$this->go_to( Canvas::template_url() );
		$this->assertContains( 'bb-canvas', get_body_class() );
	}

	public function test_onboarding_is_remembered_per_user_and_mode(): void {
		$user_id = self::factory()->user->create( array( 'role' => 'editor' ) );
		wp_set_current_user( $user_id );
		$this->assertSame( array(), OnboardingController::seen( $user_id ) );

		$request = new WP_REST_Request( 'POST', '/bestenberg/v1/onboarding' );
		$request->set_param( 'mode', 'client' );
		$response = rest_get_server()->dispatch( $request );
		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( array( 'client' ), $response->get_data()['onboarded'] );
		$this->assertSame( array( 'client' ), OnboardingController::seen( $user_id ) );

		// Repeating changes nothing; unknown modes are rejected.
		rest_get_server()->dispatch( $request );
		$this->assertSame( array( 'client' ), OnboardingController::seen( $user_id ) );
		$request->set_param( 'mode', 'admin' );
		$this->assertSame( 400, rest_get_server()->dispatch( $request )->get_status() );

		$other = self::factory()->user->create( array( 'role' => 'editor' ) );
		$this->assertSame( array(), OnboardingController::seen( $other ) );
	}

	public function test_onboarding_requires_an_editor(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'subscriber' ) ) );
		$request = new WP_REST_Request( 'POST', '/bestenberg/v1/onboarding' );
		$request->set_param( 'mode', 'client' );
		$this->assertSame( 403, rest_get_server()->dispatch( $request )->get_status() );
	}

	public function test_editor_url_opens_a_post(): void {
		$this->assertStringContainsString( 'page=' . EditorPage::SLUG, EditorPage::url() );
		$this->assertStringContainsString( 'post=12', EditorPage::url( 12 ) );
	}

	public function test_background_image_style(): void {
		$this->assertNull( LayoutBlocks::background_image( null ) );
		$this->assertNull( LayoutBlocks::background_image( array( 'base' => array() ) ) );
		$this->assertSame(
			'https://example.com/it%27s%20%281%29.jpg',
			LayoutBlocks::background_image( array( 'base' => array( 'background' => array( 'image' => array( 'url' => "https://example.com/it's (1).jpg" ) ) ) ) )
		);
		$this->assertNull(
			LayoutBlocks::background_image( array( 'base' => array( 'background' => array( 'image' => array( 'url' => 'javascript:alert(1)' ) ) ) ) )
		);
	}
}
