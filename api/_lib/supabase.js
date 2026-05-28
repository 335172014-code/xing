/**
 * Supabase 客户端初始化
 * 用于 Vercel Serverless Functions 的服务端连接
 * 使用 service_role key 以绕过 RLS（行级安全策略）
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[supabase] 缺少环境变量: SUPABASE_URL 或 SUPABASE_SERVICE_KEY');
}

const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder-key', {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

module.exports = supabase;
