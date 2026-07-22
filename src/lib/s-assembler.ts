// ============================================================
// S 组装引擎（s-assembler.ts）
// 输入：B1-B4 档案 + RAG 检索结果
// 输出：方法论文档（个人发展路线图）
// ============================================================

import { extractJSON } from './deepseek';
import { supabaseAdmin } from './supabase';
import type { SPlan, UserProfile } from '@/types';

const S_ASSEMBLY_PROMPT = `你是ABS超级广场的S方案组装专家。你的任务是根据用户的B1-B4档案和专业知识库，生成一份个人发展路线图。

# 输出结构（严格JSON）

{
  "diagnosis": "一句话诊断，格式：你的情况其实不是迷茫，是____",
  "route_map": [
    { "phase": "第一阶段名称", "goal": "阶段目标", "duration": "预计时长（如2-4周）" }
  ],
  "actions": [
    { "phase": "第一阶段名称", "tasks": ["具体任务1", "具体任务2", "具体任务3"] }
  ],
  "pitfalls": ["这条路上最常摔的坑1及应对", "坑2及应对"],
  "first_week": ["7天内可完成的≤3件小事"]
}

# 设计原则

1. 路线图必须分3个阶段，从现状（B1）到目标（B3）
2. 每阶段具体动作的颗粒度必须匹配她的时间预算（B4），不超配
3. 避坑指南要针对她的痛点类型（B2）来写——如果是"钱"的痛点，重点讲如何快速看到薪资变化信号
4. 第一个7天清单不超过3件事，每件事必须能在7天内完成
5. 所有建议必须落在她的现实约束之内（B4）

# 语气
专业笃定，有温度。像一位懂行的导师在给具体建议，不喊口号。`;

/**
 * 组装 S 方案包
 */
export async function assembleSPlan(
  profile: UserProfile,
  ragContexts: string[]
): Promise<SPlan> {
  const profileText = buildProfileText(profile);
  const ragText = ragContexts.length > 0
    ? ragContexts.map((c, i) => `【参考资料${i + 1}】\n${c}`).join('\n\n')
    : '（暂无匹配的场景包资料，请基于通用职业发展方法论生成）';

  const userPrompt = `【用户档案】\n${profileText}\n\n${ragText}\n\n请基于以上信息，生成个人发展路线图（JSON格式）。`;

  const plan = await extractJSON<SPlan>(S_ASSEMBLY_PROMPT, userPrompt);

  return plan;
}

/**
 * 持久化 S 方案包到 Supabase
 */
export async function saveSPlan(
  conversationId: string,
  plan: SPlan
): Promise<SPlan> {
  const revisitAt = new Date();
  revisitAt.setDate(revisitAt.getDate() + 30); // 30天回访

  const { data, error } = await supabaseAdmin
    .from('s_plans')
    .insert({
      conversation_id: conversationId,
      diagnosis: plan.diagnosis,
      route_map: plan.route_map,
      actions: plan.actions,
      pitfalls: plan.pitfalls,
      first_week: plan.first_week,
      revisit_at: revisitAt.toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save S plan: ${error.message}`);
  return data as SPlan;
}

function buildProfileText(profile: UserProfile): string {
  return [
    `B1-真实处境：${profile.b1_content || '未知'}`,
    `B2-真实痛点：${profile.b2_content || '未知'}（类型：${profile.b2_type || '未知'}）`,
    `B3-想要的改变：${profile.b3_signal || '未知'}（${profile.b3_measurable ? '可衡量' : '方向性'}）`,
    `B4-现实约束：时间=${profile.b4_time_per_week || '未知'}，顾虑=${profile.b4_concern || '未知'}`,
  ].join('\n');
}
