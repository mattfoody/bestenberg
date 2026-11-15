#!/usr/bin/env bash
# Runs WordPress without Docker: PHP's built-in server + SQLite.
# For machines where wp-env (Docker) is not available. Needs git, php (sqlite3).
#
#   bin/wp-sqlite.sh setup    clone WordPress + SQLite integration + wp-cli, install the site
#   bin/wp-sqlite.sh start    serve on http://127.0.0.1:8888 (admin / password)
#   bin/wp-sqlite.sh stop
#   bin/wp-sqlite.sh wp ...   run a wp-cli command
#
# BESTENBERG_WP_DIR sets where it lives (default: .wp-sqlite in the repo, git-ignored).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${BESTENBERG_WP_DIR:-$ROOT/.wp-sqlite}"
WP="$DIR/wordpress"
PORT="${BESTENBERG_WP_PORT:-8888}"
URL="http://127.0.0.1:$PORT"
WP_BRANCH="${BESTENBERG_WP_BRANCH:-7.1-branch}"

wp() {
  php -d memory_limit=512M "$DIR/wpcli/phar/wp-cli-release.phar" --allow-root --path="$WP" "$@"
}

setup() {
  mkdir -p "$DIR"
  [ -d "$WP" ] || git clone -q --depth 1 --branch "$WP_BRANCH" https://github.com/WordPress/WordPress "$WP"
  [ -d "$DIR/sqlite" ] || git clone -q --depth 1 https://github.com/WordPress/sqlite-database-integration "$DIR/sqlite"
  [ -d "$DIR/wpcli" ] || git clone -q --depth 1 https://github.com/wp-cli/builds "$DIR/wpcli"

  local plugin="$WP/wp-content/plugins/sqlite-database-integration"
  rm -rf "$plugin"
  cp -r "$DIR/sqlite/packages/plugin-sqlite-database-integration" "$plugin"
  mkdir -p "$plugin/wp-includes"
  rm -rf "$plugin/wp-includes/database"
  cp -r "$DIR/sqlite/packages/mysql-on-sqlite/src" "$plugin/wp-includes/database"
  sed -e "s#'{SQLITE_IMPLEMENTATION_FOLDER_PATH}'#__DIR__.'/plugins/sqlite-database-integration'#g" \
    -e "s#{SQLITE_PLUGIN}#sqlite-database-integration/load.php#g" \
    "$plugin/db.copy" > "$WP/wp-content/db.php"

  ln -sfn "$ROOT/wp/plugin" "$WP/wp-content/plugins/bestenberg"
  ln -sfn "$ROOT/wp/theme" "$WP/wp-content/themes/bestenberg"
  ln -sfn "$ROOT/tests/e2e/mu-plugins" "$WP/wp-content/mu-plugins"

  cat > "$WP/wp-config.php" <<EOF
<?php
define( 'DB_NAME', 'wordpress' );
define( 'DB_USER', '' );
define( 'DB_PASSWORD', '' );
define( 'DB_HOST', '' );
define( 'DB_CHARSET', 'utf8mb4' );
define( 'DB_COLLATE', '' );
define( 'DB_DIR', '$DIR/database/' );
define( 'DB_FILE', 'wordpress.sqlite' );
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', '$DIR/debug.log' );
define( 'WP_DEBUG_DISPLAY', false );
define( 'SCRIPT_DEBUG', true );
define( 'WP_HTTP_BLOCK_EXTERNAL', true );
define( 'AUTOMATIC_UPDATER_DISABLED', true );
define( 'DISABLE_WP_CRON', true );
define( 'FS_METHOD', 'direct' );
foreach ( array( 'AUTH_KEY', 'SECURE_AUTH_KEY', 'LOGGED_IN_KEY', 'NONCE_KEY', 'AUTH_SALT', 'SECURE_AUTH_SALT', 'LOGGED_IN_SALT', 'NONCE_SALT' ) as \$bestenberg_key ) {
	define( \$bestenberg_key, 'local-only-' . \$bestenberg_key );
}
\$table_prefix = 'wp_';
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}
require_once ABSPATH . 'wp-settings.php';
EOF

  cat > "$DIR/router.php" <<'EOF'
<?php
// Router for PHP's built-in server: serve files, send everything else to WordPress.
$path = parse_url( $_SERVER['REQUEST_URI'], PHP_URL_PATH );
$file = __DIR__ . '/wordpress' . $path;
if ( '/' !== $path && is_file( $file ) && ! str_ends_with( $file, '.php' ) ) {
	return false;
}
if ( is_dir( $file ) && is_file( rtrim( $file, '/' ) . '/index.php' ) ) {
	$path = rtrim( $path, '/' ) . '/index.php';
	$file = __DIR__ . '/wordpress' . $path;
}
if ( is_file( $file ) && str_ends_with( $file, '.php' ) ) {
	$_SERVER['SCRIPT_NAME']     = $path;
	$_SERVER['SCRIPT_FILENAME'] = $file;
	$_SERVER['PHP_SELF']        = $path;
	chdir( dirname( $file ) );
	require $file;
	return true;
}
$_SERVER['SCRIPT_NAME']     = '/index.php';
$_SERVER['SCRIPT_FILENAME'] = __DIR__ . '/wordpress/index.php';
$_SERVER['PHP_SELF']        = '/index.php';
chdir( __DIR__ . '/wordpress' );
require __DIR__ . '/wordpress/index.php';
EOF

  rm -rf "$DIR/database"
  wp core install --url="$URL" --title="Bestenberg" --admin_user=admin --admin_password=password \
    --admin_email=admin@example.com --skip-email
  wp plugin activate bestenberg
  wp theme activate bestenberg
  wp rewrite structure '/%postname%/'
  local existing
  existing="$(wp post list --post_type=page --name=bestenberg-demo --field=ID --post_status=any)"
  [ -z "$existing" ] || wp post delete $existing --force
  wp post create "$ROOT/wp/plugin/tests/fixtures/demo-page.html" --post_type=page --post_status=publish \
    --post_title='Bestenberg Demo' --post_name=bestenberg-demo --user=admin
  echo "Ready. Start with: bin/wp-sqlite.sh start"
}

start() {
  stop
  (cd "$WP" && PHP_CLI_SERVER_WORKERS=4 nohup php -d memory_limit=512M -S "127.0.0.1:$PORT" "$DIR/router.php" \
    > "$DIR/server.log" 2>&1 & echo $! > "$DIR/server.pid")
  for _ in $(seq 1 30); do
    curl -fsS -o /dev/null "$URL/wp-login.php" 2>/dev/null && { echo "WordPress on $URL"; return 0; }
    sleep 0.5
  done
  echo "Server did not start; see $DIR/server.log" >&2
  return 1
}

stop() {
  if [ -f "$DIR/server.pid" ]; then
    kill "$(cat "$DIR/server.pid")" 2>/dev/null || true
    rm -f "$DIR/server.pid"
  fi
}

case "${1:-}" in
  setup) setup ;;
  start) start ;;
  stop) stop ;;
  wp) shift; wp "$@" ;;
  *) echo "usage: bin/wp-sqlite.sh setup|start|stop|wp <args>" >&2; exit 1 ;;
esac
