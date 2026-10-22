# Staging release gate

Staging changes are released only after Fast Change Validation succeeds for the same commit SHA. The deploy workflow must not bypass this gate.

## Validation
- npm ci installs exactly the checked-in lockfile.
- Lint, TypeScript and unit tests pass.
- Production dependency audit passes at high severity.
- Cloudflare staging deploy succeeds for the validated SHA.
- Administration portal is checked in desktop and mobile layouts with authorized roles.

## Safety
Do not clear the staging database, authentication accounts, uploads or secrets as part of code cleanup. Preserve production independently.
