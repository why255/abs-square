// ============================================================
// DeepSeek 客户端（OpenAI 兼容）
// ============================================================

import OpenAI from 'openai';

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || 'sk-placeholder',
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
});

export const CHAT_MODEL = 'deepseek-chat';

export async function chat(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const response = await deepseek.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ],
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 1024,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * 结构化提取调用：输入本轮对话，输出 JSON
 * temperature=0 以保证提取一致性
 */
export async function extractJSON<T>(
  systemPrompt: string,
  userPrompt: string
): Promise<T> {
  const response = await deepseek.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0,
    max_tokens: 2048,
    response_format: { type: 'json_object' },
  });

  const text = response.choices[0]?.message?.content || '{}';
  return JSON.parse(text) as T;
}

/**
 * 向量化文本（用于 RAG 检索）
 * 优先 DeepSeek Embedding，备选逻辑待确认后实现
 */
export async function embed(text: string): Promise<number[]> {
  // TODO: 确认 DeepSeek Embedding API 后实现
  // 当前返回空向量占位，RAG 暂用全量返回模式
  return new Array(1536).fill(0);
}
