# Project memory

## Product intent & audience

- **Shadowmarket** — a marketplace web application built with Vite + React.
- Core entities: products, orders, disputes, brand tokens, and brand token settings.
- Supports an admin portal and a brand catalog for managing products and operations.
- Designed to be production-ready and fully featured.

## Brand personality & voice

- App is named "Shadowmarket"; implies a sleek, possibly edgy or underground marketplace aesthetic.
- No explicit brand voice defined yet beyond `.bolt/prompt`'s directive for beautiful, non-cookie-cutter designs.

## Visual design & UX direction

- UI built with JSX + Tailwind CSS classes; icons from `lucide-react`.
- Must avoid cookie-cutter templates; production-quality visual polish expected.
- App gracefully handles empty states (e.g., when database tables have no rows).
- Responsive behavior and accessibility specifics not yet inferred.

## Decisions, constraints & rationale

- **Supabase backend** — PostgreSQL via Supabase is the data layer.
- Five database tables confirmed: `products`, `orders`, `disputes`, `brand_tokens`, `brand_token_settings`.
- Supabase client reads from env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) with hardcoded fallback values for immediate connectivity.
- Supabase URL must not include `/rest/v1/` suffix.
- `.env` file exists at project root with Supabase credentials.
- Build compiles cleanly with zero errors.
- No additional UI/theme/icon packages should be installed beyond what the template provides (Tailwind, Lucide React).
- Database is currently empty (0 rows across all tables); data must be added through the app (brand catalog or admin portal) before UI shows content.

## Open questions & assumptions

- What is the brand token system's full feature scope? (brand_tokens vs. brand_token_settings distinction unclear.)
- Are there user authentication/roles beyond admin and brand? Buyer accounts assumed but unconfirmed.
- No seed data or migrations tracked in-project yet — assumed schema is managed directly in Supabase.
- Responsive breakpoints, color palette, and typography specifics remain to be defined per design requests.