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

## Phase 5: React Dashboard (Next Phase)
- [ ] Install frontend runtime dependencies and build configuration.
- [ ] Implement layout, navigation shell, and theme styling (Tailwind CSS).
- [ ] Implement Security Overview page with metrics and risk charts.
- [ ] Implement Vulnerability Analysis page with severity filtering and search.
- [ ] Implement Pipeline Decisions page with decision rationale breakdown.
- [ ] Implement Scan History page with timeline and past results.
- [ ] Implement Reports page with scan audit details.
- [ ] Connect dashboard pages to real Express REST API endpoints.

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
