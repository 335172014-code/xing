/**
 * POST /api/search
 * 搜索岗位（服务端搜索 + 轻量日志）
 */
const { findToken } = require('./_lib/tokens-store');
const { search, sanitizeQuery, getJobStats } = require('./_lib/search-engine');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: '请使用 POST' });

  try {
    const { token, query, category } = req.body || {};

    // 1. 验证Token
    if (!token) return res.status(400).json({ error: '请提供Token' });

    const tokenData = findToken(token);
    if (!tokenData) return res.status(401).json({ error: 'Token无效' });
    if (tokenData.is_active === false) return res.status(403).json({ error: 'Token已被禁用' });

    // 2. 清理查询
    const cleanQuery = sanitizeQuery(query);
    const cleanCategory = ['all', '实地', '远程', 'PTA', '美国'].includes(category)
      ? category : 'all';

    // 3. 执行搜索
    const results = search(cleanQuery, cleanCategory);

    // 4. 日志
    console.log('[SEARCH_LOG]', JSON.stringify({
      token_name: tokenData.name,
      query: cleanQuery,
      results: results.length,
      time: new Date().toISOString()
    }));

    return res.status(200).json({
      results: results,
      total: results.length,
      max_searches: tokenData.max_searches || 9999,
      stats: getJobStats()
    });
  } catch (err) {
    console.error('[search] 错误:', err);
    return res.status(500).json({ error: '搜索服务内部错误' });
  }
};
