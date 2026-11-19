#!/bin/sh
set -eu
: "${VELOXA_PASSPHRASE:?VELOXA_PASSPHRASE must be set in production.}"
bun scripts/container-init.ts
exec bun apps/api/src/index.ts
