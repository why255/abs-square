// ============================================================
// 小耕对话引擎（engine.ts）
// 实现系统提示词 V1.0 的引擎运行规则：
//   提取 → 充分度判断 → 阶段决策 → 生成回复
// ============================================================

import { supabaseAdmin } from './supabase';
import { chat, extractJSON } from './deepseek';
import { buildDynamicSystemPrompt } from '@/prompts/system-prompt';
import type {
  Conversation,
  UserProfile,
  ExtractionResult,
  ChatResponse,
  ProfileUpdate,
  Stage,
} from '@/types';

// ---- 充分度及格标准（系统提示词 V1.0） ----

const SUFFICIENCY_THRESHOLDS: Record<string, string> = {
  b1: '可用一两句话向第三人复述其处境',
  b2: '用户说出了具体的、有画面的痛点事件（非大词）',
  b3: '信号可衡量（具体数字/事件/角色）',
  b4: '有明确时间量级和至少一个具体顾虑',
};

// ---- 提取用的 System Prompt ----

const EXTRACTION_PROMPT = `你是小耕对话引擎的"信息提取模块"。你的任务是从一轮对话中提取B1-B4的增量信息，并对每项做充分度打分（0/1/2）。

打分标准：
- B1（真实处境）：0=未获得 / 1=有只言片语但不完整 / 2=可用一两句话向第三人复述其处境
- B2（真实痛点）：0=未获得 / 1=停留在"焦虑/迷茫"等大词 / 2=用户说出了具体的、有画面的痛点事件
- B3（想要的改变）：0=未获得 / 1=方向性大词（"想提升""想转型"）/ 2=信号可衡量（薪资数字/具体事件/明确角色）
- B4（现实约束）：0=未获得 / 1=有方向但无量级 / 2=有明确时间量级+至少1个具体顾虑

规则：
1. 只返回JSON，不输出其他内容
2. 只更新有变化的字段，无变化则返回当前值
3. 如果用户消息是对上一轮复述的确认（"对""是的""没错""嗯嗯"），is_confirmation=true
4. B2的type取值：money/fear/lost/unseen/unknown，不确定填unknown

请严格按以下JSON Schema返回：
{
  "b1": { "content": "string", "sufficiency": 0 },
  "b2": { "type": "money|fear|lost|unseen|unknown", "content": "string", "sufficiency": 0 },
  "b3": { "signal": "string", "measurable": false, "sufficiency": 0 },
  "b4": { "time_per_week": "string", "concern": "string", "sufficiency": 0 },
  "is_confirmation": false
}`;

// ---- 核心引擎函数 ----

/**
 * 处理一轮用户消息，返回小耕的回复和状态变更
 */
export async function processTurn(
  sessionId: string,
  userMessage: string
): Promise<ChatResponse> {
  // 1. 加载或创建会话上下文
  const conv = await getOrCreateConversation(sessionId);
  const profile = await getOrCreateProfile(conv.id);
  const history = await getRecentMessages(conv.id, 20);

  // 防伪需求检测：B2 连续停留在"大词"层面（sufficiency=1）≥2轮 → 强制策略切换
  const b2StuckAtVague = detectVagueLoop(profile, history);

  // 2. 对话生成（LLM Call #1）：生成小耕的自然语言回复
  const profileSummary = buildProfileSummary(profile);
  let systemPrompt = buildDynamicSystemPrompt(conv.stage, profileSummary);

  if (b2StuckAtVague) {
    systemPrompt +=
      '\n\n【重要指令】对方已经连续几轮用大词描述感受了。这一次，你必须换一种方式——不要追问大词本身，而是问一件具体的小事："最近有没有哪个具体的瞬间，这种感觉特别强？"直接追一个画面、一个场景、一件小事。';
  }

  const reply = await chat(systemPrompt, [
    ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: userMessage },
  ]);

  // 3. 结构化提取（LLM Call #2）：从本轮对话提取B1-B4增量
  const extractInput = `【用户本轮消息】\n${userMessage}\n\n【小耕本轮回复】\n${reply}\n\n【当前已有档案】\n${JSON.stringify(profile, null, 2)}`;
  let extraction: ExtractionResult;
  try {
    extraction = await extractJSON<ExtractionResult>(EXTRACTION_PROMPT, extractInput);
  } catch {
    // 提取失败时使用现有 profile 值，不阻断对话
    extraction = {
      b1: { content: profile.b1_content || '', sufficiency: profile.b1_sufficiency },
      b2: { type: (profile.b2_type || 'unknown') as 'money' | 'fear' | 'lost' | 'unseen' | 'unknown' | '', content: profile.b2_content || '', sufficiency: profile.b2_sufficiency },
      b3: { signal: profile.b3_signal || '', measurable: profile.b3_measurable, sufficiency: profile.b3_sufficiency },
      b4: { time_per_week: profile.b4_time_per_week || '', concern: profile.b4_concern || '', sufficiency: profile.b4_sufficiency },
      is_confirmation: false,
    };
  }

  // 4. 合并 profile 更新
  const profileUpdate: ProfileUpdate = mergeProfileUpdate(profile, extraction);

  // 5. 阶段决策
  const newStage = await decideStage(conv, profile, extraction, profileUpdate);

  // 6. 持久化
  await persistTurn(conv, profile, userMessage, reply, profileUpdate, newStage);

  return {
    reply,
    stage: newStage,
    profile_update: profileUpdate,
  };
}

