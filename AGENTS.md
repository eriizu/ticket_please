# AGENTS.md

Guidelines for agentic coding agents working on ticket_please.

## Project Overview

Ticket management system for student follow-ups. Two deliverables:
- **Backend (be/)**: Rust + Poem + sqlx + PostgreSQL
- **Frontend (fe/)**: React + Bun + TanStack Query/Router + ArkType + Tailwind

## Backend Commands (Rust)

Run from `be/` directory:

```bash
# Build & Run
cargo build                    # Debug build
cargo build --release          # Release build
cargo run                      # Dev server (uses .env)

# Testing
cargo test                     # All tests
cargo test test_name           # Single test by name
cargo test module_name         # Tests in module
cargo test -- --nocapture      # Show println! output

# Database
sqlx migrate add "name"        # Create migration
sqlx migrate run               # Run pending migrations
```

## Frontend Commands (TypeScript/React)

Run from `fe/` directory:

```bash
# Build & Run
bun dev                        # Dev server on port 3001
bun run build                  # Production build (vite + tsc)

# Testing
bun run test                   # All tests (vitest)
bun run test component         # Tests matching "component"
bun run test -- --reporter=verbose

# Linting & Formatting
bun run format                 # Format (biome)
bun run lint                   # Lint (biome)
bun run check                  # Full check: format + lint + typecheck
```

## Backend Code Style (Rust)

### Imports

Group: std -> external -> local, with blank lines between. Use `TraitName as _` for trait imports.

Shallow imports or infrequently used imports should be avoided in favour of qualifying.

```rust
use std::sync::Arc;
use tracing::{error, info, warn};

use crate::db::{Repository, RepoError};
```

### Error Handling

- `thiserror` for domain errors, `anyhow::Result<T>` at boundaries
- Map `RepoError` to `HandlerError` via `impl From`

```rust
#[derive(thiserror::Error, Debug)]
pub enum HandlerError {
    #[error("{context}: not found")]
    NotFound { context: &'static str },
    #[error("{context}: {error}")]
    Sqlx { error: sqlx::Error, context: &'static str },
}
```

### Naming & Types

- snake_case: variables, functions, modules
- PascalCase: types, traits, enums
- Explicit return types on public functions
- `Arc<T>` for shared ownership across async tasks

### Tests

Place in `#[cfg(test)]` mod blocks. Use descriptive names: `fn test_generate_rq_str_with_where()`.

## Frontend Code Style (TypeScript/React)

### Imports

Biome auto-organizes. Use path alias `@/` for src imports:

```typescript
import { useQuery } from "@tanstack/react-query";
import { type } from "arktype";
import { fetchWithETag } from "@/utils/fetchWithETag";
import * as models from "../models";
```

### Types & Validation

Use ArkType for runtime validation schemas:

```typescript
export const SlotBase = type({
  id: "number",
  starts_at: "string.date.parse",
  list_id: "number",
});

// Infer types from schemas
type SlotData = typeof SlotBase.infer;
```

### Components

- Function components with TypeScript, PascalCase names
- Explicit interface for props
- Use `biome-ignore` with explanation for intentional violations

```typescript
/** biome-ignore-all lint/a11y/noStaticElementInteractions: needed for modal */
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}
export function Modal({ isOpen, onClose, children }: ModalProps) { ... }
```

### Hooks & TanStack Query

- Prefix custom hooks with `use`
- Define query keys as const tuples
- Validate API responses with ArkType

```typescript
export const LIST_QUERY_KEY = ["list"] as const;

export function useWaitingLists() {
  return useQuery({
    queryKey: LIST_QUERY_KEY,
    staleTime: 5 * 1000,
    queryFn: async () => {
      const result = await fetchWithETag<WaitingListData>("/api/list");
      const parsed = models.WaitingListRelated.array()(result);
      if (parsed instanceof type.errors) throw parsed;
      return parsed;
    },
  });
}
```

### Formatting

- Biome: spaces for indentation, double quotes for strings
- Files excluded: `routeTree.gen.ts`, `styles.css`

## Project Structure

```
ticket_please/
├── be/
│   ├── src/
│   │   ├── main.rs           # Entry, setup
│   │   ├── db.rs             # Repository, RepoError
│   │   ├── db/               # wlist, wtoken, slot modules
│   │   └── web_server.rs     # Routes, HandlerError
│   └── migrations/
├── fe/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── models.ts         # ArkType schemas
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── routes/           # TanStack Router
│   │   └── utils/
│   └── biome.json
└── Justfile                  # DB wipe/migration tasks
```

## Key Patterns

**Backend error conversion** (`web_server.rs`):
```rust
impl From<crate::db::RepoError> for HandlerError { ... }
```

**Frontend data flow**:
1. Fetch with ETag caching (`fetchWithETag`)
2. Validate with ArkType schemas
3. Store in TanStack Query cache
4. Components access via custom hooks
