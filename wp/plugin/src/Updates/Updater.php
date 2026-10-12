<?php
/**
 * Self-hosted updates for the plugin and theme.
 *
 * @package Bestenberg
 */

declare( strict_types=1 );

namespace Bestenberg\Updates;

/**
 * Serves WordPress updates from Bestenberg's own update server.
 *
 * The plugin and theme headers carry `Update URI: https://<host>/bestenberg/`.
 * WordPress then asks the `update_plugins_<host>` / `update_themes_<host>`
 * filters instead of wordpress.org. This class answers them from
 * `<base>plugin/info.json` and `<base>theme/info.json`, which `pnpm release`
 * publishes. Packages are only accepted from the same https base URL.
 *
 * @phpstan-type Info array{name: string, version: string, download_url: string, homepage: string, requires: string, requires_php: string, tested: string, last_updated: string, sections: array<string, string>}
 */
final class Updater {

	public const SLUG = 'bestenberg';

	/**
	 * Constructor.
	 *
	 * @param string $base_url    Update base URL with trailing slash.
	 * @param string $plugin_file Plugin basename, e.g. "bestenberg/bestenberg.php".
	 */
	public function __construct(
		private string $base_url,
		private string $plugin_file
	) {}

	/**
	 * Builds the updater from the plugin's `Update URI` header.
	 */
	public static function from_plugin_header(): ?self {
		$headers = get_file_data( BESTENBERG_FILE, array( 'uri' => 'Update URI' ) );
		$uri     = $headers['uri'];
		if ( '' === $uri || 'https' !== wp_parse_url( $uri, PHP_URL_SCHEME ) || ! wp_parse_url( $uri, PHP_URL_HOST ) ) {
			return null;
		}
		return new self( trailingslashit( $uri ), plugin_basename( BESTENBERG_FILE ) );
	}

	/**
	 * Registers hooks.
	 */
	public function register(): void {
		$host = (string) wp_parse_url( $this->base_url, PHP_URL_HOST );
		add_filter( "update_plugins_{$host}", array( $this, 'plugin_update' ), 10, 3 );
		add_filter( "update_themes_{$host}", array( $this, 'theme_update' ), 10, 3 );
		add_filter( 'plugins_api', array( $this, 'plugin_information' ), 20, 3 );
		add_action( 'upgrader_process_complete', array( $this, 'flush' ) );
	}

	/**
	 * Update data for the plugin (WordPress compares versions).
	 *
	 * @param mixed                $update      Update so far (false).
	 * @param array<string, mixed> $plugin_data Plugin headers.
	 * @param string               $plugin_file Plugin basename.
	 * @return mixed
	 */
	public function plugin_update( mixed $update, array $plugin_data, string $plugin_file ): mixed {
		if ( $plugin_file !== $this->plugin_file ) {
			return $update;
		}
		$info = $this->info( 'plugin' );
		if ( null === $info ) {
			return $update;
		}
		return array(
			'id'           => $this->base_url . 'plugin/',
			'slug'         => self::SLUG,
			'version'      => $info['version'],
			'url'          => $info['homepage'],
			'package'      => $info['download_url'],
			'tested'       => $info['tested'],
			'requires'     => $info['requires'],
			'requires_php' => $info['requires_php'],
		);
	}

	/**
	 * Update data for the theme.
	 *
	 * @param mixed                $update     Update so far (false).
	 * @param array<string, mixed> $theme_data Theme headers.
	 * @param string               $stylesheet Theme directory name.
	 * @return mixed
	 */
	public function theme_update( mixed $update, array $theme_data, string $stylesheet ): mixed {
		if ( self::SLUG !== $stylesheet ) {
			return $update;
		}
		$info = $this->info( 'theme' );
		if ( null === $info ) {
			return $update;
		}
		return array(
			'theme'        => $stylesheet,
			'version'      => $info['version'],
			'url'          => $info['homepage'],
			'package'      => $info['download_url'],
			'requires'     => $info['requires'],
			'requires_php' => $info['requires_php'],
		);
	}

