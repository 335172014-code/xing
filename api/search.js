/**
 * POST /api/search
 * 搜索岗位（服务端搜索 + 记录日志）
 *
 * 请求: { "token": "xxxx", "query": "上海 产品经理", "category": "all" }
 * 响应: { "results": [...], "total": 42, "searches_used": 11, "max_searches": 500 }
 */
const supabase = require('./_lib/supabase');
const { search, sanitizeQuery, getJobStats } = require('./_lib/search-engine');

// 搜索频率限制：每Token每分钟最多30次
const RATE_LIMIT_PER_MINUTE = 30;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '方法不允许，请使用 POST' });
  }

  try {
    const { token, query, category } = req.body || {};

    // 1. 验证Token
    if (!token) {
      return res.status(400).json({ error: '请提供Token' });
    }

    const { data: tokenData, error: tokenError } = await supabase
      .from('tokens')
      .select('id, token, name, is_active, max_searches, searches_used, expires_at')
      .eq('token', String(token).trim())
      .single();

    if (tokenError || !tokenData) {
      return res.status(401).json({ error: 'Token无效' });
    }

    if (!tokenData.is_active) {
      return res.status(403).json({ error: 'Token已被禁用' });
    }

    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return res.status(403).json({ error: 'Token已过期' });
    }

    if (tokenData.searches_used >= tokenData.max_searches) {
      return res.status(403).json({
        error: '搜索次数已用完',
        searches_used: tokenData.searches_used,
        max_searches: tokenData.max_searches
      });
    }

    // 2. 频率限制检查
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { count: recentCount, error: countError } = await supabase
      .from('search_logs')
      .select('*', { count: 'exact', head: true })
      .eq('token_id', tokenData.id)
      .gte('created_at', oneMinuteAgo);

    if (!countError && recentCount >= RATE_LIMIT_PER_MINUTE) {
      return res.status(429).json({
        error: '搜索频率过高，请稍后再试',
        searches_used: tokenData.searches_used,
        max_searches: tokenData.max_searches
      });
    }

    // 3. 清理搜索查询
    const cleanQuery = sanitizeQuery(query);
    const cleanCategory = ['all', '实地', '远程', 'PTA', '美国'].includes(category)
      ? category
      : 'all';

    // 4. 执行搜索
    const results = search(cleanQuery, cleanCategory);

    // 5. 记录搜索日志
    const ipAddress = req.headers['x-forwarded-for'] ||
                      req.headers['x-real-ip'] ||
                      req.connection?.remoteAddress ||
                      null;

    await supabase.from('search_logs').insert({
      token_id: tokenData.id,
      query: cleanQuery,
      results_count: results.length,
      ip_address: ipAddress ? String(ipAddress).split(',')[0].trim().substring(0, 45) : null
    });

    // 6. 递增搜索次数
    const newSearchesUsed = tokenData.searches_used + 1;
    await supabase
      .from('tokens')
      .update({ searches_used: newSearchesUsed })
      .eq('id', tokenData.id);

    // 7. 返回搜索结果
    return res.status(200).json({
      results: results,
      total: results.length,
      searches_used: newSearchesUsed,
      max_searches: tokenData.max_searches,
      stats: getJobStats()
    });

  } catch (err) {
    console.error('[search] 错误:', err);
    return res.status(500).json({ error: '搜索服务内部错误' });
  }
};
