/**
 * 服务端搜索引擎
 * 从现有前端JS提取并优化，保持完全一致的搜索质量
 *
 * 功能：
 * - AI智能搜索（自然语言理解、城市提取、同义词展开）
 * - 模糊匹配 + 权重排序
 * - 岗位类型分类（国内实地/远程/PTA/国外实地/科研）
 * - 背景信息过滤
 */

const fs = require('fs');
const path = require('path');

// ==================== 岗位数据缓存 ====================

let _jobsCache = null;

/**
 * 加载岗位数据（带内存缓存，Vercel热启动复用）
 * 支持多种路径策略：process.cwd()、__dirname相对路径、根目录旧路径
 * @returns {Array} 岗位数据数组
 */
function loadJobs() {
  if (!_jobsCache) {
    const tryPaths = [
      // 策略1：Vercel部署环境（process.cwd()指向项目根目录）
      path.join(process.cwd(), 'data', 'jobs_data.json'),
      // 策略2：相对路径（api/_lib/ → ../../data/）
      path.join(__dirname, '..', '..', 'data', 'jobs_data.json'),
      // 策略3：根目录旧位置（兼容本地开发）
      path.join(process.cwd(), 'jobs_data.json')
    ];

    for (const dataPath of tryPaths) {
      try {
        if (fs.existsSync(dataPath)) {
          const raw = fs.readFileSync(dataPath, 'utf8');
          _jobsCache = JSON.parse(raw);
          console.log(`[search-engine] 已加载 ${_jobsCache.length} 条岗位数据 (路径: ${dataPath})`);
          break;
        }
      } catch (err) {
        console.error(`[search-engine] 尝试路径 ${dataPath} 失败:`, err.message);
      }
    }

    if (!_jobsCache) {
      console.error('[search-engine] 所有路径均无法加载岗位数据');
      _jobsCache = [];
    }
  }
  return _jobsCache;
}

// ==================== 智能同义词词典 ====================

const smartDict = {
  '计算机': ['计算机', '软件', '编程', '开发', 'IT', '互联网', '前端', '后端', '算法', '程序员', '码农'],
  '金融': ['金融', '经济学', '经济', '银行', '证券', '投资', '理财', '金融学', 'Finance'],
  '会计': ['会计', '财务', '审计', '税务', 'ACCA', 'CPA', 'Accounting'],
  '管理': ['管理', '工商管理', '行政管理', '人力资源', 'HR', 'Management'],
  '法律': ['法律', '法学', '律师', '法务', '合规', 'Law', '法律事务'],
  '医学': ['医学', '临床', '药学', '中医', '护理', 'Medical', 'Medicine'],
  '教育': ['教育', '师范', '教学', '培训', '教研', 'Education', '老师'],
  '设计': ['设计', '平面', 'UI', 'UX', '视觉', '艺术', 'Design', '设计师'],
  '传媒': ['传媒', '新闻', '传播', '广告', '新媒体', 'Media', '传媒学'],
  '数学': ['数学', '统计', '数据分析', '量化', '精算', 'Math', 'Statistics'],
  '化学': ['化学', '化工', 'Chemistry', 'Chemical', '化学工程', '应用化学'],
  '物理': ['物理', '物理学', 'Physics', '应用物理'],
  '生物': ['生物', '生物学', 'Bio', 'Biology', '生物工程', '生物技术'],
  '机械': ['机械', '机械工程', 'Mechanical', '自动化', '机电'],
  '电子': ['电子', '电气', 'EE', '电子工程', '电路', '芯片', '半导体'],
  '材料': ['材料', '材料科学', 'Materials', '纳米材料', '高分子'],
  '环境': ['环境', '环境工程', 'Environmental', '环保', '生态学'],
  '数据': ['数据', '大数据', '数据科学', '数据分析', '数据挖掘', '数据可视化', 'Data', 'Data Science', 'Big Data'],
  'AI': ['AI', '人工智能', '机器学习', '深度学习', 'NLP', 'CV', 'Artificial Intelligence', 'Machine Learning']
};

// ==================== 城市关键词 ====================

const cityKeywords = [
  '北京', '上海', '广州', '深圳', '杭州', '成都', '南京', '武汉',
  '西安', '重庆', '天津', '苏州', '长沙', '郑州', '青岛', '东莞',
  '宁波', '厦门', '福州', '无锡', '合肥', '大连', '济南', '佛山', '香港', '澳门'
];

// ==================== 岗位类型判断 ====================

