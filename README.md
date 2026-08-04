# ARCH.START web deployment project

Clean Next.js deployment source reconstructed from the accepted Phase 06 Pass 1A V2 authority. This project intentionally contains no Git history, hosted-service configuration, credentials, delivery evidence, browser profiles, build output, dependencies, or large course assets.

## Runtime

- Node `24.18.0`
- pnpm `11.17.0`

Copy `.env.example` to a local untracked environment file and supply the existing Supabase public values, the stable site URL, and the public object-storage origin. `NEXT_PUBLIC_ASSET_BASE_URL` must be an HTTP(S) origin or base path without a query or fragment.

All accepted learner-facing asset paths remain `/prototype-assets/...`. When `NEXT_PUBLIC_ASSET_BASE_URL` is set, one centralized temporary redirect sends those requests directly to the same suffix on object storage; application routes and content records are unchanged.

The nine `ARCHSTART_ASSETS_*_V1.zip` packs must be extracted into the object-storage root so that every key begins with `prototype-assets/`. Do not add a pack-root directory to the uploaded key.

## Local gates

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm typecheck:content
pnpm test
pnpm content:validate
pnpm lockfile:verify
pnpm app-shell:check
pnpm design-system:check
pnpm learning:check
pnpm media:check
pnpm quiz:check
pnpm completion:check
pnpm showcase:check
pnpm prototype:security-scan
pnpm prototype:security-scan-selected-a
pnpm build
```

Hosted Supabase, object storage, redirects, Vercel, and live Auth are not configured or accepted by this package.
