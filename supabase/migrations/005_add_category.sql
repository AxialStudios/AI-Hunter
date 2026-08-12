-- 005_add_category.sql
-- Adds optional category label to tasks so pairs can be filtered/bucketed
-- by subject matter (food, architecture, people, etc.).

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category TEXT;
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks (category);
