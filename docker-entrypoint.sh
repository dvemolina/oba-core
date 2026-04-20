#!/bin/sh
# Read Docker secrets from _FILE env vars and export them as plain env vars.
# Convention: FOO_FILE=/run/secrets/bar → export FOO=$(cat /run/secrets/bar)
for var in DATABASE_URL BETTER_AUTH_SECRET ORIGIN; do
  file_var="${var}_FILE"
  file_path=$(eval echo "\$$file_var")
  if [ -n "$file_path" ] && [ -f "$file_path" ]; then
    export "$var=$(cat "$file_path")"
  fi
done

exec node build
