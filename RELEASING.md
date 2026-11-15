# Releasing Bestenberg

Sites running Bestenberg get updates from your own update server, not wordpress.org.
The plugin and theme headers say `Update URI: https://updates.mattfoody.com/bestenberg/`;
WordPress asks Bestenberg's updater, which reads `info.json` from that URL. Updates then
show up in **Dashboard → Updates** like any other plugin, and auto-updates work.

## Every release

```bash
pnpm release:bump 0.2.0        # sets the version everywhere, moves "Unreleased" in CHANGELOG.md, commits, tags v0.2.0
git push --follow-tags         # GitHub Actions builds, uploads to the server and creates a GitHub release
```

Write changelog entries under `## Unreleased` in `CHANGELOG.md` as you go; they become the
release notes and the "View details → Changelog" tab in WordPress.

**Without GitHub Actions** (same result, from your machine):

```bash
pnpm release:build
BESTENBERG_DEPLOY_TARGET=deploy@your-vps:/var/www/updates/bestenberg/ pnpm release:deploy
```

## What gets published

```
https://updates.mattfoody.com/bestenberg/
  plugin/info.json                 latest plugin version + download URL
  plugin/bestenberg-0.2.0.zip      (old zips stay, for rollbacks)
  theme/info.json
  theme/bestenberg-theme-0.2.0.zip
```

Zips go up before `info.json`, so sites never see an update whose zip is missing.
The updater only accepts packages under the same https base URL.

## One-time setup

### 1. VPS: a static site for updates

```bash
# as root on the VPS
adduser --disabled-password --gecos "" deploy
mkdir -p /var/www/updates/bestenberg
chown -R deploy:deploy /var/www/updates
```

nginx (`/etc/nginx/sites-available/updates.mattfoody.com`):

```nginx
server {
    server_name updates.mattfoody.com;
    root /var/www/updates;
    location / { try_files $uri =404; }
    location ~ /info\.json$ { add_header Cache-Control "no-cache"; }
}
```

```bash
ln -s /etc/nginx/sites-available/updates.mattfoody.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d updates.mattfoody.com      # HTTPS is required by the updater
```

Point the DNS record `updates.mattfoody.com` at the VPS first.

### 2. Deploy key (on your computer)

```bash
ssh-keygen -t ed25519 -N "" -C "bestenberg-deploy" -f bestenberg_deploy
ssh-copy-id -i bestenberg_deploy.pub deploy@your-vps
ssh-keyscan -p 22 your-vps > known_hosts.txt
```

### 3. GitHub secrets

Repository → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
|---|---|
| `DEPLOY_SSH_KEY` | contents of `bestenberg_deploy` (the private key) |
| `DEPLOY_KNOWN_HOSTS` | contents of `known_hosts.txt` |
| `DEPLOY_TARGET` | `deploy@your-vps:/var/www/updates/bestenberg/` |
| `DEPLOY_SSH_PORT` | only if SSH is not on port 22 |

Or with the GitHub CLI: `gh secret set DEPLOY_SSH_KEY < bestenberg_deploy` (and so on).
Then delete the private key file from your computer, or keep it somewhere safe.

### 4. Your sites

Install the first release zip once (Plugins → Add New → Upload, and the same for the theme),
then click **Enable auto-updates** on the plugin and theme. From then on, every tag you
push reaches them automatically.

## License keys

Sites can store a key under **Bestenberg → License**. When one is set, every request WordPress
makes to the update URL (`info.json` and the zips) carries it in the `X-Bestenberg-License`
header. Nothing in the plugin is switched off without a key.

The server ignores the header until you decide to require it. To serve updates to customers
only, keep a list of valid keys on the VPS and let nginx check it:

```nginx
# /etc/nginx/conf.d/bestenberg-keys.conf — one line per customer
map $http_x_bestenberg_license $bestenberg_licensed {
    default        0;
    "KEY-OF-CUSTOMER-1"  1;
    "KEY-OF-CUSTOMER-2"  1;
}
```

```nginx
# inside the server block: info.json stays public, zips need a key
location ~ ^/bestenberg/.+\.zip$ { if ($bestenberg_licensed = 0) { return 403; } }
```

Removing a line ends updates for that key; the site keeps running the version it has.
Pricing and tiers are a business decision (PLAN.md §10) and need no code change.

## Different domain?

Change `Update URI` in `wp/plugin/bestenberg.php` and `wp/theme/style.css` (same value,
https, trailing slash). Sites pick up the new URL with the next release they install.