/**
 * 获取岗位显示类型（国内实地/远程/PTA/国外实地/科研）
 * @param {Object} job - 岗位对象
 * @returns {string} 岗位类型
 */
function getJobType(job) {
  const category = job.category || '';
  
  // 直接使用数据源的分类标签
  switch (category) {
    case '国内实地': return '国内实地';
    case '远程': return '远程';
    case 'PTA': return 'PTA';
    case '国外实地': return '国外实地';
    case '科研': return '科研';
    default:
      // 兼容旧数据
      const sheetName = job.sheet_name || '';
      const projectType = job.project_type || '';
      if (category === '美国实习' || sheetName.includes('美国') || sheetName.includes('香港') || sheetName.includes('澳洲') || sheetName.includes('新加坡') || sheetName.includes('英国')) return '国外实地';
      if (category === '科研实习' || sheetName.includes('科研') || sheetName.includes('清华') || sheetName.includes('北大')) return '科研';
      if (category === '实地实习' || sheetName.includes('实地人事') || projectType === '实地') return '国内实地';
      if (category === '远程实习' || sheetName.includes('远程人事') || sheetName.includes('中科院') || projectType === '远程') return '远程';
      return '其他';
  }
}

// ==================== AI智能搜索 ====================

/**
 * AI智能搜索 - 支持自然语言理解（优化版v2）
 * 从用户输入中提取城市、关键词，并展开同义词
 * @param {string} query - 用户搜索查询
 * @returns {Object} { searchTerms, cityFilters, categoryHint }
 */
