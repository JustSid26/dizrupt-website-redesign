#!/bin/sh
# Build the static site and push it to the VPS. Caddy serves new files immediately.
set -e
cd "$(dirname "$0")"
npx next build --turbopack
rsync -az --delete out/ root@200.97.169.161:/root/dizrupt-site/www/
