# 双版本部署指南

## 架构说明

| 版本 | GitHub分支 | Vercel项目 | 管理员密钥 | 数据存储 |
|------|-----------|-----------|-----------|---------|
| 正式版 | `main` | xing（已有） | `admin-xing-2026` | GitHub main分支 |
| 测试版 | `dev` | xing-test（需创建） | `admin-xing-test-2026` | GitHub dev分支 |

**数据完全隔离**：Token、搜索日志各自存在各自分支，互不干扰。

---

## 第一步：确认正式版（已有）

你当前的 Vercel 项目已经连接到 `main` 分支，推送代码后自动部署。
正式版推送 `main` 分支 → Vercel 自动部署。

## 第二步：创建测试版 Vercel 项目（4步点击）

1. 打开 https://vercel.com/new
2. 选择 **Import Git Repository** → 选择 `335172014-code/xing`
3. 配置项目：
   - **Project Name**: `xing-test`
   - **Framework Preset**: Other
   - **Root Directory**: `.`（保持默认）
   - **Build and Output Settings**: 全部默认
4. 点击 **Deploy**

部署完成后，你会得到一个测试版 URL，类似：
- `https://xing-test-xxx.vercel.app`

## 第三步：设置测试版跟踪 dev 分支

1. 进入 xing-test 项目 → **Settings** → **Git**
2. 在 **Production Branch** 中，将 `main` 改为 `dev`
3. 保存

这样：推送 `dev` 分支 → xing-test 自动部署，推送 `main` → xing 正式版自动部署。

---

## 日常使用

### 发给同事正式使用
分享正式版 URL + 生成正式版 Token（admin key: `admin-xing-2026`）

### 发给同事测试
分享测试版 URL + 生成测试版 Token（admin key: `admin-xing-test-2026`）

### 更新岗位数据
1. 在本地 main 分支更新 `data/jobs_data.json`
2. 推送 main → 正式版自动更新
3. 合并到 dev → 测试版自动更新：
   ```bash
   git checkout dev && git merge main && git push origin dev
   ```

---

## URL 汇总

| 版本 | 用户页面 | 管理看板 |
|------|---------|---------|
| 正式版 | `https://你的正式域名.vercel.app` | `https://你的正式域名.vercel.app/admin` |
| 测试版 | `https://xing-test-xxx.vercel.app` | `https://xing-test-xxx.vercel.app/admin` |
