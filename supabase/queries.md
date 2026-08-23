# Image Content Navigation Queries

Paste these into Supabase → SQL Editor.

---

## Full breakdown by category / difficulty / model / status

```sql
SELECT
  COALESCE(category, 'uncategorized')  AS category,
  COALESCE(difficulty_tier, 'unset')   AS difficulty,
  ai_model_engine                      AS model,
  approval_status,
  COUNT(*)                             AS count
FROM tasks
GROUP BY category, difficulty_tier, ai_model_engine, approval_status
ORDER BY category, difficulty_tier, model;
```

---

## Progress toward targets per category

```sql
SELECT
  category,
  difficulty_tier,
  COUNT(*) FILTER (WHERE approval_status = 'active')   AS live,
  COUNT(*) FILTER (WHERE approval_status = 'pending')  AS pending,
  COUNT(*) FILTER (WHERE approval_status = 'rejected') AS rejected,
  COUNT(*)                                             AS total
FROM tasks
GROUP BY category, difficulty_tier
ORDER BY category, difficulty_tier;
```

---

## Search pairs by photographer name

```sql
SELECT id, category, difficulty_tier, source_attribution
FROM tasks
WHERE source_attribution ILIKE '%PHOTOGRAPHER NAME HERE%';
```

---

## Search pairs by scene content (prompt keyword)

```sql
SELECT id, category, difficulty_tier, generation_prompt
FROM tasks
WHERE generation_prompt ILIKE '%KEYWORD HERE%';
```

---

## Find active pairs with no tell annotations yet

```sql
SELECT id, category, real_image_url
FROM tasks
WHERE approval_status = 'active'
  AND (tell_annotations = '[]' OR tell_annotations IS NULL);
```

---

## All pending pairs (needs review)

```sql
SELECT id, category, difficulty_tier, ai_model_engine, created_at
FROM tasks
WHERE approval_status = 'pending'
ORDER BY created_at DESC;
```
