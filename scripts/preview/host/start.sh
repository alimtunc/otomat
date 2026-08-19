#!/bin/sh
# The container disk is ephemeral: every cold start reseeds the fixture repository and starts
# the daemon on a fresh database, which is exactly what a preview should test against.
set -eu
mkdir -p /data/test-repo
if [ ! -d /data/test-repo/.git ]; then
  git -C /data/test-repo init -q -b main
  printf '# Preview fixture\n' > /data/test-repo/README.md
  git -C /data/test-repo add README.md
  git -C /data/test-repo -c user.name=Otomat -c user.email=preview@otomat.local \
    commit -q -m "chore: seed the preview fixture"
fi
exec node /srv/daemon/dist/index.js
