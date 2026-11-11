# Implementation Status & Verification Ledger

## Phase Progress Overview

| Phase | Description | Status | Verification / Evidence |
| :--- | :--- | :--- | :--- |
| **Phase 0** | Project Foundation | **COMPLETED** | Folder structure, config files, Git initialization, documentation created |
| **Phase 1** | Database and Backend Foundation | **COMPLETED** | Migration applied successfully to Supabase; 8 tables verified, seed verified, 8/8 tests passing |
| **Phase 2** | Risk and Policy Engines | **COMPLETED** | Deterministic scoring with 85% floor protection, deduplication, tie-breaking; active policy evaluation; atomic Supabase persistence; 28/28 tests passing |
| **Phase 3** | Security Scanner Integration | PENDING | Awaiting student approval to begin |
| **Phase 4** | React Dashboard | PENDING | - |
| **Phase 5** | GitHub Actions & Containerization | PENDING | - |
| **Phase 6** | End-to-End Testing (3 Scenarios) | PENDING | - |
| **Phase 7** | Evaluation & Final Documentation | PENDING | - |

---

## Phase 2 Verification Record

- **Risk Scoring Formula**:
  - Individual score: $r_i = \max(0.85 \times w_{\text{sev}}, \;\; (0.70 \times w_{\text{sev}}) + (0.30 \times s_{\text{cvss}}))$
  - Aggregate score: $S = \min(100.00, \;\; r_{\max} + B_{\text{compound}})$
  - Compounding bonus: $B_{\text{compound}} = \min(100.00 - r_{\max}, \;\; \sum_{j \neq \text{dominant}} w_{\text{compound}, j})$
- **Deduplication Rule**: Stable identity `${scanner_name}::${vuln_id}::${affected_component}` retains the highest individual score.
- **Tie-Breaking Rule**: 1) Highest score $\to$ 2) Highest severity rank $\to$ 3) Stable key alphanumeric order.
- **Policy Engine**: Configurable thresholds (`max_critical_count`, `max_high_count`, `max_risk_score`, `warn_risk_score`, `fail_on_block`). Decisions evaluated: `PASS`, `WARN`, `BLOCK`.
- **Database Persistence**: Atomic transaction writing to `security_findings`, `risk_assessments`, and `pipeline_decisions`.
- **Test Suite Verification**:
  - `npm run test:unit`: 24 passed, 0 failed.
  - `npm run test:integration`: 4 passed, 0 failed against Supabase.
  - `npm run test:all`: 28 passed, 0 failed.
- **Credential Protection**: Strict exclusion of `backend/.env`, parameterized SQL statements throughout.
