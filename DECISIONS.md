# Architectural Decision Records (ADR)

## ADR-001: Git Repository Boundary Isolation
- **Date**: 2026-11-11
- **Context**: During initial environment inspection, `git rev-parse --show-toplevel` showed `C:\Users\Admin` as the parent repository root because of a previously initialized git repository in the user's home folder.
- **Decision**: Initialized a dedicated Git repository directly inside `c:\Users\Admin\OneDrive\Desktop\Saisree-DevSecOps` with `main` as the default branch.
- **Consequences**: Isolates the capstone repository from unrelated user directory files and ensures clean version tracking and GitHub remote integration.

## ADR-002: Modular CommonJS Backend Architecture
- **Date**: 2026-11-11
- **Context**: Project constraints require Node.js 22 with Express.js, favoring CommonJS unless a clear reason dictates otherwise.
- **Decision**: Standardize backend services and tests on CommonJS (`require` / `module.exports`), retaining Node.js built-in test runner or Jest/Supertest without experimental ESM loader overhead.
- **Consequences**: Maximizes compatibility with standard Node ecosystem libraries (`pg`, `express`, `dotenv`) and avoids module resolution issues on Windows.

## ADR-003: Lightweight Local Development Strategy for Limited RAM
- **Date**: 2026-11-11
- **Context**: Host machine is a Lenovo ThinkPad T440 with an Intel Core i5-4300U dual-core processor and ~8 GB RAM (~650 MB free currently). Docker Desktop and WSL2 are strictly prohibited locally.
- **Decision**:
  - Run backend Express and frontend Vite dev servers directly on native Node.js.
  - Rely on GitHub Actions hosted runners for container builds (Docker), container image scanning (Trivy image), and heavy CI tasks.
  - Defer installing node_modules until Phase 1 and Phase 4 respectively, avoiding unnecessary memory pressure.
- **Consequences**: Prevents system lockups, respects machine hardware limits, and produces identical CI validation on GitHub runners.

## ADR-004: Decoupled CI/CD Pipeline Ingestion with Artifact Fallback
- **Date**: 2026-11-11
- **Context**: Hosted GitHub Actions runners cannot reach a backend running exclusively on `localhost` without a public tunnel or deployed backend.
- **Decision**: The pipeline will output normalized JSON artifacts and decision summaries as workflow artifacts. An ingestion script will allow either direct HTTP POST (if an endpoint is reachable) or safe artifact import into the local backend/database without fabricating live connectivity.
- **Consequences**: Guarantees true academic honesty and functional pipeline gating even when running fully local backend databases.
