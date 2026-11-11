const db = require('../database');

/**
 * Policy Controller
 *
 * Provides read-only security policy rules and gating ceilings for dashboard display.
 */
async function getPoliciesList(req, res, next) {
  try {
    const policyQuery = `
      SELECT
        id, name, version, description, is_active,
        max_critical_count, max_high_count, max_risk_score, warn_risk_score,
        fail_on_block, created_at, updated_at
      FROM policies
      ORDER BY is_active DESC, created_at DESC;
    `;
    const { rows } = await db.query(policyQuery);

    return res.status(200).json({
      status: 'success',
      data: {
        policies: rows,
        total: rows.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPoliciesList,
};
