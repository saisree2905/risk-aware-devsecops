/**
 * Policy Service
 * 
 * Manages security policies stored in Supabase with explicit validation.
 * Rejects ambiguous states (multiple active policies) and missing active policies.
 */

const { query } = require('../database');
const { PolicyConfigurationError } = require('../policy-engine');

async function getActivePolicy() {
  const sql = `
    SELECT id, name, version, description, is_active, max_critical_count,
           max_high_count, max_risk_score, warn_risk_score, fail_on_block,
           created_at, updated_at
    FROM policies
    WHERE is_active = TRUE
    ORDER BY updated_at DESC;
  `;

  const { rows } = await query(sql);

  if (!rows || rows.length === 0) {
    throw new PolicyConfigurationError('No active security policy found in database. Configure an active policy to evaluate scans.');
  }

  if (rows.length > 1) {
    throw new PolicyConfigurationError(`Ambiguous policy state: Multiple active policies detected (${rows.length} found). Ensure exactly one policy is active.`);
  }

  return rows[0];
}

async function getAllPolicies() {
  const { rows } = await query('SELECT * FROM policies ORDER BY created_at ASC;');
  return rows;
}

module.exports = {
  getActivePolicy,
  getAllPolicies,
};
