/**
 * 轻量Token存储
 * Token直接存在代码里，更新Token只需改这个文件 + push到GitHub
 *
 * 格式: [{ token, name, is_active, max_searches }]
 */
const BUILT_IN_TOKENS = [
  {
    token: "admin-xing-2026",
    name: "管理员",
    is_active: true,
    max_searches: 9999
  }
];

function getTokens() {
  try {
    const envTokens = process.env.VALID_TOKENS;
    if (envTokens) {
      return JSON.parse(envTokens);
    }
  } catch (e) {
    console.error('[tokens-store] 解析 VALID_TOKENS 失败:', e.message);
  }
  return BUILT_IN_TOKENS;
}

function findToken(tokenStr) {
  const tokens = getTokens();
  return tokens.find(t => t.token === String(tokenStr).trim());
}

module.exports = { getTokens, findToken, BUILT_IN_TOKENS };
