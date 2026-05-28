/**
 * GET /api/stats?admin_key=xxx
 * 获取统计数据（GitHub持久化版）
 * 
 * 直接从GitHub读取search_logs.json + tokens-store.js
 */
const { getTokens } = require('./_lib/tokens-store');
const { readFile } = require('./_lib/github');

const ADMIN_KEY = process.env.ADMIN_TOKEN || process.env.ADMIN_KEY || 'admin-xing-test-2026';

// 日志缓存（5分钟过期）
let _logsCache = null;
let _logsCacheTime = 0;
const LOGS_CACHE_TTL = 300000;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const adminKey = req.query.admin_key || req.headers['x-admin-key'];
    if (adminKey !== ADMIN_KEY) {
      return res.status(401).json({ error: '管理员密钥无效' });
    }

    const tokens = getTokens();
    const logs = await getSearchLogs();

    // 统计概览
    const today = new Date().toISOString().split('T')[0];
    const todayLogs = logs.filter(l => l.time && l.time.startsWith(today));
    
    // 按token统计
    const tokenStats = {};
    for (const log of logs) {
      const name = log.token_name || '未知';
      if (!tokenStats[name]) {
        tokenStats[name] = { searches: 0, last_search: '' };
      }
      tokenStats[name].searches++;
      if (log.time > tokenStats[name].last_search) {
        tokenStats[name].last_search = log.time;
      }
    }

    // 按关键词统计
    const keywordStats = {};
    for (const log of logs) {
      const kw = log.query || '';
      if (!kw) continue;
      keywordStats[kw] = (keywordStats[kw] || 0) + 1;
    }
    const topKeywords = Object.entries(keywordStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([keyword, count]) => ({ keyword, count }));

    // 按日期统计（最近7天）
    const dailyStats = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = logs.filter(l => l.time && l.time.startsWith(dateStr)).length;
      dailyStats.push({ date: dateStr, count });
    }

    // 组装token列表（带搜索统计）
    const tokensWithStats = tokens.map((t, i) => {
      const stats = tokenStats[t.name] || { searches: 0, last_search: '' };
      return {
        id: i + 1,
        name: t.name,
        token: t.token,
        is_active: t.is_active !== false,
        max_searches: t.max_searches || 9999,
        searches_used: stats.searches,
        last_search: stats.last_search,
        created_at: t.created_at || '--'
      };
    });

    return res.status(200).json({
      overview: {
        total_searches: logs.length,
        today_searches: todayLogs.length,
        active_tokens: tokens.filter(t => t.is_active !== false).length,
        total_tokens: tokens.length
      },
      tokens: tokensWithStats,
      top_keywords: topKeywords,
      daily_stats: dailyStats
    });
  } catch (err) {
    console.error('[stats] 错误:', err);
    return res.status(500).json({ error: '获取统计数据失败' });
  }
};

/**
 * 从GitHub获取搜索日志（带缓存）
 */
async function getSearchLogs() {
  const now = Date.now();
  if (_logsCache && now - _logsCacheTime < LOGS_CACHE_TTL) {
    return _logsCache;
  }

  try {
    const file = await readFile('data/search_logs.json');
    if (file) {
      _logsCache = JSON.parse(file.content);
      _logsCacheTime = now;
      return _logsCache;
    }
  } catch (e) {
    console.error('[stats] 读取日志失败:', e.message);
  }
  return _logsCache || [];
}
