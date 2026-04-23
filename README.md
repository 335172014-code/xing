# 星辉实习 - AI智能岗位匹配系统

🎯 **让实习求职更智能**

一个基于AI的实习岗位查询和匹配系统，支持自然语言搜索、智能匹配、海报生成等功能。

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 🔍 **AI智能搜索** | 支持自然语言查询（如"深圳计算机实习"），自动识别城市、公司、专业 |
| 🎯 **智能匹配** | 根据专业、技能、行业、城市进行多维度匹配度评分 |
| 📱 **双端适配** | PC端和移动端独立设计，完美适配各种屏幕 |
| 🎨 **海报生成** | 根据岗位属性自动生成精美海报（科技风/金融风/学术风/通用风） |
| 📋 **详情展示** | 完整展示岗位信息（公司、行业、职责、要求等） |

## 🚀 在线体验

- **PC端**：[https://你的用户名.github.io/仓库名/](https://你的用户名.github.io/仓库名/)
- **移动端**：[https://你的用户名.github.io/仓库名/mobile.html](https://你的用户名.github.io/仓库名/mobile.html)

## 📦 部署到GitHub Pages

### 方法一：通过GitHub网站（推荐）

1. 访问 [GitHub.com](https://github.com) 并登录
2. 点击右上角 "+" → "New repository"
3. 填写仓库名（如 `xinghui-shiixi`）
4. **重要**：选择 "Public"（私有仓库无法使用GitHub Pages免费版）
5. 点击 "Create repository"
6. 在仓库页面，点击 "uploading an existing file"
7. 上传以下文件：
   - `index.html`（PC端）
   - `mobile.html`（移动端）
   - `jobs_data.json`（岗位数据）
   - `stats_data.json`（统计数据）
8. 上传完成后，进入仓库 "Settings" → "Pages"
9. Source 选择 "main" 分支，点击 Save
10. 等待2-3分钟，访问 `https://你的用户名.github.io/仓库名/`

### 方法二：通过Git命令

```bash
# 1. 在GitHub网站创建新仓库后，复制仓库URL
# 2. 在本地执行以下命令

cd /Users/niuniu/WorkBuddy/20260423202339
git remote add origin https://github.com/你的用户名/仓库名.git
git branch -M main
git push -u origin main

# 3. 进入仓库Settings → Pages，选择main分支，点击Save
```

## 🛠️ 技术栈

- **前端**：原生HTML/CSS/JavaScript（无框架依赖）
- **数据**：JSON格式，易于编辑和更新
- **部署**：GitHub Pages（免费静态托管）

## 📝 数据格式

岗位数据存储在 `jobs_data.json`，格式如下：

```json
[
  {
    "company": "公司名称",
    "category": "项目类型（实地实习/远程实习）",
    "industry": "所属行业",
    "position": "岗位名称",
    "project_type": "项目性质",
    "duration": "项目时间",
    "location": "工作地点",
    "requirements": "入职要求",
    "duty": "岗位职责",
    "benefits": "项目收获",
    "jd": "职位详情（JD）"
  }
]
```

## 🔧 本地开发

```bash
# 启动本地服务器
cd /Users/niuniu/WorkBuddy/20260423202339
python3 -m http.server 8080

# 访问
# PC端：http://localhost:8080/index.html
# 移动端：http://localhost:8080/mobile.html
```

## 📄 许可证

MIT License - 可自由使用、修改和分发

---

**开发者**：星辉实习团队  
**更新时间**：2026年4月
