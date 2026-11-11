# Project Implementation Tasks

## Phase 0: Project Foundation (Current)
- [x] Inspect workspace, OS, memory, Node, npm, Git, and database availability.
- [x] Establish isolated Git repository in workspace root (`Saisree-DevSecOps`).
- [x] Create project directory tree (`frontend`, `backend`, `security-tests`, `docker`, `.github`, `docs`).
- [x] Create safe `.gitignore` and `.env.example` templates.
- [x] Create frontend and backend configuration baselines (`package.json`, `vite.config.js`, `tailwind.config.js`).
- [x] Establish project management tracking docs (`README.md`, `PROJECT_CONTEXT.md`, `TASKS.md`, `DECISIONS.md`, `HANDOFF.md`, `docs/IMPLEMENTATION_STATUS.md`).
- [ ] Present Phase 0 report and receive student approval to proceed to Phase 1.

---

## Phase 1: Database and Backend Foundation
- [ ] Determine PostgreSQL installation / connection strategy on Windows host.
- [ ] Set up PostgreSQL database schema and migration scripts (`scans`, `findings`, `risk_assessments`, `policies`, `decisions`).
- [ ] Install backend runtime dependencies (`express`, `pg`, `cors`, `dotenv`, `helmet`).
- [ ] Implement Express server initialization with clean error-handling and security headers.
- [ ] Implement `GET /api/health` endpoint.
- [ ] Implement database connection pool and test connectivity.
- [ ] Verify Phase 1 with automated unit tests for health & DB connectivity.

---

## Phase 2: Risk and Policy Engines
- [ ] Define normalized finding data contract and validator.
- [ ] Implement deterministic risk assessment engine formula.
- [ ] Implement unit tests for risk scoring across various severities and context factors.
- [ ] Implement configurable policy evaluation engine (PASS, WARN, BLOCK).
- [ ] Implement policy evaluation unit tests covering all three decision branches.
- [ ] Store policy configuration and version history schema.

---

## Phase 3: Security Scanner Integration
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
