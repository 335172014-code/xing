/**
 * POST /api/auth
 * 验证Token（轻量版：基于代码内嵌Token，零外部依赖）
 */
const { findToken } = require('./_lib/tokens-store');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: '请使用 POST' });

  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ valid: false, error: '请提供Token' });

    const found = findToken(token);

    if (!found) {
      return res.status(200).json({ valid: false, error: 'Token无效' });
    }

    if (found.is_active === false) {
      return res.status(200).json({ valid: false, error: 'Token已被禁用' });
    }

    return res.status(200).json({
      valid: true,
      name: found.name,
      max_searches: found.max_searches || 9999
    });
  } catch (err) {
    console.error('[auth] 错误:', err);
    return res.status(500).json({ valid: false, error: '服务器内部错误' });
  }
};
