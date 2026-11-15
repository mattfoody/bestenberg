<?php
/**
 * AI routes and abilities tests (M5).
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg\Tests\phpunit;

use Bestenberg\Ai\Abilities;
use WP_REST_Request;
use WP_UnitTestCase;

final class AiTest extends WP_UnitTestCase {

	/**
	 * Calls recorded by the pre-generate filter.
	 *
	 * @var array<int, array<string, mixed>>
	 */
	private array $calls = array();

	/**
	 * Dispatches a generate request.
	 *
	 * @param array<string, mixed> $params Request parameters.
	 */
	private function generate( array $params ): \WP_REST_Response {
		$request = new WP_REST_Request( 'POST', '/bestenberg/v1/ai/generate' );
		foreach ( $params as $key => $value ) {
			$request->set_param( $key, $value );
		}
		return rest_get_server()->dispatch( $request );
	}

	private function answer_with( string $answer ): void {
		add_filter(
			'bestenberg_pre_ai_generate',
			function ( $pre, array $call ) use ( $answer ) {
				$this->calls[] = $call;
				return $answer;
			},
			10,
			2
		);
	}

	public function test_routes_require_page_editing(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'author' ) ) );
		$this->answer_with( '{}' );

		$this->assertSame(
			403,
			$this->generate(
				array(
					'system' => 's',
					'prompt' => 'p',
				)
			)->get_status()
		);
		$this->assertSame( 403, rest_get_server()->dispatch( new WP_REST_Request( 'GET', '/bestenberg/v1/ai/status' ) )->get_status() );
		$this->assertSame( array(), $this->calls );
	}

	public function test_generate_returns_the_filtered_answer(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );
		$this->answer_with( '{"sections":[]}' );

		$response = $this->generate(
			array(
				'system' => 'You design pages.',
				'prompt' => 'A bakery hero',
				'images' => array(
					array(
						'url'      => 'data:image/png;base64,AAAA',
						'mimeType' => 'image/png',
					),
				),
			)
		);

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( '{"sections":[]}', $response->get_data()['text'] );
		$this->assertSame( 'You design pages.', $this->calls[0]['system'] );
		$this->assertSame( 'A bakery hero', $this->calls[0]['prompt'] );
		$this->assertSame( 'image/png', $this->calls[0]['images'][0]['mimeType'] );
	}

	public function test_generate_rejects_images_that_are_not_inline(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );
		$this->answer_with( '{}' );

		$response = $this->generate(
			array(
				'system' => 's',
				'prompt' => 'p',
				'images' => array(
					array(
						'url'      => 'https://example.com/internal.png',
						'mimeType' => 'image/png',
					),
				),
			)
		);

		$this->assertSame( 400, $response->get_status() );
		$this->assertSame( array(), $this->calls );
	}

	public function test_generate_reports_a_missing_provider(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );
		add_filter( 'bestenberg_ai_available', '__return_false' );

		$response = $this->generate(
			array(
				'system' => 's',
				'prompt' => 'p',
			)
		);

		$this->assertSame( 501, $response->get_status() );
		$this->assertSame( 'bestenberg_ai_unavailable', $response->get_data()['code'] );
	}

	public function test_status_reports_availability(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );
		add_filter( 'bestenberg_ai_available', '__return_true' );

		$data = rest_get_server()->dispatch( new WP_REST_Request( 'GET', '/bestenberg/v1/ai/status' ) )->get_data();

		$this->assertTrue( $data['available'] );
		$this->assertSame( '', $data['connectorsUrl'] );
	}

	public function test_design_system_describes_components_and_tokens(): void {
		$context = Abilities::design_system();

		$this->assertStringContainsString( '# Components', $context['instructions'] );
		$this->assertContains( 'section', array_column( $context['components'], 'type' ) );
		$this->assertNotContains( 'raw', array_column( $context['components'], 'type' ) );
		$this->assertContains( 'primary', $context['tokens']['color'] );
	}

	public function test_design_system_ability_is_registered(): void {
		if ( ! function_exists( 'wp_get_ability' ) ) {
			$this->markTestSkipped( 'Abilities API not available.' );
		}
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );

		$ability = wp_get_ability( Abilities::DESIGN_SYSTEM );

		$this->assertNotNull( $ability );
		$result = $ability->execute();
		$this->assertIsArray( $result );
		$this->assertArrayHasKey( 'instructions', $result );
	}
}
