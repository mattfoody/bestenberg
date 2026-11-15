<?php
/**
 * Abilities API integration.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg\Ai;

/**
 * Exposes Bestenberg's design system to AI agents (PLAN.md §6) so they can
 * produce pages that follow the site's tokens and components.
 */
final class Abilities {

	public const CATEGORY      = 'bestenberg';
	public const DESIGN_SYSTEM = 'bestenberg/get-design-system';

	/**
	 * Registers hooks.
	 */
	public function register(): void {
		add_action( 'wp_abilities_api_categories_init', array( $this, 'register_category' ) );
		add_action( 'wp_abilities_api_init', array( $this, 'register_abilities' ) );
	}

	/**
	 * Registers the ability category.
	 */
	public function register_category(): void {
		wp_register_ability_category(
			self::CATEGORY,
			array(
				'label'       => __( 'Bestenberg', 'bestenberg' ),
				'description' => __( 'Design system and page building with Bestenberg.', 'bestenberg' ),
			)
		);
	}

	/**
	 * Registers the abilities.
	 */
	public function register_abilities(): void {
		wp_register_ability(
			self::DESIGN_SYSTEM,
			array(
				'label'               => __( 'Get the Bestenberg design system', 'bestenberg' ),
				'description'         => __( 'Returns the components, design tokens and authoring rules of this site, as instructions for generating page sections.', 'bestenberg' ),
				'category'            => self::CATEGORY,
				'execute_callback'    => array( self::class, 'design_system' ),
				'permission_callback' => static fn(): bool => current_user_can( 'edit_posts' ),
				'output_schema'       => array(
					'type'       => 'object',
					'properties' => array(
						'instructions' => array( 'type' => 'string' ),
						'components'   => array(
							'type'  => 'array',
							'items' => array( 'type' => 'object' ),
						),
						'tokens'       => array( 'type' => 'object' ),
					),
				),
				'meta'                => array(
					'annotations'  => array(
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * The generated AI context (see packages/ai/scripts/generate.mjs).
	 *
	 * @return array{instructions: string, components: list<array<string, mixed>>, tokens: array<string, list<string>>}
	 */
	public static function design_system(): array {
		static $context = null;
		if ( null === $context ) {
			$context = require BESTENBERG_DIR . 'generated/ai-context.php';
		}
		return $context;
	}
}
