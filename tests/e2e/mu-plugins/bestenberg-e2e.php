<?php
/**
 * Plugin Name: Bestenberg e2e helpers
 * Description: Scripted AI answers and onboarding reset for end-to-end tests. Only active for requests that send the X-Bestenberg-E2E header.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

if ( ! isset( $_SERVER['HTTP_X_BESTENBERG_E2E'] ) ) {
	return;
}

// "reset-onboarding": the current user has not seen the editor introductions yet.
if ( 'reset-onboarding' === $_SERVER['HTTP_X_BESTENBERG_E2E'] ) {
	add_action(
		'init',
		static function (): void {
			delete_user_meta( get_current_user_id(), 'bestenberg_onboarded' );
		}
	);
}

add_filter( 'bestenberg_ai_available', '__return_true' );

add_filter(
	'bestenberg_pre_ai_generate',
	static function ( $answer, array $call ) {
		// First attempt: an unknown component and off-scale values, to exercise repair and snapping.
		if ( ! str_contains( $call['prompt'], 'previous answer was not valid' ) ) {
			return (string) wp_json_encode(
				array(
					'sections' => array(
						array(
							'type'     => 'section',
							'children' => array( array( 'type' => 'carousel' ) ),
						),
					),
				)
			);
		}

		$title = empty( $call['images'] ) ? 'Bread worth waking up for' : 'Rebuilt from a screenshot';
		return "Here is the corrected JSON:\n```json\n" . wp_json_encode(
			array(
				'sections' => array(
					array(
						'type'     => 'section',
						'style'    => array(
							'padding'    => array(
								'x' => '24px',
								'y' => '5rem',
							),
							'background' => '#1d4ed8',
							'color'      => 'on-primary',
						),
						'children' => array(
							array(
								'type'     => 'container',
								'style'    => array( 'base' => array( 'width' => 'container.md' ) ),
								'children' => array(
									array(
										'type'  => 'h1',
										'text'  => $title,
										'style' => array( 'font' => array( 'size' => '5xl', 'align' => 'center' ) ),
									),
									array(
										'type'  => 'paragraph',
										'props' => array( 'text' => 'Baked at five, gone by noon. <script>alert(1)</script>' ),
									),
									array(
										'type'  => 'button',
										'props' => array(
											'label' => 'Order online',
											'url'   => '/order',
										),
									),
								),
							),
						),
					),
					array(
						'type'     => 'section',
						'children' => array(
							array(
								'type'     => 'container',
								'children' => array(
									array(
										'type'  => 'heading',
										'props' => array(
											'text'  => 'Opening hours',
											'level' => 2,
										),
									),
									array(
										'type'  => 'list',
										'props' => array( 'items' => array( 'Mon–Fri 6–14', 'Sat 7–13' ) ),
									),
								),
							),
						),
					),
				),
			)
		) . "\n```";
	},
	10,
	2
);
