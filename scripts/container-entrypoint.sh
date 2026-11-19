#!/bin/sh
set -eu
if [ "${APP_ENV:-dev}" = "prod" ]; then
  : "${VELOXA_PASSPHRASE:?VELOXA_PASSPHRASE must be set when APP_ENV=prod.}"
fi
bun scripts/container-init.ts
exec bun apps/api/src/index.ts
