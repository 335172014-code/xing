/**
 * POST /api/auth
 * 验证Token，返回会话信息
 *
 * 请求: { "token": "xxxx" }
 * 响应: { "valid": true, "name": "机构名", "searches_used": 10, "max_searches": 500 }
 */
const supabase = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  // 只接受POST请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '方法不允许，请使用 POST' });
  }

  try {
    const { token } = req.body || {};

    if (!token) {
      return res.status(400).json({ valid: false, error: '请提供Token' });
    }

    // 查询Token信息
    const { data: tokenData, error } = await supabase
      .from('tokens')
      .select('id, token, name, is_active, max_searches, searches_used, expires_at')
      .eq('token', String(token).trim())
      .single();

    if (error || !tokenData) {
      console.error('[auth] Token查询失败:', JSON.stringify({ error, tokenProvided: String(token).trim() }));
      return res.status(200).json({ valid: false, error: 'Token无效', debug: error ? error.message : 'not_found' });
    }

    // 检查Token是否启用
    if (!tokenData.is_active) {
      return res.status(200).json({ valid: false, error: 'Token已被禁用' });
    }

    // 检查是否过期
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return res.status(200).json({ valid: false, error: 'Token已过期' });
    }

    // 检查搜索次数是否超限
    if (tokenData.searches_used >= tokenData.max_searches) {
      return res.status(200).json({
        valid: false,
        error: '搜索次数已用完',
        searches_used: tokenData.searches_used,
        max_searches: tokenData.max_searches
      });
    }

    // Token有效
    return res.status(200).json({
      valid: true,
      name: tokenData.name,
      searches_used: tokenData.searches_used,
      max_searches: tokenData.max_searches
    });

  } catch (err) {
    console.error('[auth] 错误:', err);
    return res.status(500).json({ valid: false, error: '服务器内部错误' });
  }
};
