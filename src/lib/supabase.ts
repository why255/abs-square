// ============================================================
// Supabase 客户端初始化
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function createLazyClient(key: string): SupabaseClient {
  if (!supabaseUrl) {
    // 构建时无环境变量，返回一个安全的空壳
    // 实际运行时 .env.local 会提供真实值
    return new Proxy({} as SupabaseClient, {
      get() {
        throw new Error('Supabase 未配置。请设置 NEXT_PUBLIC_SUPABASE_URL 环境变量。');
      },
    });
  }
  return createClient(supabaseUrl, key);
}

// 客户端（浏览器侧）
export const supabase: SupabaseClient = createLazyClient(supabaseAnonKey);

// 服务端客户端（API Routes 内使用）
export const supabaseAdmin: SupabaseClient = createLazyClient(supabaseServiceRoleKey);
