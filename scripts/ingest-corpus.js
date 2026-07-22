#!/usr/bin/env node
/**
 * 场景包语料接入脚本（通用版）
 * 功能：解析 Minimax 场景包 .md 文件 → 按条目切分 → 写入 Supabase scenario_packages
 * 支持：增量更新（同 scenario 先清后插）、metadata 保留来源标注、多场景切换
 *
 * 用法：
 *   node scripts/ingest-corpus.js F    ← 场景F（职业迷茫）
 *   node scripts/ingest-corpus.js C    ← 场景C（招不到合适的人）
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

// 场景选择：命令行参数（F/C），默认 F
const SCENARIO = (process.argv[2] || 'F').toUpperCase();

// 场景目录映射
const SCENARIO_DIRS = {
  F: '场景F-职业迷茫',
  C: '场景C-招不到合适的人',
};

if (!SCENARIO_DIRS[SCENARIO]) {
  console.error(`❌ 未知场景 "${SCENARIO}"，已知场景：${Object.keys(SCENARIO_DIRS).join(', ')}`);
  process.exit(1);
}

const CORPUS_DIR = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '02-ABS知识库重组（Minimax执行）',
  '05-提交验收',
  SCENARIO_DIRS[SCENARIO]
);

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
// 主流程
// ============================================================
async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  console.log('═══════════════════════════════════════');
  console.log(`  场景${SCENARIO} 语料接入`);
  console.log('═══════════════════════════════════════\n');

  // 1. 扫描语料目录
  const files = fs
    .readdirSync(CORPUS_DIR)
    .filter((f) => f.endsWith('.md') && !SKIP_FILES.includes(f))
    .sort();

  console.log(`📂 语料目录：${CORPUS_DIR}`);
  console.log(`📄 发现 ${files.length} 个语料文件\n`);

  // 2. 解析所有文件 → 条目列表
  let allEntries = [];
  let totalRawBytes = 0;

  for (const file of files) {
    const filePath = path.join(CORPUS_DIR, file);
    const raw = fs.readFileSync(filePath, 'utf-8');
    totalRawBytes += Buffer.byteLength(raw, 'utf-8');

    const prefix = file.substring(0, 2); // "01", "02", ...
    const moduleName = MODULE_MAP[prefix] || file;
    const entries = parseFile(raw, file, moduleName);

    console.log(`   ${file} → ${entries.length} 条`);
    allEntries = allEntries.concat(entries);
  }

  console.log(`\n📊 解析完成：${allEntries.length} 条语料（${(totalRawBytes / 1024).toFixed(1)} KB）\n`);

  // 3. 按模块统计
  const byModule = {};
  for (const e of allEntries) {
    byModule[e.module_name] = (byModule[e.module_name] || 0) + 1;
  }
  console.log('📋 模块分布：');
  for (const [mod, count] of Object.entries(byModule)) {
    console.log(`   ${mod}: ${count} 条`);
  }

  // 4. 写入 Supabase（增量更新：先清后插）
  console.log('\n💾 写入 Supabase...');

  const { error: delErr } = await supabase
    .from('scenario_packages')
    .delete()
    .eq('scenario', SCENARIO);

  if (delErr) {
    console.error('   ❌ 清空旧语料失败：', delErr.message);
    process.exit(1);
  }
  console.log('   ✅ 已清空旧语料');

  // 分批插入（Supabase 单次 insert 有限制）
  const BATCH_SIZE = 50;
  let inserted = 0;

  for (let i = 0; i < allEntries.length; i += BATCH_SIZE) {
    const batch = allEntries.slice(i, i + BATCH_SIZE).map((e) => ({
      scenario: SCENARIO,
      module_name: e.module_name,
      content: e.content,
      metadata: e.metadata,
      // embedding 留空，后续 embedding 服务就绪后补填
    }));

    const { error } = await supabase.from('scenario_packages').insert(batch);
    if (error) {
      console.error(`   ❌ 批次 ${Math.floor(i / BATCH_SIZE) + 1} 插入失败：`, error.message);
      process.exit(1);
    }
    inserted += batch.length;
  }

  console.log(`   ✅ 成功写入 ${inserted} 条`);

  // 5. 验证
  const { data: verify, error: verifyErr } = await supabase
    .from('scenario_packages')
    .select('id, module_name', { count: 'exact' })
    .eq('scenario', SCENARIO);

  console.log(`\n🔍 验证：DB 中 scenario='${SCENARIO}' 共 ${verify?.length || 0} 条`);
  const verifyByMod = {};
  for (const v of verify || []) {
    verifyByMod[v.module_name] = (verifyByMod[v.module_name] || 0) + 1;
  }
  for (const [mod, count] of Object.entries(verifyByMod)) {
    console.log(`   ${mod}: ${count} 条`);
  }

  console.log('\n═══════════════════════════════════════');
  console.log('  ✅ 语料接入完成');
  console.log('═══════════════════════════════════════');
}

// ============================================================
// 解析器：单个 .md 文件 → 条目数组
// ============================================================
function parseFile(raw, fileName, moduleName) {
  const entries = [];
  const lines = raw.split('\n');

  // 找到所有 ### 标题行的位置（条目边界）
  const headers = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^###\s+\w+-\d+/.test(line)) {
      headers.push({ index: i, line });
    }
  }

  // 按条目切分
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

main().catch((err) => {
  console.error('脚本异常：', err);
  process.exit(1);
});
