# Implementation Status & Verification Ledger

## Phase Progress Overview

| Phase | Description | Status | Verification / Evidence |
| :--- | :--- | :--- | :--- |
| **Phase 0** | Project Foundation | **COMPLETED** | Folder structure, config files, Git initialization, documentation created |
| **Phase 1** | Database and Backend Foundation | **COMPLETED** | Migration applied successfully to Supabase; 8 tables verified, seed verified, 8/8 tests passing |
| **Phase 2** | Risk and Policy Engines | **COMPLETED** | Deterministic scoring with 85% floor protection, deduplication, tie-breaking; active policy evaluation; atomic Supabase persistence; 28/28 tests passing |
| **Phase 3** | Security Scanner Integration | **COMPLETED** | Semgrep & Trivy runners (`execFile`), conservative normalizers, orchestrator with atomic `scanner_metadata` & failure `BLOCK` persistence (`ON CONFLICT`), controlled test apps; 45/45 tests passing |
| **Phase 4** | React Dashboard | PENDING | Awaiting student authorization to begin |
| **Phase 5** | GitHub Actions & Containerization | PENDING | - |
| **Phase 6** | End-to-End Testing (3 Scenarios) | PENDING | - |
| **Phase 7** | Evaluation & Final Documentation | PENDING | - |

---

## Phase 3 Verification Record

- **CLI Runners**:
  - `backend/src/scanners/semgrep.runner.js`: `execFile` parameterization, 60s timeout, `TOOL_NOT_INSTALLED`, `EXECUTION_TIMEOUT`, `EXECUTION_FAILED`.
  - `backend/src/scanners/trivy.runner.js`: `execFile` parameterization for filesystem (`runTrivyFs`) and container images (`runTrivyImage`), 90s timeout.
- **Normalizers**:
  - `backend/src/normalizers/semgrep.normalizer.js`: Conservative mapping (`ERROR` default to `HIGH`; `CRITICAL` on explicit impact or critical CWE with high confidence).
  - `backend/src/normalizers/trivy.normalizer.js`: Multi-source CVSS precedence chain (`NVD V3` -> `RedHat V3` -> `GHSA V3`), invalid/out-of-bounds CVSS falls back to `null` to trigger risk engine base weight.
- **Orchestration & Failure Persistence**:
  - `backend/src/services/orchestrator.service.js`: Runs scanners, captures `scanner_metadata`, checks for failures.
  - Scanner failure halts pipeline with `status = 'FAILED'`, atomic `BLOCK` decision persistence into `pipeline_decisions` (`ON CONFLICT (scan_id) DO UPDATE`), and safe handling of zero/multiple active policy configurations.
- **Controlled Test Apps**:
  - `security-tests/safe-app`: Zero-finding baseline.
  - `security-tests/moderate-risk-app`: XSS / warning findings.
  - `security-tests/vulnerable-app`: SQL injection and hardcoded token findings.
- **Test Suite Verification**:
  - `npm run test:unit`: 35 passed, 0 failed.
  - Live Supabase integration tests: 10 passed, 0 failed across 3 test suites:
    - `health.integration.test.js`: 2 passed
    - `engine.integration.test.js`: 3 passed
    - `orchestrator.integration.test.js`: 5 passed
  - **Total**: 45 passed, 0 failed.
- **Credential Protection**: Strict exclusion of `backend/.env`, connection string masking, parameterized SQL throughout.
