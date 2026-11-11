-- ==============================================================================
-- Migration: 001_initial_schema.sql
-- Description: Creates initial relational schema for Risk-Aware DevSecOps Framework
-- Safe & Idempotent: Uses IF NOT EXISTS and ON CONFLICT DO NOTHING
-- Audit Integrity: Strict RESTRICT deletion policies to protect security evidence
-- ==============================================================================

-- 1. Schema Migrations History Table
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Projects / Repositories Table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    repository_url VARCHAR(500),
    default_branch VARCHAR(100) DEFAULT 'main',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Security Policies Table
CREATE TABLE IF NOT EXISTS policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    max_critical_count INT NOT NULL DEFAULT 0 CHECK (max_critical_count >= 0),
    max_high_count INT NOT NULL DEFAULT 2 CHECK (max_high_count >= 0),
    max_risk_score NUMERIC(5, 2) NOT NULL DEFAULT 70.00 CHECK (max_risk_score >= 0.00 AND max_risk_score <= 100.00),
    warn_risk_score NUMERIC(5, 2) NOT NULL DEFAULT 40.00 CHECK (warn_risk_score >= 0.00 AND warn_risk_score <= 100.00),
    fail_on_block BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_policy_name_version UNIQUE (name, version),
    CONSTRAINT chk_policy_warn_lte_max CHECK (warn_risk_score <= max_risk_score)
);

-- 4. Scans Table
-- Audit consideration: If a project record is deleted, retain historical scan records
-- by setting project_id to NULL rather than destroying audit trail.
CREATE TABLE IF NOT EXISTS scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    commit_hash VARCHAR(64),
    branch VARCHAR(100) DEFAULT 'main',
    trigger_event VARCHAR(50) DEFAULT 'push',
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
    initiated_by VARCHAR(100) DEFAULT 'ci-pipeline',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 5. Security Findings (Normalized from Semgrep & Trivy)
-- Audit consideration: ON DELETE RESTRICT prevents accidental deletion of scan runs while findings exist
CREATE TABLE IF NOT EXISTS security_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE RESTRICT,
    scanner_name VARCHAR(50) NOT NULL,
    finding_id VARCHAR(255),
    vuln_id VARCHAR(100),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO')),
    cvss_score NUMERIC(4, 2) CHECK (cvss_score IS NULL OR (cvss_score >= 0.00 AND cvss_score <= 10.00)),
    affected_component TEXT NOT NULL,
    affected_version VARCHAR(100),
    fixed_version VARCHAR(100),
    remediation TEXT,
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Risk Assessments (Computed by Deterministic Risk Engine)
-- Audit consideration: ON DELETE RESTRICT preserves historical risk assessment evidence
CREATE TABLE IF NOT EXISTS risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE RESTRICT UNIQUE,
    overall_risk_score NUMERIC(5, 2) NOT NULL CHECK (overall_risk_score >= 0.00 AND overall_risk_score <= 100.00),
    critical_count INT NOT NULL DEFAULT 0 CHECK (critical_count >= 0),
    high_count INT NOT NULL DEFAULT 0 CHECK (high_count >= 0),
    medium_count INT NOT NULL DEFAULT 0 CHECK (medium_count >= 0),
    low_count INT NOT NULL DEFAULT 0 CHECK (low_count >= 0),
    info_count INT NOT NULL DEFAULT 0 CHECK (info_count >= 0),
    assessment_rationale TEXT,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Pipeline Decisions (Evaluated by Policy Engine)
-- Audit consideration: ON DELETE RESTRICT preserves pipeline gating audit trail
CREATE TABLE IF NOT EXISTS pipeline_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE RESTRICT UNIQUE,
    policy_id UUID REFERENCES policies(id) ON DELETE SET NULL,
    decision VARCHAR(20) NOT NULL CHECK (decision IN ('PASS', 'WARN', 'BLOCK')),
    decision_rationale TEXT NOT NULL,
    is_blocking BOOLEAN NOT NULL DEFAULT FALSE,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Scanner Metadata (Execution performance & audit)
-- Audit consideration: ON DELETE RESTRICT preserves scanner latency and execution metrics
CREATE TABLE IF NOT EXISTS scanner_metadata (
    id SERIAL PRIMARY KEY,
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE RESTRICT,
    scanner_name VARCHAR(50) NOT NULL,
    scanner_version VARCHAR(50),
    execution_time_ms INT CHECK (execution_time_ms IS NULL OR execution_time_ms >= 0),
    exit_code INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast query performance
CREATE INDEX IF NOT EXISTS idx_scans_project_id ON scans(project_id);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_findings_scan_id ON security_findings(scan_id);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON security_findings(severity);
CREATE INDEX IF NOT EXISTS idx_decisions_scan_id ON pipeline_decisions(scan_id);
CREATE INDEX IF NOT EXISTS idx_decisions_decision ON pipeline_decisions(decision);

-- Default Pre-seeded Security Policy (Idempotent)
INSERT INTO policies (name, version, description, max_critical_count, max_high_count, max_risk_score, warn_risk_score, fail_on_block)
VALUES (
    'Standard Enterprise Policy',
    '1.0.0',
    'Blocks on any CRITICAL vulnerability or overall risk score >= 70. Warns on HIGH vulnerabilities or risk >= 40.',
    0,
    2,
    70.00,
    40.00,
    TRUE
)
ON CONFLICT (name, version) DO NOTHING;
