# hackohio-2026
HackOHI/O 2026 project (change from here)

## Local LLDAP

LLDAP provides the LDAP directory for local authentication development. Its
web admin is available at <http://localhost:17170>; LDAP listens on
`localhost:3890`. Data is persisted in `data/lldap/` and is not checked in.

1. Copy `.env.example` to `.env.local`.
2. Generate two independent secrets with `openssl rand -hex 32`, and set
   `LLDAP_JWT_SECRET` and `LLDAP_KEY_SEED`. Set `LLDAP_LDAP_USER_PASS` to a
   strong password for the initial `admin` account.
3. Start LLDAP with `docker compose --env-file .env.local up -d`.
4. Sign in to the admin UI as `admin` using `LLDAP_LDAP_USER_PASS`. Create
   users with the same usernames as their `auth_username` values in MongoDB
   (`dylan`, `raddy`, `naz` and `debora`), then add groups as needed.

Stop it with `docker compose --env-file .env.local down`. To connect Authelia,
use `ldap://lldap:3890` when it shares LLDAP's Docker network, or
`ldap://localhost:3890` when it runs directly on the host. Set Authelia's base
DN to `LLDAP_LDAP_BASE_DN`, bind as
`uid=admin,ou=people,${LLDAP_LDAP_BASE_DN}` with `LLDAP_LDAP_USER_PASS`, and
configure its user filter to match the usernames above. Do not expose these
development ports to a public network.
