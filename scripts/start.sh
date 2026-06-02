#!/bin/sh
set -e

echo "Starting OBA Core..."

# Load Docker secrets into env vars
for var in DATABASE_URL BETTER_AUTH_SECRET INTERNAL_API_KEY; do
  file_var="${var}_FILE"
  file_path=$(eval echo "\$$file_var")
  if [ -n "$file_path" ] && [ -f "$file_path" ]; then
    export "$var=$(cat "$file_path")"
  fi
done

echo "Running database migrations..."
node /app/scripts/migrate.js

echo "Starting application..."
exec node build
