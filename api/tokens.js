/**
 * /api/tokens - Token CRUD管理（轻量版：基于代码内嵌Token）
 *
 * POST:   创建新Token  { admin_key, name, max_searches }
 * GET:    列出所有Token ?admin_key=xxx
 * PATCH:  更新Token    { admin_key, token, is_active, name, max_searches }
 * DELETE: 删除Token    { admin_key, token }
 *
 * ⚠️ 修改Token后需重新部署才生效
 */
const { getTokens, BUILT_IN_TOKENS } = require('./_lib/tokens-store');
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

  const newToken = crypto.randomBytes(32).toString('hex');
  const tokenObj = {
    token: newToken,
    name: String(name).trim().substring(0, 255),
    is_active: true,
    max_searches: parseInt(max_searches, 10) || 500
  };

  return res.status(201).json({
    token: tokenObj,
    note: 'Token已生成。如需持久化，请更新 api/_lib/tokens-store.js 中的 BUILT_IN_TOKENS 数组并重新部署。'
  });
}

async function handleUpdate(req, res) {
  const { admin_key, token, is_active, name, max_searches } = req.body || {};
  if (!verifyAdmin(admin_key)) return res.status(401).json({ error: '管理员密钥无效' });
  if (!token) return res.status(400).json({ error: '请提供Token' });

  const tokens = getTokens();
  const idx = tokens.findIndex(t => t.token === token);
  if (idx === -1) return res.status(404).json({ error: 'Token不存在' });

  if (typeof is_active === 'boolean') tokens[idx].is_active = is_active;
  if (name !== undefined) tokens[idx].name = String(name).trim();
  if (max_searches !== undefined) tokens[idx].max_searches = parseInt(max_searches, 10) || 500;

  return res.status(200).json({
    token: tokens[idx],
    note: 'Token已更新。如需持久化，请更新 api/_lib/tokens-store.js 中的 BUILT_IN_TOKENS 数组并重新部署。'
  });
}

async function handleDelete(req, res) {
  const { admin_key, token } = req.body || {};
  if (!verifyAdmin(admin_key)) return res.status(401).json({ error: '管理员密钥无效' });
  if (!token) return res.status(400).json({ error: '请提供Token' });

  const tokens = getTokens();
  const idx = tokens.findIndex(t => t.token === token);
  if (idx === -1) return res.status(404).json({ error: 'Token不存在' });

  return res.status(200).json({
    success: true,
    note: 'Token已删除。如需持久化，请更新 api/_lib/tokens-store.js 中的 BUILT_IN_TOKENS 数组并重新部署。'
  });
}
