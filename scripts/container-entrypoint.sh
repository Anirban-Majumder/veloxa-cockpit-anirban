#!/bin/sh
set -eu
bun scripts/container-init.ts
exec bun apps/api/src/index.ts
