-- ============================================================
-- 实习智能匹配平台 - 数据库建表SQL
-- 数据库：Supabase PostgreSQL
-- ============================================================

-- Token表：管理授权Token
CREATE TABLE IF NOT EXISTS tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,            -- 机构/使用者名称
  is_active BOOLEAN DEFAULT true,
  max_searches INTEGER DEFAULT 500,      -- 搜索次数上限
  searches_used INTEGER DEFAULT 0,       -- 已用搜索次数
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ                 -- 过期时间，NULL=永不过期
);

-- 搜索日志表：记录每次搜索
CREATE TABLE IF NOT EXISTS search_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id UUID REFERENCES tokens(id) ON DELETE SET NULL,
  query VARCHAR(500) NOT NULL,
  results_count INTEGER DEFAULT 0,
  ip_address VARCHAR(45),                -- 可选，用于分析
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_search_logs_token_id ON search_logs(token_id);
CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON search_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_tokens_token ON tokens(token);
CREATE INDEX IF NOT EXISTS idx_tokens_is_active ON tokens(is_active);

-- ============================================================
-- 以下为可选：RLS行级安全策略
-- 由于API使用service_key（绕过RLS），此处仅作参考
-- 如果未来需要客户端直连Supabase，请启用RLS
-- ============================================================

-- ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE search_logs ENABLE ROW LEVEL SECURITY;
