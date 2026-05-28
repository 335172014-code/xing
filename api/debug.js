/**
 * GET /api/debug
 * 调试端点 - 测试 Supabase 连接
 */
const supabase = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  // 安全检查：需要 admin_key
  const adminKey = req.query.admin_key || req.headers['x-admin-key'];
  if (adminKey !== 'admin-xing-2026') {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const results = {};

  // 1. 检查环境变量
  results.env = {
    SUPABASE_URL: process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.substring(0, 30)}...` : 'MISSING',
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? `${process.env.SUPABASE_SERVICE_KEY.substring(0, 10)}...(${process.env.SUPABASE_SERVICE_KEY.length}chars)` : 'MISSING',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? `${process.env.SUPABASE_ANON_KEY.substring(0, 10)}...(${process.env.SUPABASE_ANON_KEY.length}chars)` : 'MISSING',
    ADMIN_TOKEN: process.env.ADMIN_TOKEN ? 'SET' : 'MISSING',
    ADMIN_KEY: process.env.ADMIN_KEY ? 'SET' : 'MISSING'
  };

  // 2. 测试 Supabase 查询 tokens 表
  try {
    const { data, error, status, statusText } = await supabase
      .from('tokens')
      .select('*')
      .limit(5);

    results.tokens_query = {
      status,
      statusText,
      error: error ? { message: error.message, code: error.code, details: error.details } : null,
      data_count: data ? data.length : 0,
      sample: data && data.length > 0 ? { id: data[0].id, token: data[0].token, name: data[0].name } : null
    };
  } catch (err) {
    results.tokens_query = { error: err.message };
  }

  // 3. 测试 Supabase 查询 search_logs 表
  try {
    const { data, error, status } = await supabase
      .from('search_logs')
      .select('*')
      .limit(1);

    results.search_logs_query = {
      status,
      error: error ? { message: error.message, code: error.code } : null,
      data_count: data ? data.length : 0
    };
  } catch (err) {
    results.search_logs_query = { error: err.message };
  }

  // 4. 直接用 fetch 测试 REST API
  try {
    const url = `${process.env.SUPABASE_URL}/rest/v1/tokens?select=*&limit=1`;
    const resp = await fetch(url, {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
      }
    });
    const text = await resp.text();
    results.rest_api_test = {
      status: resp.status,
      statusText: resp.statusText,
      body_preview: text.substring(0, 200)
    };
  } catch (err) {
    results.rest_api_test = { error: err.message };
  }

  return res.status(200).json(results);
};
