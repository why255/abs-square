// ============================================================
// ABS超级广场 · 全局类型定义
// 与 Supabase schema 和系统提示词 JSON 结构严格对齐
// ============================================================

// ---- 会话 ----
export type Stage = 'A' | 'B' | 'S' | 'done';

export interface Conversation {
  id: string;
  session_id: string;
  scenario: string;       // 'F' = 职业迷茫
  stage: Stage;
  created_at: string;
  updated_at: string;
}

// ---- 消息 ----
export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

// ---- 用户档案（B1-B4）----
export type PainType = 'money' | 'fear' | 'lost' | 'unseen' | 'unknown';

export interface B1Situation {
  content: string;
  confirmed: boolean;
  sufficiency: number;    // 0 | 1 | 2
}

export interface B2Pain {
  type: PainType | '';
  content: string;
  confirmed: boolean;
  sufficiency: number;
}

export interface B3Goal {
  signal: string;
  measurable: boolean;
  confirmed: boolean;
  sufficiency: number;
}

export interface B4Constraint {
  time_per_week: string;
  concern: string;
  sufficiency: number;
}

export interface UserProfile {
  id: string;
  conversation_id: string;
  b1_content: string;
  b1_confirmed: boolean;
  b1_sufficiency: number;
  b2_type: PainType | '';
  b2_content: string;
  b2_confirmed: boolean;
  b2_sufficiency: number;
  b3_signal: string;
  b3_measurable: boolean;
  b3_confirmed: boolean;
  b3_sufficiency: number;
  b4_time_per_week: string;
  b4_concern: string;
  b4_sufficiency: number;
}

// ---- S 方案包 ----
export interface RouteMapPhase {
  phase: string;
  goal: string;
  duration: string;
}

export interface ActionPhase {
  phase: string;
  tasks: string[];
}

export interface SPlan {
  id: string;
  conversation_id: string;
  diagnosis: string;
  route_map: RouteMapPhase[];
  actions: ActionPhase[];
  pitfalls: string[];
  first_week: string[];
  revisit_at: string;
  created_at: string;
}

// ---- RAG ----
export interface ScenarioPackage {
  id: string;
  scenario: string;
  module_name: string;
  content: string;
  metadata: Record<string, unknown>;
}

// ---- API 请求/响应 ----
export interface ChatRequest {
  session_id: string;
  message: string;
  scenario?: string;            // 'F' | 'C' — 场景标识
}

export interface ProfileUpdate {
  b1_content?: string;
  b1_sufficiency?: number;
  b2_type?: PainType | '';
  b2_content?: string;
  b2_sufficiency?: number;
  b3_signal?: string;
  b3_measurable?: boolean;
  b3_sufficiency?: number;
  b4_time_per_week?: string;
  b4_concern?: string;
  b4_sufficiency?: number;
}

export interface ChatResponse {
  reply: string;
  stage: Stage;
  profile_update?: ProfileUpdate;
  s_plan?: SPlan;              // S阶段完成时附带方案包
}

// ---- 对话引擎内部 ----
export interface ExtractionResult {
  b1: { content: string; sufficiency: number };
  b2: { type: PainType | ''; content: string; sufficiency: number };
  b3: { signal: string; measurable: boolean; sufficiency: number };
  b4: { time_per_week: string; concern: string; sufficiency: number };
  is_confirmation: boolean;   // 用户是否确认了上一轮复述
}

export type EngineAction =
  | { type: 'continue'; target_b: string; strategy_hint?: string }
  | { type: 'confirm'; summary: string }
  | { type: 'transition'; from: Stage; to: Stage }
  | { type: 'generate_s' }
  | { type: 'deliver_s'; plan: SPlan };
