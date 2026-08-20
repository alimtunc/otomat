# The preview host's runtime base, prebuilt by .github/workflows/preview-base.yml so a
# pull-request provision never runs apt-get: only the COPY layers of Dockerfile rebuild per commit.
FROM node:22-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*
