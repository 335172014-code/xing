/**
 * /api/tokens - Token CRUD管理
 *
 * POST:   创建新Token  { admin_key, name, max_searches }
 * GET:    列出所有Token ?admin_key=xxx
 * PATCH:  更新Token    { admin_key, token_id, is_active, name, max_searches }
 * DELETE: 删除Token    { admin_key, token_id }
 */
const supabase = require('./_lib/supabase');
const crypto = require('crypto');

const ADMIN_KEY = process.env.ADMIN_TOKEN || process.env.ADMIN_KEY;

/**
 * 验证管理员密钥
 */
function verifyAdmin(adminKey) {
  if (!adminKey || adminKey !== ADMIN_KEY) {
    return false;
  }
  return true;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    switch (req.method) {
      case 'GET':
        return await handleList(req, res);
      case 'POST':
        return await handleCreate(req, res);
      case 'PATCH':
        return await handleUpdate(req, res);
      case 'DELETE':
        return await handleDelete(req, res);
      default:
        return res.status(405).json({ error: '方法不允许' });
    }
  } catch (err) {
    console.error('[tokens] 错误:', err);
    return res.status(500).json({ error: 'Token管理服务内部错误' });
  }
};

/**
 * GET - 列出所有Token
 */
async function handleList(req, res) {
  const adminKey = req.query.admin_key;
  if (!verifyAdmin(adminKey)) {
    return res.status(401).json({ error: '管理员密钥无效' });
  }

  const { data, error } = await supabase
    .from('tokens')
    .select('id, name, token, is_active, max_searches, searches_used, created_at, expires_at')
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: '查询Token列表失败' });
  }

  return res.status(200).json({ tokens: data || [] });
}

/**
 * POST - 创建新Token
 */
async function handleCreate(req, res) {
  const { admin_key, name, max_searches, expires_at } = req.body || {};

  if (!verifyAdmin(admin_key)) {
    return res.status(401).json({ error: '管理员密钥无效' });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ error: '请提供机构/使用者名称' });
  }

  // 生成随机Token（64位十六进制字符串）
  const newToken = crypto.randomBytes(32).toString('hex');

  const insertData = {
    token: newToken,
    name: String(name).trim().substring(0, 255),
    is_active: true,
    max_searches: parseInt(max_searches, 10) || 500,
    searches_used: 0
  };

  // 可选过期时间
  if (expires_at) {
    const expDate = new Date(expires_at);
    if (!isNaN(expDate.getTime())) {
      insertData.expires_at = expDate.toISOString();
    }
  }

  const { data, error } = await supabase
    .from('tokens')
    .insert(insertData)
    .select('id, name, token, is_active, max_searches, searches_used, created_at, expires_at')
    .single();

  if (error) {
    console.error('[tokens] 创建失败:', error);
    return res.status(500).json({ error: '创建Token失败' });
  }

  return res.status(201).json({ token: data });
}

/**
 * PATCH - 更新Token
 */
async function handleUpdate(req, res) {
  const { admin_key, token_id, is_active, name, max_searches, expires_at } = req.body || {};

  if (!verifyAdmin(admin_key)) {
    return res.status(401).json({ error: '管理员密钥无效' });
  }

  if (!token_id) {
    return res.status(400).json({ error: '请提供Token ID' });
  }

  // 构建更新数据（只更新提供的字段）
  const updateData = {};
  if (typeof is_active === 'boolean') updateData.is_active = is_active;
  if (name !== undefined) updateData.name = String(name).trim().substring(0, 255);
  if (max_searches !== undefined) updateData.max_searches = parseInt(max_searches, 10) || 500;
  if (expires_at !== undefined) {
    if (expires_at === null) {
      updateData.expires_at = null; // 清除过期时间
    } else {
      const expDate = new Date(expires_at);
      if (!isNaN(expDate.getTime())) {
        updateData.expires_at = expDate.toISOString();
      }
    }
  }

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: '没有需要更新的字段' });
  }

  const { data, error } = await supabase
    .from('tokens')
    .update(updateData)
    .eq('id', token_id)
    .select('id, name, token, is_active, max_searches, searches_used, created_at, expires_at')
    .single();

  if (error) {
    console.error('[tokens] 更新失败:', error);
    return res.status(500).json({ error: '更新Token失败' });
  }

  if (!data) {
    return res.status(404).json({ error: 'Token不存在' });
  }

  return res.status(200).json({ token: data });
}

/**
 * DELETE - 删除Token
 */
async function handleDelete(req, res) {
  const { admin_key, token_id } = req.body || {};

  if (!verifyAdmin(admin_key)) {
    return res.status(401).json({ error: '管理员密钥无效' });
  }

  if (!token_id) {
    return res.status(400).json({ error: '请提供Token ID' });
  }

  // 先删除关联的搜索日志（设为NULL）
  await supabase
    .from('search_logs')
    .update({ token_id: null })
    .eq('token_id', token_id);

  // 再删除Token
  const { error } = await supabase
    .from('tokens')
    .delete()
    .eq('id', token_id);

  if (error) {
    console.error('[tokens] 删除失败:', error);
    return res.status(500).json({ error: '删除Token失败' });
  }

  return res.status(200).json({ success: true, message: 'Token已删除' });
}
