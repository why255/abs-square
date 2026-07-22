-- ============================================================
-- ABS超级广场 · Supabase 数据库 Schema
-- 版本：V1.0｜日期：2026-07-22
-- 执行方式：在 Supabase SQL Editor 中全选执行
-- ============================================================

-- 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 表1：conversations（会话）
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      TEXT NOT NULL UNIQUE,
  scenario        TEXT NOT NULL DEFAULT 'F',
  stage           TEXT NOT NULL DEFAULT 'A'
                    CHECK (stage IN ('A', 'B', 'S', 'done')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 表2：messages（消息记录）
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conv
  ON messages(conversation_id, created_at);

-- ============================================================
-- 表3：user_profiles（B1-B4 结构化档案）
-- 与 conversations 1:1 关联
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id             UUID NOT NULL UNIQUE
                                REFERENCES conversations(id) ON DELETE CASCADE,

  -- B1：真实处境
  b1_content                  TEXT,
  b1_confirmed                BOOLEAN NOT NULL DEFAULT FALSE,
  b1_sufficiency              SMALLINT NOT NULL DEFAULT 0
                                CHECK (b1_sufficiency BETWEEN 0 AND 2),

  -- B2：真实痛点
  b2_type                     TEXT,
  b2_content                  TEXT,
  b2_confirmed                BOOLEAN NOT NULL DEFAULT FALSE,
  b2_sufficiency              SMALLINT NOT NULL DEFAULT 0
                                CHECK (b2_sufficiency BETWEEN 0 AND 2),

  -- B3：想要的改变
  b3_signal                   TEXT,
  b3_measurable               BOOLEAN NOT NULL DEFAULT FALSE,
  b3_confirmed                BOOLEAN NOT NULL DEFAULT FALSE,
  b3_sufficiency              SMALLINT NOT NULL DEFAULT 0
                                CHECK (b3_sufficiency BETWEEN 0 AND 2),

  -- B4：现实约束
  b4_time_per_week            TEXT,
  b4_concern                  TEXT,
  b4_sufficiency              SMALLINT NOT NULL DEFAULT 0
                                CHECK (b4_sufficiency BETWEEN 0 AND 2),

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 表4：s_plans（S 方案包）
-- ============================================================
CREATE TABLE IF NOT EXISTS s_plans (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id             UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  diagnosis                   TEXT,
  route_map                   JSONB,
  actions                     JSONB,
  pitfalls                    JSONB,
  first_week                  JSONB,
  revisit_at                  TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 表5：scenario_packages（RAG 语料）
-- ============================================================
CREATE TABLE IF NOT EXISTS scenario_packages (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario                    TEXT NOT NULL,
  module_name                 TEXT NOT NULL,
  content                     TEXT NOT NULL,
  embedding                   VECTOR(1536),
  metadata                    JSONB,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- pgvector IVFFlat 索引
CREATE INDEX IF NOT EXISTS idx_scenario_embedding
  ON scenario_packages USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
