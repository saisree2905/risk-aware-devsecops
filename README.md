# Risk-Aware Automated Security Framework for CI/CD Pipelines

[![Academic Year](https://img.shields.io/badge/Academic%20Year-2026--2027-blue.svg)](https://mbu.asia/)
[![Institution](https://img.shields.io/badge/Institution-Mohan%20Babu%20University-maroon.svg)](https://mbu.asia/)
[![Department](https://img.shields.io/badge/Department-CSE-orange.svg)](https://mbu.asia/)
[![Batch](https://img.shields.io/badge/Batch-A4--1-green.svg)](#)

A B.Tech Computer Science and Engineering Capstone Project at **Mohan Babu University, Tirupati**.

---

## 1. Project Overview

Modern software development relies on continuous integration and continuous deployment (CI/CD) pipelines to rapidly release software. However, integrating security scans into pipelines often results in noisy alerts, unranked vulnerabilities, or naive "fail-on-any-finding" gates that developers bypass.

The **Risk-Aware Automated Security Framework for CI/CD Pipelines** introduces an explainable, deterministic risk-scoring and policy engine directly into the automated delivery workflow. The framework:
1. Orchestrates automated static analysis (**Semgrep**) and container/dependency scanning (**Trivy**).
2. Normalizes disparate scanner output formats into a unified vulnerability schema.
3. Computes a contextual risk score incorporating severity, exploitability, and exposure.
4. Evaluates configurable security policies to issue one of three pipeline decisions:
   - **PASS**: Security posture acceptable; pipeline proceeds.
   - **WARN**: Moderate risks flagged for review; pipeline proceeds with warnings.
   - **BLOCK**: Unacceptable critical risks detected; pipeline is halted.
5. Persists scan findings, risk scores, and decisions in PostgreSQL.
6. Renders security metrics, scan history, and compliance trends on an interactive React dashboard.

---

## 2. Technology Stack

- **Frontend**: React.js 18, Vite, Tailwind CSS, React Router, Axios, Recharts
- **Backend**: Node.js 22 (CommonJS), Express.js, REST APIs
- **Database**: PostgreSQL with `pg` client and SQL migrations
- **Security Scanners**: Semgrep (SAST), Trivy (SCA & Container Scan)
- **CI/CD & DevOps**: GitHub Actions, Dockerfiles, Hosted Runner Builds

---

## 3. Architecture Pipeline Flow

```
[Developer Push]
       │
       ▼
[GitHub Actions Workflow]
  ├── Unit / Integration Tests
  ├── Semgrep SAST Scan (Source Code)
  ├── Trivy Filesystem & Dependency Scan
  ├── Docker Image Build (Hosted Runner)
  └── Trivy Container Image Scan
       │
       ▼ (Scan Artifacts / JSON Payload)
[Backend Ingestion & Normalizer Service]
       │
       ▼
[Risk Engine: Score Calculation]
       │
       ▼
[Policy Engine: PASS / WARN / BLOCK Decision]
       │
       ├── Stored in PostgreSQL DB
       ├── Visualized on React Dashboard
       └── Fails GitHub Actions Job if BLOCK
```

---

## 4. Repository Structure

```
Saisree-DevSecOps/
├── frontend/             # React + Vite + Tailwind CSS dashboard
├── backend/              # Node.js + Express API & Risk/Policy engine
├── security-tests/       # Controlled test applications (safe, moderate, vulnerable)
├── docker/               # Container build definitions
├── .github/workflows/    # CI/CD pipelines
├── docs/                 # System architecture and implementation status
├── PROJECT_CONTEXT.md    # System context and hardware constraints
├── TASKS.md              # Phase-wise implementation roadmap & tracking
├── DECISIONS.md          # Architecture and technical decision records
└── HANDOFF.md            # Session state and immediate next actions
```

---

## 5. Development Phases

- **Phase 0**: Project Foundation & Environment Verification *(Current)*
- **Phase 1**: Database and Backend Foundation
- **Phase 2**: Risk and Policy Engines
- **Phase 3**: Security Scanner Integration
- **Phase 4**: React Dashboard
- **Phase 5**: GitHub Actions & Container Scanning
- **Phase 6**: End-to-End Testing with Controlled Scenarios
- **Phase 7**: Evaluation, Documentation & Final Release

---

## 6. License & Academic Integrity

Developed for academic evaluation at Mohan Babu University. All experimental findings, benchmark numbers, and scanner detections are verified with reproducible test fixtures.
