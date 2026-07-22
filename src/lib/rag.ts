// ============================================================
// RAG 检索模块（rag.ts）
// D7 正式版：从 Supabase scenario_packages 检索 Minimax 场景包语料
// 降级路径：向量检索 → 关键词匹配 → 全量返回前 N 条
// ============================================================

import { supabaseAdmin } from './supabase';
import type { ScenarioPackage } from '@/types';

/**
 * RAG 检索：根据用户 B1-B4 profile 检索相关场景包内容
 */
export async function retrieveContext(
  profileSummary: string,
  topK: number = 5
): Promise<string[]> {
  try {
    // 尝试 pgvector 向量检索（需 embedding 列有值）
    const { data: vectorResults, error: vectorErr } = await supabaseAdmin.rpc(
      'match_scenario_packages',
      {
        query_embedding: new Array(1536).fill(0), // 占位，向量检索就绪后替换
        match_count: topK,
        scenario_filter: 'F',
      }
    );

    if (!vectorErr && vectorResults && vectorResults.length > 0) {
      return (vectorResults as ScenarioPackage[]).map((r) => r.content);
    }
  } catch {
    // 向量检索不可用，降级到关键词匹配
  }

  // 关键词匹配模式：从 Supabase 拉取语料做本地关键词计分
  return keywordSearchFromDB(profileSummary, topK);
}

/**
 * 从 Supabase 拉取全部场景 F 语料，本地关键词计分排序
 */
async function keywordSearchFromDB(
  query: string,
  topK: number
): Promise<string[]> {
  try {
    const { data: all } = await supabaseAdmin
      .from('scenario_packages')
      .select('content, metadata')
      .eq('scenario', 'F');

    if (!all || all.length === 0) return [];

    const keywords = query.toLowerCase();
    const terms = keywords.split(/[,，\s]+/).filter((t) => t.length >= 2);

    const scored = all.map((row: { content: string; metadata: Record<string, unknown> }) => {
      let score = 0;
      const content = row.content.toLowerCase();

      // 内容关键词匹配
      for (const term of terms) {
        if (content.includes(term)) score++;
        // 完全匹配加分
        const exactMatches = content.split(term).length - 1;
        score += exactMatches;
      }

      // metadata 标签匹配加权
      const meta = row.metadata || {};
      const painType = (meta.pain_type as string) || '';
      const title = (meta.title as string) || '';
      if (painType && keywords.includes(painType)) score += 5;
      if (title && keywords.includes(title)) score += 3;

      return { content: row.content, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map((s) => s.content);
  } catch {
    return [];
  }
}
