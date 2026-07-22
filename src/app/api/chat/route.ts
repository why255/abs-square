// ============================================================
// POST /api/chat — 小耕对话接口
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { processTurn } from '@/lib/engine';
import { retrieveContext } from '@/lib/rag';
import { assembleSPlan, saveSPlan } from '@/lib/s-assembler';
import { supabaseAdmin } from '@/lib/supabase';
import type { ChatRequest, Stage } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();

    if (!body.session_id || !body.message) {
      return NextResponse.json(
        { error: '缺少 session_id 或 message' },
        { status: 400 }
      );
    }

    // 处理一轮对话（engine.ts 内部完成提取→打分→决策→持久化）
    const result = await processTurn(body.session_id, body.message);

    // 如果进入 S 阶段，触发 S 组装
    if (result.stage === 'S') {
      const conv = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('session_id', body.session_id)
        .single();

      if (conv.data) {
        const profile = await supabaseAdmin
          .from('user_profiles')
          .select('*')
          .eq('conversation_id', conv.data.id)
          .single();

        if (profile.data) {
          // 检查 B1-B4 全部 sufficiency ≥ 2
          const p = profile.data;
          const allReady =
            p.b1_sufficiency >= 2 &&
            p.b2_sufficiency >= 2 &&
            p.b3_sufficiency >= 2 &&
            p.b4_sufficiency >= 2;

          if (allReady) {
            // RAG 检索
            const profileSummary = `${p.b1_content} ${p.b2_content} ${p.b3_signal}`;
            const ragContexts = await retrieveContext(profileSummary);

            // S 组装
            const plan = await assembleSPlan(p, ragContexts);
            await saveSPlan(conv.data.id, plan);

            // 小耕交付话术（保留原有回复作为过渡，追加方案包内容）
            const deliveryIntro =
              '我为你整理好了一份路线图。来，咱们一起看看——\n\n';
            const planText = formatPlanForDelivery(plan);
            result.reply = deliveryIntro + planText;

            // 标记会话完成
            await supabaseAdmin
              .from('conversations')
              .update({ stage: 'done' })
              .eq('id', conv.data.id);

            result.stage = 'done' as Stage;
          }
        }
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('/api/chat error:', error);
    return NextResponse.json(
      { error: '对话处理失败，请稍后重试' },
      { status: 500 }
    );
  }
}

/**
 * 从 SPlan JSON 渲染为小耕交付话术文本
 */
function formatPlanForDelivery(plan: {
  diagnosis: string;
  route_map: { phase: string; goal: string; duration: string }[];
  actions: { phase: string; tasks: string[] }[];
  pitfalls: string[];
  first_week: string[];
}): string {
  let text = '';

  // 诊断
  text += `${plan.diagnosis}\n\n`;

  // 路径总览
  text += `📋 **你的个人发展路线图**\n\n`;
  for (const phase of plan.route_map) {
    text += `**${phase.phase}**（${phase.duration}）\n`;
    text += `目标：${phase.goal}\n`;

    // 找对应 actions
    const act = plan.actions.find((a) => a.phase === phase.phase);
    if (act) {
      for (const task of act.tasks) {
        text += `  • ${task}\n`;
      }
    }
    text += '\n';
  }

  // 避坑指南
  if (plan.pitfalls.length > 0) {
    text += `⚠️ **避坑指南**\n`;
    for (const pit of plan.pitfalls) {
      text += `  • ${pit}\n`;
    }
    text += '\n';
  }

  // 7天启动清单
  if (plan.first_week.length > 0) {
    text += `🚀 **第一个7天，从这里开始**\n`;
    for (const item of plan.first_week) {
      text += `  • ${item}\n`;
    }
    text += '\n';
  }

  // 收口
  text += `———\n`;
  text += `这份方案已经存入你的专属档案了。30天后我会来回访，到时候咱们看看走到了哪一步。\n\n`;
  text += `你不是一个人在走这条路。有什么想聊的，随时来找我。`;

  return text;
}

// GET /api/chat?session_id=xxx — 恢复对话历史
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session_id');
  if (!sessionId) {
    return NextResponse.json({ error: '缺少 session_id' }, { status: 400 });
  }

  const { data: conv } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (!conv) {
    return NextResponse.json({ messages: [], stage: 'A', profile: null });
  }

  const { data: messages } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: true });

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('conversation_id', conv.id)
    .single();

  return NextResponse.json({
    messages: messages || [],
    stage: conv.stage,
    profile,
  });
}
