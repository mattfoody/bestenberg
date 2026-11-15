<?php
/**
 * License key for updates.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg\Licensing;

use Bestenberg\Admin\EditorPage;

/**
 * Stores a license key and sends it to the update server.
 *
 * Bestenberg is GPL and never switches features off: the key only identifies
 * a customer to the update server, which may require it before serving new
 * versions (see RELEASING.md). Without a key nothing extra is sent.
 */
final class License {

	public const OPTION     = 'bestenberg_license_key';
	public const PAGE       = 'bestenberg-license';
	public const GROUP      = 'bestenberg_license';
	public const HEADER     = 'X-Bestenberg-License';
	public const MAX_LENGTH = 100;

	/**
	 * Constructor.
	 *
	 * @param string $update_url Update base URL with trailing slash ('' = updates are off).
	 */
	public function __construct( private string $update_url ) {}

	/**
	 * Registers hooks.
	 */
	public function register(): void {
		add_action( 'admin_init', array( $this, 'register_setting' ) );
		add_action( 'admin_menu', array( $this, 'add_page' ), 20 );
		add_filter( 'http_request_args', array( $this, 'request_args' ), 10, 2 );
	}

	/**
	 * The stored key ('' = none).
	 */
	public static function key(): string {
		return self::sanitize( get_option( self::OPTION, '' ) );
	}

	/**
	 * Keeps letters, digits and dashes.
	 *
	 * @param mixed $value Submitted value.
	 */
	public static function sanitize( mixed $value ): string {
		if ( ! is_string( $value ) ) {
			return '';
		}
		return substr( (string) preg_replace( '/[^A-Za-z0-9-]/', '', $value ), 0, self::MAX_LENGTH );
	}

	/**
	 * Registers the option.
	 */
	public function register_setting(): void {
		register_setting(
			self::GROUP,
			self::OPTION,
			array(
				'type'              => 'string',
				'sanitize_callback' => array( self::class, 'sanitize' ),
				'default'           => '',
				'show_in_rest'      => false,
			)
		);
	}

	/**
	 * Adds Bestenberg → License.
	 */
	public function add_page(): void {
		add_submenu_page(
			EditorPage::SLUG,
			__( 'Bestenberg license', 'bestenberg' ),
			__( 'License', 'bestenberg' ),
			'manage_options',
			self::PAGE,
			array( $this, 'render' )
		);
	}

	/**
	 * Adds the key to requests that go to the update server, and to no others.
	 *
	 * @param array<string, mixed> $args Request arguments.
	 * @param string               $url  Request URL.
	 * @return array<string, mixed>
	 */
	public function request_args( array $args, string $url ): array {
		$key = self::key();
		if ( '' === $key || '' === $this->update_url || ! str_starts_with( $url, $this->update_url ) ) {
			return $args;
		}
		$headers                 = is_array( $args['headers'] ?? null ) ? $args['headers'] : array();
		$headers[ self::HEADER ] = $key;
		$args['headers']         = $headers;
		return $args;
	}

	/**
	 * Renders the settings page.
	 */
	public function render(): void {
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Bestenberg license', 'bestenberg' ); ?></h1>
			<p>
				<?php esc_html_e( 'A license key gives this site updates and support. Bestenberg keeps working without one, and your pages stay regular WordPress content either way.', 'bestenberg' ); ?>
			</p>
			<form method="post" action="options.php">
				<?php settings_fields( self::GROUP ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="bestenberg-license-key"><?php esc_html_e( 'License key', 'bestenberg' ); ?></label></th>
						<td>
							<input
								type="text"
								class="regular-text code"
								id="bestenberg-license-key"
								name="<?php echo esc_attr( self::OPTION ); ?>"
								value="<?php echo esc_attr( self::key() ); ?>"
								maxlength="<?php echo esc_attr( (string) self::MAX_LENGTH ); ?>"
								autocomplete="off"
								spellcheck="false"
							>
							<p class="description">
								<?php
								if ( '' === $this->update_url ) {
									esc_html_e( 'Updates are switched off in this copy of Bestenberg.', 'bestenberg' );
								} else {
									printf(
										/* translators: %s: update server address. */
										esc_html__( 'The key is sent only to %s when WordPress checks for or downloads Bestenberg updates.', 'bestenberg' ),
										'<code>' . esc_html( (string) wp_parse_url( $this->update_url, PHP_URL_HOST ) ) . '</code>'
									);
								}
								?>
							</p>
						</td>
					</tr>
				</table>
				<?php submit_button( __( 'Save license', 'bestenberg' ) ); ?>
			</form>
		</div>
		<?php
	}
}