// ---- 会话管理 ----

async function getOrCreateConversation(sessionId: string): Promise<Conversation> {
  const { data: existing } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (existing) return existing as Conversation;

  const { data: created, error } = await supabaseAdmin
    .from('conversations')
    .insert({ session_id: sessionId })
    .select()
    .single();

  if (error) throw new Error(`Failed to create conversation: ${error.message}`);
  return created as Conversation;
}

async function getOrCreateProfile(conversationId: string): Promise<UserProfile> {
  const { data: existing } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('conversation_id', conversationId)
    .single();

  if (existing) return existing as UserProfile;

  const { data: created } = await supabaseAdmin
    .from('user_profiles')
    .insert({ conversation_id: conversationId })
    .select()
    .single();

  return (created || {
    id: '',
    conversation_id: conversationId,
    b1_content: '', b1_confirmed: false, b1_sufficiency: 0,
    b2_type: '', b2_content: '', b2_confirmed: false, b2_sufficiency: 0,
    b3_signal: '', b3_measurable: false, b3_confirmed: false, b3_sufficiency: 0,
    b4_time_per_week: '', b4_concern: '', b4_sufficiency: 0,
  }) as UserProfile;
}

async function getRecentMessages(conversationId: string, limit: number) {
  const { data } = await supabaseAdmin
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);

  return (data || []) as { role: string; content: string }[];
}

// ---- Profile 合并 ----

function mergeProfileUpdate(
  current: UserProfile,
  extracted: ExtractionResult
): ProfileUpdate {
  const update: ProfileUpdate = {};

  // B1：取 max sufficiency
  if (extracted.b1.content && extracted.b1.sufficiency >= current.b1_sufficiency) {
    update.b1_content = extracted.b1.content;
    update.b1_sufficiency = extracted.b1.sufficiency;
  }
  // B2
  if (extracted.b2.content && extracted.b2.sufficiency >= current.b2_sufficiency) {
    update.b2_type = extracted.b2.type;
    update.b2_content = extracted.b2.content;
    update.b2_sufficiency = extracted.b2.sufficiency;
  }
  // B3
  if (extracted.b3.signal && extracted.b3.sufficiency >= current.b3_sufficiency) {
    update.b3_signal = extracted.b3.signal;
    update.b3_measurable = extracted.b3.measurable;
    update.b3_sufficiency = extracted.b3.sufficiency;
  }
  // B4
  const b4Updated =
    (extracted.b4.time_per_week || extracted.b4.concern) &&
    extracted.b4.sufficiency >= current.b4_sufficiency;
  if (b4Updated) {
    if (extracted.b4.time_per_week) update.b4_time_per_week = extracted.b4.time_per_week;
    if (extracted.b4.concern) update.b4_concern = extracted.b4.concern;
    update.b4_sufficiency = extracted.b4.sufficiency;
  }

  return update;
}

