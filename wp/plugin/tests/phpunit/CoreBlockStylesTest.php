<?php
/**
 * Utility classes on core blocks.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg\Tests\phpunit;

use Bestenberg\Plugin;
use WP_HTML_Tag_Processor;
use WP_UnitTestCase;

final class CoreBlockStylesTest extends WP_UnitTestCase {

	private static function class_of( string $html, array $query = array() ): ?string {
		$tags = new WP_HTML_Tag_Processor( $html );
		if ( ! $tags->next_tag( $query ) ) {
			return null;
		}
		$class = $tags->get_attribute( 'class' );
		return is_string( $class ) ? $class : null;
	}

	public function test_heading_gets_classes_from_bestenberg_style(): void {
		$html = do_blocks(
			'<!-- wp:heading {"level":3,"bestenberg":{"id":"h","style":{"base":{"font":{"size":"fontSize.xl"}},"desktop":{"font":{"size":"fontSize.3xl"}}},"hidden":{"base":true}}} -->'
			. "\n" . '<h3 class="wp-block-heading">Hi</h3>' . "\n" . '<!-- /wp:heading -->'
		);
		$this->assertSame( 'wp-block-heading bb:text-xl bb:lg:text-3xl bb:max-md:hidden', self::class_of( $html ) );
		$this->assertContains( 'bb:lg:text-3xl', Plugin::instance()->collector()->all() );
	}

	public function test_button_classes_go_on_the_link_not_the_wrapper(): void {
		$html = do_blocks(
			'<!-- wp:buttons --><div class="wp-block-buttons"><!-- wp:button {"bestenberg":{"id":"b","style":{"base":{"background":"color.accent","radius":"radius.md"}}}} -->'
			. '<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="/x">Go</a></div>'
			. '<!-- /wp:button --></div><!-- /wp:buttons -->'
		);
		$this->assertStringNotContainsString( 'bb:', (string) self::class_of( $html, array( 'class_name' => 'wp-block-button' ) ) );
		$this->assertSame(
			'wp-block-button__link wp-element-button bb:bg-accent bb:rounded-md',
			self::class_of( $html, array( 'tag_name' => 'a' ) )
		);
	}

	public function test_image_classes_go_on_the_img(): void {
		$html = do_blocks(
			'<!-- wp:image {"bestenberg":{"id":"i","style":{"base":{"radius":"radius.full","aspect":"1/1"}}}} -->'
			. '<figure class="wp-block-image"><img src="/a.png" alt=""/></figure><!-- /wp:image -->'
		);
		$class = (string) self::class_of( $html, array( 'tag_name' => 'img' ) );
		$this->assertStringContainsString( 'bb:rounded-full', $class );
		$this->assertStringContainsString( 'bb:aspect-square', $class );
		$this->assertStringNotContainsString( 'bb:', (string) self::class_of( $html, array( 'tag_name' => 'figure' ) ) );
	}

	public function test_blocks_without_bestenberg_data_are_untouched(): void {
		$markup = '<!-- wp:paragraph --><p>Plain</p><!-- /wp:paragraph -->';
		$this->assertSame( do_blocks( $markup ), do_blocks( $markup ) );
		$this->assertStringNotContainsString( 'bb:', do_blocks( $markup ) );
	}

	public function test_hostile_bestenberg_data_cannot_inject_markup(): void {
		$html = do_blocks(
			'<!-- wp:paragraph {"bestenberg":{"id":"p","style":{"base":{"color":"color.x\\u0022 onclick=\\u0022alert(1)","font":{"size":"\\u003cscript\\u003e"}}},"hidden":"all"}} -->'
			. '<p>Text</p><!-- /wp:paragraph -->'
		);
		$this->assertStringNotContainsString( 'onclick', $html );
		$this->assertStringNotContainsString( '<script', $html );
		$this->assertStringNotContainsString( 'bb:', $html );
	}
}
