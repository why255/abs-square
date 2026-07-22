// ============================================================
// RAG 检索模块（rag.ts）
// 调用 pgvector 进行相似度检索
// D7前：占位模式，返回通用语料
// D7后：Minimax 场景包验收通过后，启用向量检索
// ============================================================

import { supabaseAdmin } from './supabase';
import { embed } from './deepseek';
import type { ScenarioPackage } from '@/types';

// 占位语料（D7前使用，Minimax交付后替换）
const PLACEHOLDER_CORPUS: ScenarioPackage[] = [
  {
    id: 'placeholder-1',
    scenario: 'F',
    module_name: 'HR职业发展常见路径',
    content: `HR职业发展常见路径：
1. 专业纵深：招聘→TD→OD，从单一模块到组织发展
2. 业务伙伴：HRBP路线，深入业务成为战略伙伴
3. 跨界转型：HR→运营/项目管理，利用沟通协调优势
4. 咨询路线：积累经验后转为HR咨询顾问
选择路径时需要结合个人优势、市场机会和时间投入综合判断。`,
    metadata: { source: 'placeholder', tags: ['职业路径', 'HR发展'] },
  },
  {
    id: 'placeholder-2',
    scenario: 'F',
    module_name: '涨薪谈判策略',
    content: `HR从业者涨薪策略：
1. 跳槽涨薪：行业平均跳槽涨幅15-25%，但需注意频率（建议≥1.5年/次）
2. 内部晋升：从专员到主管平均2-3年，需要主动争取项目主导权
3. 技能溢价：掌握数据分析、组织诊断等高价值技能可获得20%+溢价
4. 行业选择：互联网/金融HR薪资普遍高于制造业30-50%
关键不是你做了多少年，而是你能讲出什么成果故事。`,
    metadata: { source: 'placeholder', tags: ['薪资', '涨薪策略'] },
  },
  {
    id: 'placeholder-3',
    scenario: 'F',
    module_name: '应对AI焦虑',
    content: `HR面对AI替代焦虑的应对框架：
1. 区分可替代与不可替代：事务性工作（算薪、筛简历）可替代；判断力、共情力、谈判力不可替代
2. 拥抱AI工具：学会用AI提效本身就是新竞争力
3. 升级价值定位：从"做HR的"到"帮老板用好人达成目标的"
4. 具体行动：每周投入2-3小时了解AI+HR工具，3个月内能独立使用至少2款
AI替代的是任务，不是角色。但前提是你得主动升级。`,
    metadata: { source: 'placeholder', tags: ['AI焦虑', '技能升级'] },
  },
  {
    id: 'placeholder-4',
    scenario: 'F',
    module_name: '职业迷茫诊断框架',
    content: `职业迷茫的三种类型及应对：
1. 方向型迷茫：不知道往哪走 → 需要职业探索和外部信息
2. 能力型迷茫：知道想做什么但觉得自己够不着 → 需要技能差距分析和学习计划
3. 意义型迷茫：干得不错但觉得没意思 → 需要价值观梳理和职业锚定位
大多数HR的职业迷茫是混合型，建议先用排除法（最不想要什么）缩小范围，再用小步试错验证方向。`,
    metadata: { source: 'placeholder', tags: ['迷茫诊断', '职业规划'] },
  },
  {
    id: 'placeholder-5',
    scenario: 'F',
    module_name: '7天启动计划模板',
    content: `职业转型7天启动清单模板：
Day 1-2：信息收集——找3个做过你想做方向的人聊（信息面试）
Day 3-4：技能盘点——列出你现在会什么 vs 目标方向需要什么，标出差距
Day 5-6：小步验证——做一件和目标方向相关的小事（写一篇专业文章/接一个兼职项目）
Day 7：复盘决策——基于这7天的发现，确认或调整方向
核心原则：不要等想清楚再动，边动边想。`,
    metadata: { source: 'placeholder', tags: ['启动计划', '行动指南'] },
  },
];

/**
 * RAG 检索：根据用户 B1-B4 profile 检索相关场景包内容
 * D7前：返回占位语料（全量或简单关键词匹配）
 * D7后：启用 pgvector 余弦相似度检索
 */
export async function retrieveContext(
  profileSummary: string,
  topK: number = 5
): Promise<string[]> {
  try {
    // 尝试向量检索
    const queryEmbedding = await embed(profileSummary);
    const hasValidEmbedding = queryEmbedding.some((v) => v !== 0);

    if (hasValidEmbedding) {
      const { data, error } = await supabaseAdmin.rpc('match_scenario_packages', {
        query_embedding: queryEmbedding,
        match_count: topK,
        scenario_filter: 'F',
      });

      if (!error && data && data.length > 0) {
        return (data as ScenarioPackage[]).map((item) => item.content);
      }
    }
  } catch {
    // 向量检索失败，降级到占位模式
    console.warn('RAG: vector search unavailable, falling back to placeholder corpus');
  }

  // 占位模式：简单关键词筛选
  return placeholderSearch(profileSummary, topK);
}

/**
 * 占位语料的关键词匹配
 */
function placeholderSearch(query: string, topK: number): string[] {
  const keywords = query.toLowerCase();
  const scored = PLACEHOLDER_CORPUS.map((item) => {
    let score = 0;
    const content = item.content.toLowerCase();
    // 简单关键词计数匹配
    const terms = keywords.split(/[,，\s]+/).filter((t) => t.length >= 2);
    for (const term of terms) {
      if (content.includes(term)) score++;
    }
    // 标签匹配加权
    const tags = (item.metadata as Record<string, unknown>).tags as string[] || [];
    for (const tag of tags) {
      if (keywords.includes(tag.toLowerCase())) score += 2;
    }
    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((s) => s.item.content);
}