	/**
	 * "View details" data for the plugin.
	 *
	 * @param mixed  $result Result so far.
	 * @param string $action plugins_api action.
	 * @param mixed  $args   Request arguments.
	 * @return mixed
	 */
	public function plugin_information( mixed $result, string $action, mixed $args ): mixed {
		if ( 'plugin_information' !== $action || ! is_object( $args ) || self::SLUG !== ( $args->slug ?? null ) ) {
			return $result;
		}
		$info = $this->info( 'plugin' );
		if ( null === $info ) {
			return $result;
		}
		return (object) array(
			'name'          => $info['name'],
			'slug'          => self::SLUG,
			'version'       => $info['version'],
			'author'        => '<a href="https://mattfoody.com">Matt Foody</a>',
			'homepage'      => $info['homepage'],
			'requires'      => $info['requires'],
			'requires_php'  => $info['requires_php'],
			'tested'        => $info['tested'],
			'last_updated'  => $info['last_updated'],
			'download_link' => $info['download_url'],
			'sections'      => array_map( 'wp_kses_post', $info['sections'] ),
		);
	}

	/**
	 * Clears cached update data (after any update completes).
	 */
	public function flush(): void {
		delete_site_transient( 'bestenberg_update_plugin' );
		delete_site_transient( 'bestenberg_update_theme' );
	}

	/**
	 * Release info for "plugin" or "theme", cached for an hour (failures for 15 minutes).
	 *
	 * @param string $kind "plugin" or "theme".
	 * @return Info|null
	 */
	public function info( string $kind ): ?array {
		$key    = 'bestenberg_update_' . $kind;
		$cached = get_site_transient( $key );
		if ( is_array( $cached ) ) {
			return array() === $cached ? null : $this->validate( $cached );
		}

		$response = wp_remote_get( $this->base_url . $kind . '/info.json', array( 'timeout' => 10 ) );
		$info     = null;
		if ( ! is_wp_error( $response ) && 200 === wp_remote_retrieve_response_code( $response ) ) {
			$info = $this->validate( json_decode( wp_remote_retrieve_body( $response ), true ) );
		}

		set_site_transient( $key, $info ?? array(), null === $info ? 15 * MINUTE_IN_SECONDS : HOUR_IN_SECONDS );
		return $info;
	}

	/**
	 * Accepts only well-formed info whose package lives under the update base URL.
	 *
	 * @param mixed $data Decoded info.json.
	 * @return Info|null
	 */
	private function validate( mixed $data ): ?array {
		if ( ! is_array( $data ) ) {
			return null;
		}
		$version = $data['version'] ?? null;
		$package = $data['download_url'] ?? null;
		if ( ! is_string( $version ) || 1 !== preg_match( '/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/', $version ) ) {
			return null;
		}
		if ( ! is_string( $package ) || ! str_starts_with( $package, $this->base_url ) || str_contains( $package, '..' ) ) {
			return null;
		}

		$text     = static fn( mixed $value ): string => is_string( $value ) ? sanitize_text_field( $value ) : '';
		$sections = array();
		if ( is_array( $data['sections'] ?? null ) ) {
			foreach ( $data['sections'] as $name => $html ) {
				if ( is_string( $name ) && is_string( $html ) ) {
					$sections[ sanitize_key( $name ) ] = $html;
				}
			}
		}

		return array(
			'name'         => '' === $text( $data['name'] ?? null ) ? 'Bestenberg' : $text( $data['name'] ),
			'version'      => $version,
			'download_url' => $package,
			'homepage'     => esc_url_raw( is_string( $data['homepage'] ?? null ) ? $data['homepage'] : '' ),
			'requires'     => $text( $data['requires'] ?? null ),
			'requires_php' => $text( $data['requires_php'] ?? null ),
			'tested'       => $text( $data['tested'] ?? null ),
			'last_updated' => $text( $data['last_updated'] ?? null ),
			'sections'     => $sections,
		);
	}
}
