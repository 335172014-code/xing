/**
 * POST /api/search
 * 搜索岗位（服务端搜索 + GitHub持久化日志）
 * 
 * 搜索日志写入内存，异步批量推送到GitHub的data/search_logs.json
 */
const { findToken } = require('./_lib/tokens-store');
const { pushFile, readFile } = require('./_lib/github');
const { search, sanitizeQuery, getJobStats } = require('./_lib/search-engine');

// 内存日志缓存
let _logCache = [];
let _lastPushTime = 0;
const PUSH_INTERVAL = 60000; // 60秒推一次GitHub
let _pushInProgress = false;

// GitHub日志缓存（从GitHub读取的完整日志）
let _githubLogsCache = null;
let _githubLogsCacheTime = 0;
const GITHUB_LOGS_TTL = 300000; // 5分钟

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

    // 2. 清理查询 - 支持新分类
    const cleanQuery = sanitizeQuery(query);
    const validCategories = ['all', '国内实地', '远程', 'PTA', '国外实地', '科研',
      '实地', '美国', '实地实习', '远程实习', '科研实习'];
    const cleanCategory = validCategories.includes(category) ? category : 'all';

    // 3. 执行搜索
    const results = search(cleanQuery, cleanCategory);

    // 4. 记录日志
    const logEntry = {
      token_name: tokenData.name,
      token_prefix: tokenData.token.substring(0, 8),
      query: cleanQuery,
      category: cleanCategory,
      results: results.length,
      time: new Date().toISOString()
    };
    _logCache.push(logEntry);
    if (_logCache.length > 500) _logCache = _logCache.slice(-500);

    // 5. 异步推送到GitHub（节流）
    pushLogsThrottled();

    // 6. 返回结果
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

/**
 * 获取内存日志（供stats API使用）
 */
function getSearchLogs() {
  return _logCache;
}

/**
 * 获取GitHub持久化日志（带缓存）
 */
async function getGithubLogs() {
  const now = Date.now();
  if (_githubLogsCache && now - _githubLogsCacheTime < GITHUB_LOGS_TTL) {
    return _githubLogsCache;
  }
  try {
    const file = await readFile('data/search_logs.json');
    if (file) {
      _githubLogsCache = JSON.parse(file.content);
      _githubLogsCacheTime = now;
      return _githubLogsCache;
    }
  } catch (e) { /* ignore */ }
  return _githubLogsCache || [];
}

/**
 * 获取所有日志（内存 + GitHub合并）
 */
async function getAllLogs() {
  const githubLogs = await getGithubLogs();
  const githubTimes = new Set(githubLogs.map(l => l.time));
  const newLogs = _logCache.filter(l => !githubTimes.has(l.time));
  return [...githubLogs, ...newLogs];
}

function pushLogsThrottled() {
  const now = Date.now();
  if (now - _lastPushTime < PUSH_INTERVAL || _pushInProgress) return;
  _lastPushTime = now;
  _pushInProgress = true;
  pushLogsToGithub().finally(() => { _pushInProgress = false; });
}

async function pushLogsToGithub() {
  try {
    const allLogs = await getAllLogs();
    // 只保留最近2000条
    const trimmed = allLogs.slice(-2000);
    await pushFile('data/search_logs.json', JSON.stringify(trimmed), 'chore: update search logs');
    console.log('[search] 日志推送成功，共', trimmed.length, '条');
  } catch (err) {
    console.error('[search] 日志推送失败:', err.message);
  }
}

module.exports.getSearchLogs = getSearchLogs;
module.exports.getAllLogs = getAllLogs;
