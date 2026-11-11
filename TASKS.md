# Project Implementation Tasks

## Phase 0: Project Foundation (Completed)
- [x] Inspect workspace, OS, memory, Node, npm, Git, and database availability.
- [x] Establish isolated Git repository in workspace root (`Saisree-DevSecOps`).
- [x] Create project directory tree (`frontend`, `backend`, `security-tests`, `docker`, `.github`, `docs`).
- [x] Create safe `.gitignore` and `.env.example` templates.
- [x] Create frontend and backend configuration baselines (`package.json`, `vite.config.js`, `tailwind.config.js`).
- [x] Establish project management tracking docs.

---

## Phase 1: Database and Backend Foundation (Completed)
- [x] Configure Supabase Session Pooler with small pool (`max: 2`, `min: 0`, `idleTimeout: 30000ms`, `connectionTimeout: 15000ms`).
- [x] Verify Git excludes `backend/.env` with credentials masked across all logs and outputs.
- [x] Install backend runtime packages (`express`, `pg`, `cors`, `dotenv`, `helmet`, `supertest`).
- [x] Implement secure configuration validator & connection string masker (`backend/src/config/env.js`).
- [x] Implement database connection pool with sanitized error logging and transaction helper (`backend/src/database/index.js`).
- [x] Implement idempotent, non-destructive SQL migration with check constraints and audit preservation (`backend/migrations/001_initial_schema.sql`).
- [x] Apply initial schema migration to Supabase and verify 8 tables and default policy seed.
- [x] Implement `GET /api/health` returning 200 on DB connected and 503 on DB disconnected.

---

## Phase 2: Risk and Policy Engines (Completed)
- [x] Implement deterministic finding scoring with 85% severity floor protection against low CVSS (`backend/src/risk-engine/index.js`).
- [x] Implement discrete bounded aggregate risk formula with dominant-finding tie-breaking and duplicate deduplication.
- [x] Implement configurable policy evaluation engine (`PASS`, `WARN`, `BLOCK`) with clean separation of decision and enforcement (`fail_on_block`) (`backend/src/policy-engine/index.js`).
- [x] Implement policy service for active policy retrieval with missing/multiple policy validation (`backend/src/services/policy.service.js`).
- [x] Implement assessment service for atomic transactional persistence into `security_findings`, `risk_assessments`, and `pipeline_decisions` (`backend/src/services/assessment.service.js`).
- [x] Implement finding persistence idempotency and re-assessment regression test.

---

## Phase 3: Security Scanner Integration (Completed)
- [x] Implement safe Semgrep CLI process runner with timeout and secure parameterization (`backend/src/scanners/semgrep.runner.js`).
- [x] Implement conservative, documented Semgrep JSON output normalizer (`backend/src/normalizers/semgrep.normalizer.js`).
- [x] Implement safe Trivy CLI process runner for filesystem and container image scans (`backend/src/scanners/trivy.runner.js`).
- [x] Implement Trivy JSON output normalizer with multi-source CVSS extraction and validation (`backend/src/normalizers/trivy.normalizer.js`).
- [x] Implement scanner orchestrator service with atomic `scanner_metadata` persistence and failure gating (`backend/src/services/orchestrator.service.js`).
- [x] Add offline authentic scanner fixtures (`semgrep-sample.json`, `trivy-sample.json`).
- [x] Create controlled sample test apps (`security-tests/safe-app`, `security-tests/moderate-risk-app`, `security-tests/vulnerable-app`).
- [x] Add unit tests for Semgrep/Trivy runners, timeouts, missing CLIs, and normalizers (`35 unit tests passed`).
- [x] Add live Supabase integration tests for orchestrator persistence and scanner failure handling (`7 integration tests passed`).

---

## Phase 4: CI/CD Pipeline Integration (Completed / In Progress)
- [x] **Step 1: Docker Readiness**: Multi-stage production `backend/Dockerfile` and `backend/.dockerignore` with non-root user.
- [x] **Step 2: Secure Scan Ingestion API**: `POST /api/scans/ingest`, timing-safe `apiKeyAuth`, mandatory scanner coverage validator (`semgrep`, `trivy_fs`, `trivy_image`), 10MB payload limit.
- [x] **Step 3: CI Evaluation Integration**: CLI evaluation client (`backend/src/cli/ci-evaluate.js`) and GitHub Actions workflow (`.github/workflows/security-pipeline.yml`) with fail-closed gate evaluation.
- [x] **Step 4: Production Readiness & Server Lifecycle**: Explicit `0.0.0.0` host binding, graceful shutdown (`SIGTERM`/`SIGINT`), in-flight request draining, bounded timeout, dedicated `/api/health/live` and `/api/health/ready` probes, strict production API_KEY validation, strict production TLS verification enforcement; 73/73 unit tests passing.

---

## Phase 5: React Dashboard (In Progress)
- [x] **Step 1: Backend API Read Support & Safe Authentication Split**:
  - Keep `POST /api/scans/ingest` strictly protected by timing-safe `apiKeyAuth`.
  - Expose public, rate-limited read endpoints for dashboard consumption (`GET /api/dashboard/stats`, `GET /api/scans`, `GET /api/scans/:id`, `GET /api/scans/:id/full`, `GET /api/scans/:id/findings`, `GET /api/policies`).
  - Implement query parameter validation, pagination limits (max 100 ceiling), and filter whitelisting.
  - Implement in-memory sliding window rate limiter (`backend/src/middleware/rateLimiter.js`).
  - Sanitize and allowlist all response fields; strictly exclude `raw_payload`.
  - Add comprehensive unit tests (85/85 unit tests passing across 11 test suites).
