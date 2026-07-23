#!/usr/bin/env node
/**
 * 场景包语料接入脚本（通用版 V2.0）
 * 功能：解析 Minimax 场景包 .md 文件 → 按条目切分 → 过滤"行号待核" → 写入 Supabase
 * 支持：增量更新（同 scenario 先清后插）、metadata 保留来源标注、6场景全覆盖
 * 质量门禁：含"行号待核/行号待补/待补行号/待核"标记的条目不写入DB
 *
 * 用法：
 *   node scripts/ingest-corpus.js F     ← 单场景
 *   node scripts/ingest-corpus.js all   ← 全场景批量
 *
 * 环境变量：SUPABASE_SERVICE_ROLE_KEY（必须）、NEXT_PUBLIC_SUPABASE_URL（可选）
 * 依赖：@supabase/supabase-js（已安装）
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ============================================================
// 配置
// ============================================================
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jhmyuyxytbypaqhdkfgh.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) {
  console.error('❌ 缺少 SUPABASE_SERVICE_ROLE_KEY 环境变量');
  console.error('   export SUPABASE_SERVICE_ROLE_KEY=sb_secret__...');
  process.exit(1);
}

// 场景选择：命令行参数（A-F 或 all），默认 F
const SCENARIO = (process.argv[2] || 'F').toUpperCase();

// 场景目录映射（6场景全覆盖）
const SCENARIO_DIRS = {
  A: '场景A-AI时代精准表达',
  B: '场景B-老板AI建议绑架',
  C: '场景C-招不到合适的人',
  D: '场景D-绩效推不动加薪酬激励失效',
  E: '场景E-培训没人用',
  F: '场景F-职业迷茫',
};

// 批量模式
const BATCH_MODE = SCENARIO === 'ALL';
const SCENARIOS_TO_RUN = BATCH_MODE ? Object.keys(SCENARIO_DIRS) : [SCENARIO];

if (!BATCH_MODE && !SCENARIO_DIRS[SCENARIO]) {
  console.error(`❌ 未知场景 "${SCENARIO}"，已知场景：${Object.keys(SCENARIO_DIRS).join(', ')}`);
  process.exit(1);
}

// 跳过的文件（说明文档，不是语料）
const SKIP_FILES = ['00-场景包说明.md'];

// 模块名映射
const MODULE_MAP = {
  '01': 'A描述库',
  '02': 'B描述库',
  '03': 'S组件库-认知层',
  '04': 'S组件库-方法层',
  '05': 'S组件库-路径层',
  '06': 'S组件库-工具层',
  '07': 'S组件库-案例层',
  '08': '避坑指南',
};

// ============================================================
// 质量门禁：检测"行号待核"标记
// ============================================================
const UNVERIFIED_PATTERN = /行号待核|行号待补|待补行号|待核/;

function hasUnverifiedSource(entry) {
  const content = entry.content || '';
  const source = (entry.metadata && entry.metadata.source) || '';
  return UNVERIFIED_PATTERN.test(content) || UNVERIFIED_PATTERN.test(source);
}

// ============================================================
// 主流程（支持单场景 + 批量模式）
// ============================================================
async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const batchStats = [];

  for (const scenario of SCENARIOS_TO_RUN) {
    const dirName = SCENARIO_DIRS[scenario];
    const corpusDir = path.resolve(
      __dirname, '..', '..', '..', '..',
      '02-ABS知识库重组（Minimax执行）', '05-提交验收', dirName
    );

    console.log('═══════════════════════════════════════');
    console.log(`  场景${scenario} 语料接入`);
    console.log('═══════════════════════════════════════\n');

    // 1. 扫描语料目录
    const files = fs.readdirSync(corpusDir)
      .filter((f) => f.endsWith('.md') && !SKIP_FILES.includes(f))
      .sort();

    console.log(`📂 ${dirName}`);
    console.log(`📄 ${files.length} 个模块文件\n`);

    // 2. 解析所有文件 → 条目列表
    let allEntries = [];
    let totalRawBytes = 0;

    for (const file of files) {
      const filePath = path.join(corpusDir, file);
      const raw = fs.readFileSync(filePath, 'utf-8');
      totalRawBytes += Buffer.byteLength(raw, 'utf-8');
      const prefix = file.substring(0, 2);
      const moduleName = MODULE_MAP[prefix] || file;
      const entries = parseFile(raw, file, moduleName);
      console.log(`   ${file} → ${entries.length} 条`);
      allEntries = allEntries.concat(entries);
    }

    // 3. 质量过滤：排除"行号待核"条目
    const cleanEntries = allEntries.filter((e) => !hasUnverifiedSource(e));
    const filteredCount = allEntries.length - cleanEntries.length;

    console.log(`\n📊 解析: ${allEntries.length} 条 | 过滤(待核): ${filteredCount} 条 | 入库: ${cleanEntries.length} 条 (${(totalRawBytes / 1024).toFixed(1)} KB)\n`);

    // 4. 模块分布（入库条目）
    const byModule = {};
    for (const e of cleanEntries) {
      byModule[e.module_name] = (byModule[e.module_name] || 0) + 1;
    }
    console.log('📋 入库模块分布：');
    for (const [mod, count] of Object.entries(byModule)) {
      console.log(`   ${mod}: ${count} 条`);
    }
    if (filteredCount > 0) {
      console.log(`   ⚠️ 已过滤(待核): ${filteredCount} 条`);
    }

    // 5. 写入 Supabase
    console.log('\n💾 写入 Supabase...');
    const { error: delErr } = await supabase
      .from('scenario_packages').delete().eq('scenario', scenario);
    if (delErr) {
      console.error(`   ❌ 清空失败：${delErr.message}`);
      continue;
    }
    console.log('   ✅ 已清空旧数据');

    const BATCH_SIZE = 50;
    let inserted = 0;
    for (let i = 0; i < cleanEntries.length; i += BATCH_SIZE) {
      const batch = cleanEntries.slice(i, i + BATCH_SIZE).map((e) => ({
        scenario, module_name: e.module_name, content: e.content,
        metadata: e.metadata,
      }));
      const { error } = await supabase.from('scenario_packages').insert(batch);
      if (error) {
        console.error(`   ❌ 批次${Math.floor(i / BATCH_SIZE) + 1}失败：${error.message}`);
        process.exit(1);
      }
      inserted += batch.length;
    }
    console.log(`   ✅ 写入 ${inserted} 条`);

    // 6. 验证
    const { data: verify } = await supabase
      .from('scenario_packages')
      .select('id, module_name', { count: 'exact' })
      .eq('scenario', scenario);

    const dbCount = verify?.length || 0;
    const match = dbCount === cleanEntries.length ? '✅ 精确匹配' : `⚠️ 不一致(预期${cleanEntries.length})`;
    console.log(`\n🔍 DB: scenario='${scenario}' = ${dbCount} 条 ${match}`);

    batchStats.push({
      scenario, dirName,
      parsed: allEntries.length,
      filtered: filteredCount,
      written: dbCount,
      kb: (totalRawBytes / 1024).toFixed(1),
      byModule,
    });

    console.log('');
  }

  // 7. 批量报告
  if (BATCH_MODE || SCENARIOS_TO_RUN.length > 1) {
    console.log('═══════════════════════════════════════');
    console.log('  全场景入库汇总');
    console.log('═══════════════════════════════════════\n');
    let totalParsed = 0, totalFiltered = 0, totalWritten = 0;
    for (const s of batchStats) {
      console.log(`  场景${s.scenario}: 解析${s.parsed} → 过滤${s.filtered} → 入库${s.written}`);
      totalParsed += s.parsed;
      totalFiltered += s.filtered;
      totalWritten += s.written;
    }
    console.log(`\n  📊 总计: 解析${totalParsed} → 过滤${totalFiltered} → 入库${totalWritten}`);
    console.log('═══════════════════════════════════════');
  }
}

// ============================================================
// 解析器：单个 .md 文件 → 条目数组
// 支持两种格式：
//   格式A: ### XX-NN｜标题（场景F/C/D 大部分模块）
//   格式B: ### N.N 标题（案例层数字子节格式，如 ### 2.1 案例概要）
// ============================================================
function parseFile(raw, fileName, moduleName) {
  const lines = raw.split('\n');

  // 先尝试格式A（条目ID格式）
  const entries = parseFormatA(lines, fileName, moduleName);
  if (entries.length > 0) return entries;

  // 案例层特殊处理：尝试格式B（数字子节格式）
  return parseFormatB(lines, fileName, moduleName);
}

/**
 * 格式A：### XX-NN｜标题 或 ### XX-NN | 标题
 */
