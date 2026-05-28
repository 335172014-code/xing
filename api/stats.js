/**
 * GET /api/stats?admin_key=xxx
 * 获取统计数据（管理看板用）
 *
 * 响应: {
 *   overview: { total_searches, active_tokens, today_searches, total_tokens },
 *   tokens: [...],
 *   top_keywords: [...],
 *   daily_stats: [...]
 * }
 */
const supabase = require('./_lib/supabase');

const ADMIN_KEY = process.env.ADMIN_KEY;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 验证管理员密钥
    const adminKey = req.query.admin_key || req.headers['x-admin-key'];
    if (!adminKey || adminKey !== ADMIN_KEY) {
      return res.status(401).json({ error: '管理员密钥无效' });
    }

    // 并行查询所有统计数据
    const [
      { count: totalSearches },
      { count: todaySearches },
      { data: activeTokens },
      { data: allTokens },
      { data: topKeywords },
      { data: dailyStats }
    ] = await Promise.all([
      // 总搜索次数
      supabase.from('search_logs').select('*', { count: 'exact', head: true }),

      // 今日搜索次数
      supabase.from('search_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),

      // 活跃Token数
      supabase.from('tokens')
        .select('id')
        .eq('is_active', true),

      // 所有Token（含搜索次数信息）
      supabase.from('tokens')
        .select('id, name, token, is_active, max_searches, searches_used, created_at, expires_at')
        .order('created_at', { ascending: false }),

      // 热门搜索关键词 Top 20
      supabase.from('search_logs')
        .select('query')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(5000),

      // 最近7天每日搜索量
      supabase.from('search_logs')
        .select('created_at')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true })
        .limit(10000)
    ]);

    // 处理热门关键词聚合
    const keywordMap = {};
    (topKeywords || []).forEach(log => {
      if (!log.query) return;
      // 按空格拆分关键词
      const words = log.query.split(/\s+/).filter(w => w.length >= 2);
      words.forEach(word => {
        keywordMap[word] = (keywordMap[word] || 0) + 1;
      });
    });
    const topKeywordsList = Object.entries(keywordMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([keyword, count]) => ({ keyword, count }));

    // 处理每日搜索趋势
    const dailyMap = {};
    (dailyStats || []).forEach(log => {
      const date = new Date(log.created_at).toISOString().split('T')[0];
      dailyMap[date] = (dailyMap[date] || 0) + 1;
    });
    const dailyStatsList = Object.entries(dailyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    // 构建响应
    return res.status(200).json({
      overview: {
        total_searches: totalSearches || 0,
        today_searches: todaySearches || 0,
        active_tokens: activeTokens ? activeTokens.length : 0,
        total_tokens: allTokens ? allTokens.length : 0
      },
      tokens: allTokens || [],
      top_keywords: topKeywordsList,
      daily_stats: dailyStatsList
    });

  } catch (err) {
    console.error('[stats] 错误:', err);
    return res.status(500).json({ error: '获取统计数据失败' });
  }
};
