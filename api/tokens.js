/**
 * /api/tokens - Token CRUD管理（GitHub持久化版）
 *
 * POST:   创建新Token  { admin_key, name, max_searches }
 * GET:    列出所有Token ?admin_key=xxx
 * PATCH:  更新Token    { admin_key, token_id, is_active, name, max_searches }
 * DELETE: 删除Token    { admin_key, token_id }
 *
 * ✅ 变更自动推送到GitHub → Vercel自动重部署 → Token持久化
 */
const { getTokens, setTokens } = require('./_lib/tokens-store');
const { pushTokens } = require('./_lib/github');
const crypto = require('crypto');

const ADMIN_KEY = process.env.ADMIN_TOKEN || process.env.ADMIN_KEY || 'admin-xing-2026';

function verifyAdmin(adminKey) {
  return adminKey === ADMIN_KEY;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    switch (req.method) {
      case 'GET': return await handleList(req, res);
      case 'POST': return await handleCreate(req, res);
      case 'PATCH': return await handleUpdate(req, res);
      case 'DELETE': return await handleDelete(req, res);
      default: return res.status(405).json({ error: '方法不允许' });
    }
  } catch (err) {
    console.error('[tokens] 错误:', err);
    return res.status(500).json({ error: 'Token管理服务内部错误' });
  }
};

async function handleList(req, res) {
  if (!verifyAdmin(req.query.admin_key)) {
    return res.status(401).json({ error: '管理员密钥无效' });
  }
  const tokens = getTokens();
  return res.status(200).json({ tokens });
}

async function handleCreate(req, res) {
  const { admin_key, name, max_searches } = req.body || {};
  if (!verifyAdmin(admin_key)) return res.status(401).json({ error: '管理员密钥无效' });
  if (!name || !name.trim()) return res.status(400).json({ error: '请提供名称' });

  const tokens = getTokens();
  const newToken = crypto.randomBytes(16).toString('hex');
  const tokenObj = {
    token: newToken,
    name: String(name).trim().substring(0, 255),
    is_active: true,
    max_searches: parseInt(max_searches, 10) || 500,
    created_at: new Date().toISOString().split('T')[0]
  };

  tokens.push(tokenObj);
  setTokens(tokens);

  // 推送到GitHub持久化
  const pushed = await pushTokens(tokens);

  return res.status(201).json({
    token: tokenObj,
    persisted: pushed,
    note: pushed 
      ? '✅ Token已创建并持久化，Vercel将自动重部署（约1分钟生效）' 
      : '⚠️ Token已创建（内存中），但GitHub推送失败。请在管理后台重试。'
  });
}

async function handleUpdate(req, res) {
  const { admin_key, token_id, is_active, name, max_searches } = req.body || {};
  if (!verifyAdmin(admin_key)) return res.status(401).json({ error: '管理员密钥无效' });

  const tokens = getTokens();
  const idx = parseInt(token_id, 10) - 1;
  if (idx < 0 || idx >= tokens.length) return res.status(404).json({ error: 'Token不存在' });

  if (typeof is_active === 'boolean') tokens[idx].is_active = is_active;
  if (name !== undefined) tokens[idx].name = String(name).trim();
  if (max_searches !== undefined) tokens[idx].max_searches = parseInt(max_searches, 10) || 500;

  setTokens(tokens);
  const pushed = await pushTokens(tokens);

  return res.status(200).json({
    token: tokens[idx],
    persisted: pushed,
    note: pushed ? '✅ 已更新' : '⚠️ 更新失败'
  });
}

async function handleDelete(req, res) {
  const { admin_key, token_id } = req.body || {};
  if (!verifyAdmin(admin_key)) return res.status(401).json({ error: '管理员密钥无效' });

  const tokens = getTokens();
  const idx = parseInt(token_id, 10) - 1;
  if (idx < 0 || idx >= tokens.length) return res.status(404).json({ error: 'Token不存在' });

  const deleted = tokens.splice(idx, 1)[0];
  setTokens(tokens);
  const pushed = await pushTokens(tokens);

  return res.status(200).json({
    success: true,
    deleted_token: deleted.name,
    persisted: pushed,
    note: pushed ? '✅ 已删除' : '⚠️ 删除失败'
  });
}
