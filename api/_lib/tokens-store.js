/**
 * 轻量Token存储（自动生成，请勿手动编辑）
 * 
 * Token通过管理后台管理，变更自动推送到GitHub并触发Vercel重部署
 * 
 * 格式: [{ token, name, is_active, max_searches, created_at }]
 */
const BUILT_IN_TOKENS = [
  {
    "token": "admin-xing-2026",
    "name": "管理员",
    "is_active": true,
    "max_searches": 9999,
    "created_at": "2026-05-29"
  },
  {
    "token": "ac25c05e0a27c98e3f1a11cdb53a9554",
    "name": "test1",
    "is_active": true,
    "max_searches": 500,
    "created_at": "2026-05-28"
  },
  {
    "token": "9d89503e885fa36f61f548ec64029005",
    "name": "test2",
    "is_active": true,
    "max_searches": 500,
    "created_at": "2026-05-28"
  },
  {
    "token": "3eb54754e3e8bcce3742bcbc9156a5b6",
    "name": "新东方",
    "is_active": true,
    "max_searches": 1000,
    "created_at": "2026-05-29"
  }
];

let _tokenCache = null;

function getTokens() {
  if (_tokenCache) return _tokenCache;
  try {
    const envTokens = process.env.VALID_TOKENS;
    if (envTokens) {
      _tokenCache = JSON.parse(envTokens);
      return _tokenCache;
    }
  } catch (e) {
    console.error('[tokens-store] 解析 VALID_TOKENS 失败:', e.message);
  }
  _tokenCache = [...BUILT_IN_TOKENS];
  return _tokenCache;
}

function findToken(tokenStr) {
  const tokens = getTokens();
  return tokens.find(t => t.token === String(tokenStr).trim() && t.is_active !== false);
}

function setTokens(newTokens) {
  _tokenCache = newTokens;
}

module.exports = { getTokens, findToken, setTokens, BUILT_IN_TOKENS };
