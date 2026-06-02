#!/bin/bash
set -euo pipefail

# =============================================================================
# Deploy Docker Secrets for OBA Core to Contabo VPS
# =============================================================================

VPS_HOST="dvemolina@contabo"

echo "OBA Core — Docker Secrets Setup"
echo "================================"
echo ""

# Generate secrets
DB_PASSWORD=$(openssl rand -base64 24)
DB_USER="obauser"
DB_NAME="oba"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@oba_postgres:5432/${DB_NAME}"
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
INTERNAL_API_KEY=$(openssl rand -hex 32)

echo "Generated secrets:"
echo "  DB_USER:           $DB_USER"
echo "  DB_NAME:           $DB_NAME"
echo "  DB_PASSWORD:       $DB_PASSWORD"
echo "  DATABASE_URL:      $DATABASE_URL"
echo "  BETTER_AUTH_SECRET (truncated): ${BETTER_AUTH_SECRET:0:10}..."
echo "  INTERNAL_API_KEY (truncated):   ${INTERNAL_API_KEY:0:10}..."
echo ""
echo "SAVE THESE — you won't see the full values again."
echo ""
read -r -p "Proceed to deploy secrets to VPS? [y/N] " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || exit 0

ssh "$VPS_HOST" bash << ENDSSH
set -euo pipefail

create_secret() {
  local name=\$1
  local value=\$2
  if docker secret ls --format '{{.Name}}' | grep -q "^\${name}\$"; then
    echo "  \${name} already exists, removing..."
    docker secret rm "\${name}" 2>/dev/null || true
    sleep 1
  fi
  printf '%s' "\${value}" | docker secret create "\${name}" -
  echo "  Created: \${name}"
}

echo "Creating Docker secrets on VPS..."
create_secret "oba_postgres_db"        "${DB_NAME}"
create_secret "oba_postgres_user"      "${DB_USER}"
create_secret "oba_postgres_password"  "${DB_PASSWORD}"
create_secret "oba_database_url"       "${DATABASE_URL}"
create_secret "oba_better_auth_secret" "${BETTER_AUTH_SECRET}"
create_secret "oba_internal_api_key"   "${INTERNAL_API_KEY}"

echo ""
echo "Done. Secrets on VPS:"
docker secret ls | grep oba
ENDSSH

echo ""
echo "Secrets deployed successfully."
