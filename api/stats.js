/**
 * GET /api/stats?admin_key=xxx
 * 获取统计数据（轻量版）
 */
const { getTokens } = require('./_lib/tokens-store');
const ADMIN_KEY = process.env.ADMIN_TOKEN || process.env.ADMIN_KEY || 'admin-xing-2026';

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const adminKey = req.query.admin_key || req.headers['x-admin-key'];
    if (adminKey !== ADMIN_KEY) {
      return res.status(401).json({ error: '管理员密钥无效' });
    }

    const tokens = getTokens();

    return res.status(200).json({
      overview: {
        total_searches: 0,
        today_searches: 0,
        active_tokens: tokens.filter(t => t.is_active !== false).length,
        total_tokens: tokens.length
      },
      tokens: tokens.map((t, i) => ({
        id: i + 1,
        name: t.name,
        token: t.token.substring(0, 8) + '...',
        is_active: t.is_active !== false,
        max_searches: t.max_searches || 9999,
        searches_used: 0,
        created_at: new Date().toISOString()
      })),
      top_keywords: [],
      daily_stats: []
    });
  } catch (err) {
    console.error('[stats] 错误:', err);
    return res.status(500).json({ error: '获取统计数据失败' });
  }
};
