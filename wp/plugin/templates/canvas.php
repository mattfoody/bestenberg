<?php
/**
 * Bare page for editing templates and template parts: the site's styles and
 * scripts around an empty canvas root. Loaded by Bestenberg\Editor\Canvas.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

use Bestenberg\Editor\Canvas;

defined( 'ABSPATH' ) || exit;
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<div class="wp-site-blocks"><div id="<?php echo esc_attr( Canvas::ROOT_ID ); ?>"></div></div>
<?php wp_footer(); ?>
</body>
</html>