function aiSmartSearch(query) {
  query = query.toLowerCase();
  let searchTerms = [];
  let cityFilters = [];
  let categoryHint = null;

  // 检测 "pta" -> 自动切换到 PTA 分类
  if (query.includes('pta')) {
    categoryHint = 'PTA';
    query = query.replace(/pta/gi, '').trim();
  }

  // 第一步：从查询中提取所有城市
  let remainingQuery = query;
  for (const city of cityKeywords) {
    if (remainingQuery.includes(city.toLowerCase())) {
      cityFilters.push(city);
      remainingQuery = remainingQuery.replace(city.toLowerCase(), ' ');
    }
  }

  // 第二步：移除用户背景信息（学校、年级等）
  const userBackgroundPatterns = [
    /西交利物浦/g,
    /[\u4e00-\u9fa5]+大学/g,       // 所有XX大学
    /大[一二三四五六]|研[一二三]/g,  // 大一至大六、研一至研三
    /本科|硕士|博士|phd|mba/g,
    /我.*就读|我就读|我是.*学生/g
  ];

  for (const pattern of userBackgroundPatterns) {
    remainingQuery = remainingQuery.replace(pattern, ' ');
  }

  // 第三步：清理剩余查询，提取搜索词
  remainingQuery = remainingQuery
    .replace(/[的吗呢吧啊呀]/g, ' ')
    .replace(/有|在|相关|岗位|职位|工作|实习|招聘|吗|呢|吧|啊|的|是|我想找|请问|有没有/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 第四步：将剩余查询作为搜索词
  if (remainingQuery.length > 0) {
    searchTerms = remainingQuery.split(/\s+/).filter(t => t.length >= 1);
  }

  // 第五步：自动展开同义词
  let expandedTerms = [];
  for (const term of searchTerms) {
    expandedTerms.push(term);

    // 遍历 smartDict，查找匹配的同义词
    for (const [major, synonyms] of Object.entries(smartDict)) {
      if (synonyms.some(s => term.includes(s.toLowerCase()) || s.toLowerCase().includes(term))) {
        expandedTerms.push(...synonyms.map(s => s.toLowerCase()));
        break;
      }
    }
  }
  searchTerms = expandedTerms;

  // 去重
  searchTerms = [...new Set(searchTerms)];
  cityFilters = [...new Set(cityFilters)];

  return { searchTerms, cityFilters, categoryHint };
}

// ==================== 模糊匹配 ====================

/**
 * 模糊匹配：检查文本是否包含任一关键词
 * @param {string} text - 待匹配文本
 * @param {Array<string>} keywords - 关键词列表
 * @returns {boolean} 是否匹配
 */
function fuzzyMatch(text, keywords) {
  if (!text || !keywords || keywords.length === 0) return false;
  text = text.toLowerCase();
  for (const keyword of keywords) {
    if (keyword && text.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  return false;
}

// ==================== XSS防护 ====================

/**
 * 清理搜索查询，防止XSS攻击
 * @param {string} query - 原始查询
 * @returns {string} 清理后的查询
 */
function sanitizeQuery(query) {
  if (!query) return '';
  return String(query)
    .replace(/<[^>]*>/g, '')           // 移除HTML标签
    .replace(/[<>'";&\\]/g, '')        // 移除特殊字符
    .substring(0, 500)                  // 限制长度
    .trim();
}

// ==================== 主搜索函数 ====================

/**
 * 执行搜索
 * @param {string} query - 搜索查询
 * @param {string} category - 分类筛选（all/国内实地/远程/PTA/国外实地/科研）
 * @returns {Array} 搜索结果数组（已排序，已移除价格字段）
 */
function search(query, category = 'all') {
  const allJobs = loadJobs();

  let effectiveCategory = category;

  // 无搜索词，只按分类筛选
  if (!query || !query.trim()) {
    const results = allJobs.filter(job => {
      if (effectiveCategory !== 'all' && getJobType(job) !== effectiveCategory) return false;
      return true;
    });
    return results.map(stripPriceFields);
  }

  const { searchTerms, cityFilters, categoryHint } = aiSmartSearch(query);

  // 使用aiSmartSearch检测到的分类提示（如PTA关键词），避免重复检测
  if (categoryHint) {
    effectiveCategory = categoryHint;
  }

  // 搜索过滤
  let results = allJobs.filter(job => {
    if (effectiveCategory !== 'all' && getJobType(job) !== effectiveCategory) return false;

    // 城市过滤（支持多个）
    if (cityFilters.length > 0) {
      if (!job.location) return false;
      const matchCity = cityFilters.some(city => job.location.includes(city));
      if (!matchCity) return false;
    }

    // 关键词搜索
    const searchText = `${job.position} ${job.company} ${job.industry} ${job.duty} ${job.requirements} ${job.jd}`;
    return fuzzyMatch(searchText, searchTerms);
  });

  // 按匹配度排序
  if (searchTerms.length > 0) {
    results = results.map(job => {
      const searchText = `${job.position} ${job.company} ${job.industry} ${job.duty} ${job.requirements} ${job.jd}`.toLowerCase();

      let matchCount = 0;
      let totalScore = 0;

      searchTerms.forEach(term => {
        if (searchText.includes(term.toLowerCase())) {
          matchCount++;
          if (job.position && job.position.toLowerCase().includes(term.toLowerCase())) totalScore += 10;
          if (job.industry && job.industry.toLowerCase().includes(term.toLowerCase())) totalScore += 5;
          if (job.company && job.company.toLowerCase().includes(term.toLowerCase())) totalScore += 3;
        }
      });

      return { ...job, _matchCount: matchCount, _totalScore: totalScore };
    }).sort((a, b) => {
      if (b._matchCount !== a._matchCount) return b._matchCount - a._matchCount;
      if (b._totalScore !== a._totalScore) return b._totalScore - a._totalScore;
      const typeOrder = { '国内实地': 1, 'PTA': 2, '远程': 3, '国外实地': 4, '科研': 5, '其他': 6 };
      const typeA = typeOrder[getJobType(a)] || 5;
      const typeB = typeOrder[getJobType(b)] || 5;
      if (typeA !== typeB) return typeA - typeB;
      return 0;
    });
  }

  // 移除内部排序字段和价格字段
  return results.map(job => {
    const { _matchCount, _totalScore, price_1_2, price_3, remarks, sheet_name, ...publicJob } = job;
    return publicJob;
  });
}

/**
 * 移除岗位中的价格相关字段
 * @param {Object} job - 岗位对象
 * @returns {Object} 移除价格字段后的岗位对象
 */
function stripPriceFields(job) {
  const { price_1_2, price_3, remarks, sheet_name, ...publicJob } = job;
  return publicJob;
}

/**
 * 获取岗位统计信息
 * @returns {Object} { total, companies, industries }
 */
function getJobStats() {
  const allJobs = loadJobs();
  const companies = [...new Set(allJobs.map(j => j.company).filter(c => c && c !== '未知公司'))];
  const industries = [...new Set(allJobs.map(j => j.industry).filter(i => i))];
  return {
    total: allJobs.length,
    companies: companies.length,
    industries: industries.length
  };
}

module.exports = {
  search,
  loadJobs,
  getJobType,
  aiSmartSearch,
  fuzzyMatch,
  sanitizeQuery,
  getJobStats,
  smartDict,
  cityKeywords
};
