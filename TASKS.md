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
- [x] Configure Supabase Session Pooler with small pool (`max: 2`, `min: 0`, `idleTimeout: 30000ms`, `connectionTimeout: 5000ms`).
- [x] Verify Git excludes `backend/.env` with credentials masked across all logs and outputs.
- [x] Install backend runtime packages (`express`, `pg`, `cors`, `dotenv`, `helmet`, `supertest`).
- [x] Implement secure configuration validator & connection string masker (`backend/src/config/env.js`).
- [x] Implement database connection pool with sanitized error logging and transaction helper (`backend/src/database/index.js`).
- [x] Implement idempotent, non-destructive SQL migration with check constraints and audit preservation (`backend/migrations/001_initial_schema.sql`).
- [x] Implement sequential, transactional migration runner with advisory lock (`backend/src/database/migrate.js`).
- [x] Apply initial schema migration to Supabase and verify 8 tables and default policy seed.
- [x] Implement `GET /api/health` returning 200 on DB connected and 503 on DB disconnected.

---

## Phase 2: Risk and Policy Engines (Completed)
- [x] Implement deterministic finding scoring with 85% severity floor protection against low CVSS (`backend/src/risk-engine/index.js`).
- [x] Implement discrete bounded aggregate risk formula with dominant-finding tie-breaking and duplicate deduplication.
- [x] Implement configurable policy evaluation engine (`PASS`, `WARN`, `BLOCK`) with clean separation of decision and enforcement (`fail_on_block`) (`backend/src/policy-engine/index.js`).
- [x] Implement policy service for active policy retrieval with missing/multiple policy validation (`backend/src/services/policy.service.js`).
- [x] Implement assessment service for atomic transactional persistence into `security_findings`, `risk_assessments`, and `pipeline_decisions` (`backend/src/services/assessment.service.js`).
- [x] Add unit tests covering clean scans, low, medium, high, critical, CVSS modulation, floor protection, deduplication, tie-breaking, score capping, policy rules, and `fail_on_block` (`24 passed, 0 failed`).
- [x] Add integration tests verifying live Supabase persistence and query verification (`4 passed, 0 failed`).

---

## Phase 3: Security Scanner Integration (Next Phase)
- [ ] Implement Semgrep CLI process runner with timeout and secure parameterization.
- [ ] Implement Semgrep JSON output normalizer.
- [ ] Implement Trivy CLI process runner for filesystem/SCA dependencies.
- [ ] Implement Trivy JSON output normalizer.
- [ ] Implement scanner test harness using recorded fixture payloads for offline verification.
- [ ] Add scanner error handling (missing tool, process timeout, non-zero exits).

---

## Phase 4: React Dashboard
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
