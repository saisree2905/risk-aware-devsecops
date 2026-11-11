# PROJECT CONTEXT

## 1. Project Information
- **Title**: Risk-Aware Automated Security Framework for CI/CD Pipelines
- **Institution**: Mohan Babu University, Tirupati
- **Department**: Computer Science and Engineering
- **Academic Year**: 2026–2027
- **Batch**: A4-1
- **Course**: B.Tech CSE Capstone Project

## 2. Core Objectives
1. Integrate security scanners (Semgrep for SAST, Trivy for SCA/container images) directly into the CI/CD pipeline.
2. Ingest, parse, and normalize scanner findings into a consistent JSON schema.
3. Apply a transparent, deterministic risk-scoring formula that differentiates raw vulnerability severities from contextual pipeline risks.
4. Provide a configurable policy engine that issues automated gating decisions:
   - `PASS`: Findings within acceptable thresholds.
   - `WARN`: Medium/low findings logged; pipeline continues.
   - `BLOCK`: Critical/high findings exceed threshold; pipeline terminates with exit code 1.
5. Provide a responsive, real-time web dashboard visualizing security posture, scan history, vulnerability details, and policy audit logs.
6. Support dual ingestion paths:
   - Direct API ingestion for environments connected to the backend.
   - Safe GitHub Actions workflow artifact capture for disconnected/local environments without fabricated sync.

## 3. Technology Stack & Standard Constraints
- **Frontend**: React 18, Vite, Tailwind CSS, React Router, Axios, Recharts.
- **Backend**: Node.js 22, Express.js, CommonJS JavaScript, RESTful APIs.
- **Database**: PostgreSQL with native SQL migrations and parameterized queries via `pg`.
- **Scanners**: Semgrep CLI, Trivy CLI.
- **CI/CD**: GitHub Actions hosted runners.
- **Containerization**: Standard Dockerfiles built and scanned inside GitHub Actions runners.

## 4. Host Machine & Operational Boundaries
- **Developer Host**: Lenovo ThinkPad T440 (Intel Core i5-4300U @ 1.90GHz - 2.49GHz)
- **RAM**: ~8.0 GB RAM total (~600MB–1.5GB free under typical workloads)
- **OS**: Windows 10 Pro (Build 19045)
- **Node.js**: v22.19.0
- **npm**: 11.0.0
- **Git**: 2.51.0.windows.1

### Critical Constraints:
1. **No Docker Desktop locally**: Local machine will NOT run Docker Desktop or WSL2 to preserve RAM and CPU stability.
2. **Container builds on GitHub Runners**: All Docker build and container scan stages run on GitHub Actions cloud infrastructure.
3. **No Unapproved System Changes**: No software installation, PATH edits, or registry modifications without explicit user approval.
4. **No Fabricated Evidence**: Every scanner result, benchmark metric, and test status must reflect actual executions.