- [x] **Step 2: Frontend Core Foundation & Layout Navigation**:
  - Install dependencies (React 18, React Router v7, Tailwind CSS 3, Lucide React, Axios, Recharts).
  - Implement full theme management with persistent dark/light mode toggle (`useTheme.jsx`) and system preference fallback.
  - Implement reusable UI design system (`Card`, `Badge`, `StatCard`, `Spinner`, `EmptyState`, `ErrorBoundary`).
  - Implement responsive application layout (`DashboardLayout.jsx`, `Sidebar.jsx`, `Header.jsx`) with mobile drawer.
  - Establish backend API services layer (`api.js`, `dashboardService.js`, `scanService.js`, `policyService.js`).
  - Implement foundation pages for all 7 views (`Overview`, `Scans`, `ScanDetails`, `Findings`, `Risk`, `Policies`, `Scanners`).
  - Verified Vite production build (`dist/` generated in 16.15s with 0 errors).
- [x] **Step 3: Interactive Visualizations, Analytics & Deep-Dive Views**:
  - Implemented interactive Recharts `SeverityDonutChart` with custom tooltips, legend, and centered total badge.
  - Implemented Recharts `RiskTrendChart` with chronological scan progression and active policy WARN/BLOCK reference ceiling lines.
  - Made the header commit badge dynamic using live scan data (`latestScan.commit_hash.slice(0, 7)`).
  - Corrected Pipeline Gate Pass Rate to reflect genuine PASS decisions, providing clear secondary non-blocking rate (PASS + WARN).
  - Displayed completed, running, and failed scan counts accurately from live backend metrics.
  - Enhanced `ScanHistoryPage` with full server-side pagination, decision pills, status filter dropdown, and branch search.
  - Enhanced `FindingsExplorerPage` with search by rule/CWE/file, scanner filter (`semgrep`, `trivy_fs`, `trivy_image`), severity pills, server-side pagination, and remediation drawers with fixed version info.
  - Enhanced `ScanDetailsPage` with comprehensive scan audit, policy threshold comparisons, scanner execution telemetry, and deep-linking to findings.
  - Improved `RiskAnalysisPage` with formula architecture, mathematical explanations, 85% floor protections, and bounded density bonus justifications.
  - Improved `ScannerTelemetryPage` with transparency distinctions between synthetic `fixture-mock` runs and production CI executions.
  - Verified with frontend production build (`2097 modules transformed, 0 errors in 18.76s`), 85/85 backend unit tests passing, and 10/10 live Supabase integration tests passing.
- [x] **Step 4: Final Integration & System Validation**:
  - Verified complete end-to-end CI/CD pipeline from GitHub push through Semgrep, Trivy filesystem, Docker build, Trivy image scan, backend ingestion, and Supabase persistence.
  - Confirmed fail-closed policy enforcement: BLOCK triggers non-zero exit code (`1`), PASS and WARN exit cleanly (`0`).
  - Audited dashboard integration across all 7 views with live Supabase telemetry and accurate charts.
  - Validated failure simulation: malformed UUIDs (HTTP 400), non-existent scans (HTTP 404), rate-limit bursts (HTTP 429), and fail-closed scanner evaluation.
  - Completed security audit: zero secrets in frontend source or compiled distribution bundles, parameterized queries, public rate-limiting, and timing-safe API key authentication on ingestion.
  - Verified frontend production build (2097 modules, 0 errors in 16.10s) and full test suite (85 unit + 10 integration = 95/95 tests passing).

---

## Phase 5: GitHub Actions and Containerization
- [ ] Create Dockerfile for backend service.
- [ ] Create Dockerfile for frontend service.
- [ ] Write GitHub Actions workflow (`.github/workflows/security-pipeline.yml`).
- [ ] Integrate Semgrep SAST step in CI.
- [ ] Integrate Trivy filesystem/SCA step in CI.
- [ ] Integrate Docker image build on hosted runner.
- [ ] Integrate Trivy container image scan on hosted runner.
- [ ] Implement pipeline decision gating (`BLOCK` triggers CI failure exit code 1).
- [ ] Implement artifact upload fallback for decoupled dashboard reporting.

---

## Phase 6: End-to-End Testing with Controlled Scenarios
- [ ] Construct `safe-app` scenario (expected: PASS).
- [ ] Construct `moderate-risk-app` scenario (expected: WARN).
- [ ] Construct `vulnerable-app` scenario (expected: BLOCK).
- [ ] Execute CI/CD pipeline runs against all three scenarios.
- [ ] Verify database ingestion and dashboard rendering of real scenario runs.
- [ ] Record empirical evaluation metrics (scan duration, detection rates, gate accuracy).

---

## Phase 7: Documentation and Final Release
- [ ] Document final architecture diagrams and sequence flows.
- [ ] Document database ERD and API specifications.
- [ ] Document proposed risk scoring model and weight justification.
- [ ] Compile experimental evaluation table and final capstone project report.
- [ ] Produce final project demonstration checklist and handover notes.