function parseFormatA(lines, fileName, moduleName) {
  const entries = [];
  const headers = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^###\s+\w+-\d+/.test(line)) {
      headers.push({ index: i, line });
    }
  }

  for (let h = 0; h < headers.length; h++) {
    const startIdx = headers[h].index;
    const endIdx =
      h + 1 < headers.length ? headers[h + 1].index : lines.length;

    // 条目 ID 和标题
    const headerMatch = headers[h].line.match(/^###\s+(\w+-\d+)\s*[｜|](.+)/);
    if (!headerMatch) continue;

    const entryId = headerMatch[1];
    const title = headerMatch[2].trim();

    // 条目内容（从标题行到下一个 ### 或 ## 或文件末尾）
    let contentLines = [];
    let inMetadata = false;
    const metadata = {
      entry_id: entryId,
      title,
      source_file: fileName,
      module_name: moduleName,
      source: '',
      pain_type: '',
      stage: '',
    };

    for (let i = startIdx + 1; i < endIdx; i++) {
      const line = lines[i];

      // 遇到 ## 表示新的大节，当前条目结束
      if (/^##\s/.test(line)) break;

      // 提取元数据
      if (/^>\s*来源[：:]/.test(line)) {
        metadata.source = line.replace(/^>\s*来源[：:]\s*/, '').trim();
        inMetadata = true;
        continue;
      }
      if (/^>\s*痛点[：:]/.test(line)) {
        metadata.pain_type = line.replace(/^>\s*痛点[：:]\s*/, '').trim();
        inMetadata = true;
        continue;
      }
      if (/^>\s*(对话阶段|B3|适用对话阶段)[：:]/.test(line)) {
        metadata.stage = line.replace(/^>\s*(对话阶段|B3|适用对话阶段)[：:]\s*/, '').trim();
        inMetadata = true;
        continue;
      }
      // 其他引用行（`> ` 开头）
      if (/^>\s/.test(line) && !inMetadata) {
        contentLines.push(line.replace(/^>\s*/, ''));
        continue;
      }
      // 普通内容行
      if (line.trim()) {
        contentLines.push(line);
      } else if (contentLines.length > 0) {
        // 空行：保留段落分隔
        contentLines.push('');
      }
      inMetadata = false;
    }

    // 组装 content（标题 + 正文）
    const fullContent = `【${entryId}】${title}\n\n${contentLines.join('\n').trim()}`;

    if (fullContent.trim().length < 20) continue; // 跳过空条目

    entries.push({
      module_name: moduleName,
      content: fullContent,
      metadata,
    });
  }

  return entries;
}

/**
 * 格式B：案例层数字子节格式（### N.N 标题）
 * 将同一大节下的子节合并为一个案例条目
 * 场景C/D 案例层使用此格式
 */
function parseFormatB(lines, fileName, moduleName) {
  const entries = [];
  const caseMap = new Map(); // majorNum → { title, lines }

  // 找到案例总览表提取 case ID 列表
  const caseIds = [];
  for (const line of lines) {
    const match = line.match(/^\|\s*(C-\d+)\s*\|/);
    if (match && !caseIds.includes(match[1])) {
      caseIds.push(match[1]);
    }
  }

  // 找到所有 ### N.N 标题
  const subsections = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^###\s+(\d+)\.(\d+)\s*(.+)?$/);
    if (m) {
      subsections.push({ index: i, major: parseInt(m[1]), minor: parseInt(m[2]), title: (m[3] || '').trim() });
    }
  }

  if (subsections.length === 0) return entries;

  // 找到 ## 二、案例详情 的位置（案例正文从此开始）
  let detailStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+二[、，]\s*案例详情/.test(lines[i])) {
      detailStart = i;
      break;
    }
  }

  // 按大节号分组（跳过 1，那是总览）
  const majorNums = [...new Set(subsections.map(s => s.major))].filter(n => n >= 2).sort();

  for (let ci = 0; ci < majorNums.length; ci++) {
    const major = majorNums[ci];
    const caseId = caseIds[ci] || `C-${String(major - 1).padStart(2, '0')}`;

    // 收集该大节下所有子节的内容
    const majorSubs = subsections.filter(s => s.major === major).sort((a, b) => a.minor - b.minor);
    if (majorSubs.length === 0) continue;

    const firstSub = majorSubs[0];
    const lastSub = majorSubs[majorSubs.length - 1];

    // 从第一个子节标题行开始，到下一个大节（或文件末尾）
    const startIdx = firstSub.index;
    const nextMajor = majorNums[ci + 1];
    let endIdx = lines.length;
    if (nextMajor) {
      const nextFirst = subsections.find(s => s.major === nextMajor);
      if (nextFirst) endIdx = nextFirst.index;
    }

    // 收集内容（跳过 ### 标题行本身，收集所有正文）
    const contentLines = [];
    for (let i = startIdx; i < endIdx; i++) {
      const line = lines[i];
      // 跳过子节标题行
      if (/^###\s+\d+\.\d+/.test(line)) continue;
      // 遇到 ## 停止
      if (/^##\s/.test(line)) break;
      if (line.trim()) {
        contentLines.push(line);
      } else if (contentLines.length > 0) {
        contentLines.push('');
      }
    }

    // 从第一个子节标题提取案例名称
    const caseTitle = firstSub.title || caseId;

    const fullContent = `【${caseId}】${caseTitle}\n\n${contentLines.join('\n').trim()}`;
    if (fullContent.trim().length < 50) continue;

    entries.push({
      module_name: moduleName,
      content: fullContent,
      metadata: {
        entry_id: caseId,
        title: caseTitle,
        source_file: fileName,
        module_name: moduleName,
        source: '',
        pain_type: '',
        stage: '',
      },
    });
  }

  return entries;
}

main().catch((err) => {
  console.error('脚本异常：', err);
  process.exit(1);
});