// ---- 阶段决策 ----

async function decideStage(
  conv: Conversation,
  _profile: UserProfile,
  extraction: ExtractionResult,
  _update: ProfileUpdate
): Promise<Stage> {
  const currentStage = conv.stage as Stage;

  // S 阶段不切换
  if (currentStage === 'S' || currentStage === 'done') {
    return currentStage;
  }

  // A 阶段：B1+B2 都达到 2 分 → 可进入确认
  if (currentStage === 'A') {
    const b1Ready = extraction.b1.sufficiency >= 2;
    const b2Ready = extraction.b2.sufficiency >= 2;
    // 注意：确认由小耕在对话中自然引导，不在此处硬切换
    // 用户确认后 extraction.is_confirmation=true，此时切换
    if (b1Ready && b2Ready && extraction.is_confirmation) {
      return 'B';
    }
    return 'A';
  }

  // B 阶段：B3+B4 都达到 2 分 → 可进入 S
  if (currentStage === 'B') {
    const b3Ready = extraction.b3.sufficiency >= 2;
    const b4Ready = extraction.b4.sufficiency >= 2;
    if (b3Ready && b4Ready && extraction.is_confirmation) {
      return 'S';
    }
    return 'B';
  }

  return currentStage;
}

// ---- 持久化 ----

async function persistTurn(
  conv: Conversation,
  _profile: UserProfile,
  userMessage: string,
  reply: string,
  profileUpdate: ProfileUpdate,
  newStage: Stage
): Promise<void> {
  // 写入两条消息
  await supabaseAdmin.from('messages').insert([
    { conversation_id: conv.id, role: 'user', content: userMessage },
    { conversation_id: conv.id, role: 'assistant', content: reply },
  ]);

  // 更新 profile
  const hasProfileUpdate = Object.keys(profileUpdate).length > 0;
  if (hasProfileUpdate) {
    await supabaseAdmin
      .from('user_profiles')
      .update(profileUpdate)
      .eq('conversation_id', conv.id);
  }

  // 更新会话 stage 和时间
  if (newStage !== conv.stage) {
    await supabaseAdmin
      .from('conversations')
      .update({ stage: newStage, updated_at: new Date().toISOString() })
      .eq('id', conv.id);
  } else {
    await supabaseAdmin
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conv.id);
  }
}

// ---- 辅助 ----

function buildProfileSummary(profile: UserProfile): string {
  const parts: string[] = [];
  if (profile.b1_content) parts.push(`B1处境：${profile.b1_content}（充分度${profile.b1_sufficiency}/2${profile.b1_confirmed ? '，已确认' : ''}）`);
  if (profile.b2_content) parts.push(`B2痛点：${profile.b2_content}（类型${profile.b2_type}，充分度${profile.b2_sufficiency}/2${profile.b2_confirmed ? '，已确认' : ''}）`);
  if (profile.b3_signal) parts.push(`B3目标：${profile.b3_signal}（${profile.b3_measurable ? '可衡量' : '不可衡量'}，充分度${profile.b3_sufficiency}/2${profile.b3_confirmed ? '，已确认' : ''}）`);
  if (profile.b4_time_per_week || profile.b4_concern) {
    parts.push(`B4约束：时间=${profile.b4_time_per_week || '未知'}，顾虑=${profile.b4_concern || '未知'}（充分度${profile.b4_sufficiency}/2）`);
  }
  return parts.length > 0 ? parts.join('；') : '暂无信息';
}

/**
 * 防伪需求检测：B2 是否连续 ≥2 轮停留在 sufficiency=1（大词层面）
 */
function detectVagueLoop(
  profile: UserProfile,
  history: { role: string; content: string }[]
): boolean {
  // 只在 A 阶段检测，且 B2 当前 sufficiency = 1
  if (profile.b2_confirmed || profile.b2_sufficiency !== 1) return false;

  // 检查最近几轮中 B2 一直未突破到 2
  // 简化实现：如果 B2 sufficiency = 1 且已有 ≥4 条用户消息（约 2 轮），触发
  const userMessageCount = history.filter((m) => m.role === 'user').length;
  return userMessageCount >= 4;
}
