-- ============================================================
-- match_scenario_packages RPC
-- pgvector 语义检索函数（supports scenario filter）
-- 用法：SELECT * FROM match_scenario_packages(query_embedding, match_count, scenario_filter);
-- ============================================================

CREATE OR REPLACE FUNCTION match_scenario_packages (
  query_embedding VECTOR(1536),
  match_count INT DEFAULT 5,
  scenario_filter TEXT DEFAULT 'F'
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sp.id,
    sp.content,
    sp.metadata,
    1 - (sp.embedding <=> query_embedding) AS similarity
  FROM scenario_packages sp
  WHERE sp.scenario = scenario_filter
    AND sp.embedding IS NOT NULL
  ORDER BY sp.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
