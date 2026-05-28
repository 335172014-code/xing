/**
 * 从腾讯文档API批量读取岗位数据 - v3
 * 使用cells格式 + 写文件避免shell转义问题
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FILE_URL = 'https://docs.qq.com/sheet/DZk5MdHFPeXVZRHZp';
const OUTPUT_PATH = '/Users/eva/WorkBuddy/2026-05-28-15-49-39/xing-project/data/jobs_data.json';
const TEMP_DIR = '/Users/eva/WorkBuddy/2026-05-28-15-49-39/xing-project/scripts/temp_data';

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const SHEETS = [
  { id: 'BB08J2', name: '实地人事报价单（稳定-请事先确认hc）', category: '国内实地', headerRow: 0, dataStartRow: 1, colCount: 12, rowCount: 774 },
  { id: 'ge3n6h', name: '远程人事系统报价单', category: '远程', headerRow: 0, dataStartRow: 1, colCount: 13, rowCount: 456 },
  { id: 'wqgjo3', name: '远程人事备案报价单', category: '远程', headerRow: 1, dataStartRow: 2, colCount: 6, rowCount: 204 },
  { id: 'ygm91a', name: '中科院纳米能源与系统研究所', category: '远程', headerRow: 0, dataStartRow: 1, colCount: 12, rowCount: 200 },
  { id: 'zk0uz6', name: 'PTA报价单', category: 'PTA', headerRow: 1, dataStartRow: 2, colCount: 5, rowCount: 231 },
  { id: '8yjrhw', name: '香港实习', category: '国外实地', headerRow: 0, dataStartRow: 1, colCount: 12, rowCount: 206 },
  { id: 'fhn9q4', name: '美国实习', category: '国外实地', headerRow: 0, dataStartRow: 1, colCount: 13, rowCount: 3094 },
  { id: 'pi45s4', name: '澳洲实习', category: '国外实地', headerRow: 0, dataStartRow: 3, colCount: 12, rowCount: 314 },
  { id: 'nu1jk9', name: '新加坡实习', category: '国外实地', headerRow: 0, dataStartRow: 1, colCount: 12, rowCount: 213 },
  { id: 'ixstqw', name: '英国实习', category: '国外实地', headerRow: 0, dataStartRow: 2, colCount: 11, rowCount: 259 },
  { id: 'kzgw28', name: '清华科研', category: '科研', headerRow: 0, dataStartRow: 1, colCount: 11, rowCount: 204 },
  { id: 'ohqeog', name: '北大科研', category: '科研', headerRow: 0, dataStartRow: 1, colCount: 12, rowCount: 208 },
];

const BATCH_SIZE = 50;

function callSheetAPI(sheetId, startRow, endRow, colCount) {
  const outFile = path.join(TEMP_DIR, `out_${sheetId}_${startRow}.json`);
  
  const args = JSON.stringify({
    file_url: FILE_URL,
    sheet_id: sheetId,
    start_row: startRow,
    start_col: 0,
    end_row: endRow,
    end_col: colCount - 1,
    return_csv: false
  });
  
  // Write args to temp file, then use it
  const argsFile = path.join(TEMP_DIR, `args_${sheetId}_${startRow}.json`);
  fs.writeFileSync(argsFile, args);
  
  const cmd = `mcporter call tencent-sheetengine get_cell_data --args "$(cat '${argsFile}')" > "${outFile}" 2>&1 || true`;
  
  try {
    execSync(cmd, { encoding: 'utf-8', timeout: 60000, maxBuffer: 10 * 1024 * 1024 });
    const content = fs.readFileSync(outFile, 'utf-8');
    
    // Try to find JSON in output (skip any mcporter prefix lines)
    let jsonStr = content;
    const jsonStart = content.indexOf('{');
    if (jsonStart > 0) jsonStr = content.slice(jsonStart);
    
    return JSON.parse(jsonStr);
  } catch (e) {
    // Try reading the output file anyway
    try {
      const content = fs.readFileSync(outFile, 'utf-8');
      const jsonStart = content.indexOf('{');
      if (jsonStart >= 0) {
        return JSON.parse(content.slice(jsonStart));
      }
    } catch (e2) {}
    console.error(`  ❌ Failed rows ${startRow}-${endRow}: ${e.message.slice(0, 80)}`);
    return null;
  }
}

function getCellValue(cell) {
  if (!cell) return '';
  switch (cell.value_type) {
    case 'STRING': return cell.string_value || '';
    case 'NUMBER': return cell.number_value != null ? String(cell.number_value) : '';
    case 'BOOL': return cell.bool_value != null ? String(cell.bool_value) : '';
    case 'FORMULA': return cell.formula || '';
    default: return cell.string_value || (cell.number_value != null ? String(cell.number_value) : '');
  }
}

function cleanPrice(val) {
  if (!val) return '';
  return val.replace(/[,\s¥￥元]/g, '').replace(/["]/g, '').trim();
}

function normalizeRow(row, headers, sheet) {
  const get = (colName) => {
    const idx = headers.indexOf(colName);
    return idx >= 0 && idx < row.length ? row[idx] : '';
  };
  // Also try getting by column index directly (for sheets with tricky headers)
  const getByIdx = (idx) => idx >= 0 && idx < row.length ? row[idx] : '';
  
  const category = sheet.category;
  const sheetName = sheet.name;
  
  let industry = '', company = '', position = '', projectType = '', duration = '', location = '';
  let benefits = '', requirements = '', jd = '', price12 = '', price3 = '', remarks = '';
  
  switch (sheetName) {
    case '实地人事报价单（稳定-请事先确认hc）':
    case '远程人事系统报价单':
    case '香港实习':
    case '新加坡实习':
      industry = get('行业'); company = get('公司'); position = get('岗位');
      projectType = get('项目形式'); duration = get('项目时间'); location = get('项目地点');
      benefits = get('项目收获'); requirements = get('入职要求');
      price12 = cleanPrice(get('1-2个月售价')); price3 = cleanPrice(get('3个月售价'));
      jd = get('JD'); remarks = get('备注');
      break;
      
    case '远程人事备案报价单':
      // Headers: col0=empty, col1=序号, col2=行业, col3=公司, col4=岗位, col5=远程走人事报价
      industry = getByIdx(2); company = getByIdx(3); position = getByIdx(4);
      duration = '2-3个月'; price12 = cleanPrice(getByIdx(5));
      projectType = '远程';
      break;
      
    case '中科院纳米能源与系统研究所':
      company = get('公司'); industry = get('方向'); position = get('岗位');
      projectType = get('项目形式'); duration = get('项目时间'); location = get('项目地点');
      benefits = get('项目收获'); requirements = get('入职要求');
      price12 = cleanPrice(get('1-2个月售价')); price3 = cleanPrice(get('3个月售价'));
      jd = get('JD'); remarks = get('备注');
      break;
      
    case 'PTA报价单':
      // Headers: col0=empty, col1=行业, col2=企业, col3=岗位, col4=价格
      industry = getByIdx(1); company = getByIdx(2); position = getByIdx(3);
      duration = '1个月';
      price12 = cleanPrice(getByIdx(4));
      jd = getByIdx(5) || getByIdx(4); projectType = 'PTA';
      break;
      
    case '美国实习':
      industry = get('行业'); company = get('公司名称'); position = get('招聘岗位');
      duration = get('实习时长和实习形式'); price12 = cleanPrice(get('底价-人民币'));
      jd = get('岗位JD（中文）') || get('岗位JD（英文）');
      location = '美国';
      const sponsor = get('是否Sponsor'); const email = get('是否注册公司邮箱');
      remarks = [sponsor ? `Sponsor: ${sponsor}` : '', email ? `注册邮箱: ${email}` : ''].filter(Boolean).join(' | ');
      break;
      
    case '澳洲实习':
      // Headers (row 0-1, split): col0=行业, col1=公司, col2=公司网址, col3=公司介绍, col4=岗位名称, col5=岗位JD, col6=实习形式, col7=公司地点, col8=结算价, col9=是否有转正机会, col10=是否有薪资, col11=岗位海报
      industry = getByIdx(0); company = getByIdx(1); position = getByIdx(4);
      projectType = getByIdx(6); location = getByIdx(7) || '澳洲';
      price12 = cleanPrice(getByIdx(8)); jd = getByIdx(5);
      remarks = [getByIdx(9), getByIdx(10)].filter(Boolean).join(' | ');
      break;
      
    case '英国实习':
      // Headers: col0=行业, col1=公司名字, col2=公司概况, col3=岗位, col4=参考岗位JD, col5=官网, col6=实习形式, col7=公司地点, col8=实习时长, col9=实习费用, col10=评估要求和企业亮点
      industry = getByIdx(0); company = getByIdx(1); position = getByIdx(3);
      duration = getByIdx(8); price12 = cleanPrice(getByIdx(9));
      jd = getByIdx(4); location = getByIdx(7) || '英国';
      remarks = getByIdx(10);
      break;
      
    case '清华科研':
      // Headers: col0=empty(公司名), col1=岗位, col2=项目形式, col3=项目时间, col4=项目地点, col5=项目收获, col6=入职要求, col7=1-2个月售价, col8=3个月售价, col9=JD, col10=备注
      company = getByIdx(0) || '清华'; position = getByIdx(1);
      projectType = getByIdx(2); duration = getByIdx(3); location = getByIdx(4);
      benefits = getByIdx(5); requirements = getByIdx(6);
      price12 = cleanPrice(getByIdx(7)); price3 = cleanPrice(getByIdx(8));
      jd = getByIdx(9); remarks = getByIdx(10); industry = '科研-清华';
      break;
      
    case '北大科研':
      company = get('公司'); position = get('岗位');
      projectType = get('项目形式'); duration = get('项目时间'); location = get('项目地点');
      benefits = get('项目收获'); requirements = get('入职要求');
      price12 = cleanPrice(get('1-2个月售价')); price3 = cleanPrice(get('3个月售价'));
      jd = get('JD'); remarks = get('备注'); industry = '科研-北大';
      break;
  }
  
  if (!company && !position) return null;
  
  if (category === '国外实地' && !location) {
    if (sheetName.includes('香港')) location = '中国香港';
    else if (sheetName.includes('美国')) location = '美国';
    else if (sheetName.includes('澳洲')) location = '澳洲';
    else if (sheetName.includes('新加坡')) location = '新加坡';
    else if (sheetName.includes('英国')) location = '英国';
  }
  
  return {
    category, sheet_name: sheetName,
    industry: industry || '', company: company || '', position: position || '',
    project_type: projectType || '', duration: duration || '', location: location || '',
    benefits: benefits || '', requirements: requirements || '', duty: '',
    jd: (jd || '').slice(0, 2000),
    price_1_2: price12 || '', price_3: price3 || '', remarks: remarks || ''
  };
}

async function main() {
  const allJobs = [];
  
  for (const sheet of SHEETS) {
    console.log(`\n📥 ${sheet.name} (${sheet.category}, ~${sheet.rowCount} rows)`);
    let sheetJobs = [];
    
    // Read headers
    const headerResult = callSheetAPI(sheet.id, sheet.headerRow, sheet.headerRow, sheet.colCount);
    if (!headerResult || !headerResult.cells) {
      console.error(`  ❌ Failed to read headers`);
      continue;
    }
    const headers = [];
    for (let c = 0; c < sheet.colCount; c++) {
      const cell = headerResult.cells.find(hc => hc.col === c);
      headers.push(cell ? getCellValue(cell) : '');
    }
    console.log(`  Headers: ${headers.filter(Boolean).join(' | ')}`);
    
    // Read data in batches
    const dataEndRow = sheet.rowCount - 1;
    
    for (let startRow = sheet.dataStartRow; startRow <= dataEndRow; startRow += BATCH_SIZE) {
      const endRow = Math.min(startRow + BATCH_SIZE - 1, dataEndRow);
      const result = callSheetAPI(sheet.id, startRow, endRow, sheet.colCount);
      
      if (!result || !result.cells) {
        continue; // already logged error
      }
      
      for (let r = startRow; r <= endRow; r++) {
        const row = [];
        for (let c = 0; c < sheet.colCount; c++) {
          const cell = result.cells.find(rc => rc.row === r && rc.col === c);
          row.push(cell ? getCellValue(cell) : '');
        }
        const job = normalizeRow(row, headers, sheet);
        if (job) sheetJobs.push(job);
      }
    }
    
    allJobs.push(...sheetJobs);
    
    // Fill down empty company/industry from previous rows (merged cells)
    const fillDownFields = ['company', 'industry', 'location', 'project_type', 'duration', 'benefits', 'requirements', 'price_1_2', 'price_3'];
    for (let i = 1; i < sheetJobs.length; i++) {
      for (const field of fillDownFields) {
        if (!sheetJobs[i][field] && sheetJobs[i-1][field] && sheetJobs[i-1].sheet_name === sheetJobs[i].sheet_name) {
          sheetJobs[i][field] = sheetJobs[i-1][field];
        }
      }
    }
    
    // Re-filter: remove rows that still have no company AND no position after fill-down
    const beforeCount = sheetJobs.length;
    sheetJobs = sheetJobs.filter(j => j.company || j.position);
    const removedByFilter = beforeCount - sheetJobs.length;
    
    // Update allJobs with the filtered version
    allJobs.splice(allJobs.length - beforeCount, beforeCount, ...sheetJobs);
    
    const noCompany = sheetJobs.filter(j => !j.company).length;
    console.log(`  ✅ ${sheetJobs.length} records (fill-down applied, ${noCompany} still no company, ${removedByFilter} removed as empty)`);
  }
  
  console.log('\n📊 === SUMMARY ===');
  const catCounts = {};
  for (const j of allJobs) catCounts[j.category] = (catCounts[j.category] || 0) + 1;
  for (const [c, n] of Object.entries(catCounts)) console.log(`  ${c}: ${n}`);
  console.log(`Total: ${allJobs.length}`);
  
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allJobs, null, 2), 'utf-8');
  console.log(`\n✅ Written to ${OUTPUT_PATH}`);
  
  // Cleanup
  try {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  } catch (e) {}
}

main().catch(console.error);
