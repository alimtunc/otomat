# Cloudflare Containers run linux/amd64 images; CI extracts the daemon deploy bundle to
# ./daemon before `wrangler deploy` builds this. The base (node + git) is prebuilt from
# base.Dockerfile by .github/workflows/preview-base.yml, so only the layers below rebuild per
# commit.
FROM ghcr.io/alimtunc/otomat/preview-base:node22

ENV OTOMAT_DAEMON_HOST=0.0.0.0 \
  OTOMAT_DAEMON_PORT=4331 \
  OTOMAT_DB_PATH=/data/otomat.db \
  OTOMAT_PROJECT_ROOT=/data/test-repo

COPY daemon/ /srv/daemon/
COPY start.sh /srv/start.sh
RUN chmod +x /srv/start.sh

EXPOSE 4331
CMD ["/srv/start.sh"]
