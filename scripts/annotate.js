#!/usr/bin/env node
/**
 * AI Hunter — Tell Annotator
 *
 * Runs GPT-4o Vision on AI images that have empty tell_annotations and
 * auto-populates them in Supabase. Run this on existing images, then
 * review/edit in your normal review tool.
 *
 * Usage (run from the scripts/ directory):
 *   node annotate.js
 *   node annotate.js --limit 50
 *   node annotate.js --category food --difficulty easy
 *   node annotate.js --difficulty medium
 *
 * Options:
 *   --limit N        Max images to annotate in one run (default: 200)
 *   --category X     Only annotate this category
 *   --difficulty X   Only annotate this difficulty tier
 *   --status X       Approval status to target: active|pending|all (default: active)
 */

const { createClient } = require('@supabase/supabase-js');
const OpenAI           = require('openai');
const path             = require('path');
const fs               = require('fs');

// ── Load root .env ─────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim();
  }
}

// ── CLI args ───────────────────────────────────────────────────────────────
const argv = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) {
    argv[process.argv[i].slice(2)] = process.argv[i + 1] ?? true;
    i++;
  }
}

const LIMIT      = parseInt(argv.limit ?? '200', 10);
const CATEGORY   = argv.category   ?? null;
const DIFFICULTY = argv.difficulty ?? null;
const STATUS     = argv.status     ?? 'active';

// ── Clients ────────────────────────────────────────────────────────────────
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.OPENAI_API_KEY) {
  console.error('Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Annotation prompt ──────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert at detecting AI-generated images.

The image you are analyzing IS AI-generated. Your job is to identify 1-3 specific visual tells that reveal it was made by an AI.

Rules:
- Only flag tells that are VISIBLE IN THE CENTER OR MAIN SUBJECT AREA of the image, not subtle edge artifacts or things only visible when zoomed in far
- Be specific about exactly what looks wrong
- Each tell must be something a player could reasonably notice during normal inspection
- Do not use hyphens or dashes anywhere in your output

Output ONLY a valid JSON array with this exact shape (no markdown, no extra text):
[{"title":"Short noun phrase","description":"One sentence describing the artifact, ending with a period.","location":"where in the image"}]

Rules for title: 2-3 words, title case, a noun phrase naming the artifact. No hyphens. Examples: "Eye texture", "Skin sheen", "Background blur", "Finger merging", "Label text".
Rules for description: one sentence, ends with a period, no hyphens or dashes, do not include location words like center or main subject area, specific about what is wrong.
Rules for location: one of these values only: center, upper center, lower center, upper left, upper right, lower left, lower right, left, right, foreground, background.

Good examples:
[{"title":"Finger merging","description":"An extra finger appears to merge into the palm of the hand.","location":"center"},{"title":"Label text","description":"The text on the coffee cup label is garbled and illegible.","location":"lower center"}]
[{"title":"Window reflection","description":"The window reflections repeat in a physically impossible pattern.","location":"upper center"}]
[{"title":"Skin sheen","description":"The skin on the face has an unnatural plastic sheen unlike real human skin.","location":"center"}]`;

// ── Core annotation function (exported for use in generate.js) ─────────────
async function annotateAiImage(aiImageUrl) {
  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: aiImageUrl, detail: 'low' } },
        { type: 'text', text: SYSTEM_PROMPT },
      ],
    }],
  });

  const raw = res.choices[0].message.content.trim();
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Empty or invalid response');
  return parsed.slice(0, 3).map(t => ({
    title:       String(t.title       ?? '').trim(),
    description: String(t.description ?? '').trim(),
    location:    String(t.location    ?? '').trim(),
  }));
}

module.exports = { annotateAiImage };

// ── Main (only runs when invoked directly) ─────────────────────────────────
if (require.main !== module) return;

async function run() {
  console.log('\nAI Hunter — Tell Annotator');
  console.log(`  limit:      ${LIMIT}`);
  if (CATEGORY)   console.log(`  category:   ${CATEGORY}`);
  if (DIFFICULTY) console.log(`  difficulty: ${DIFFICULTY}`);
  console.log(`  status:     ${STATUS}`);
  console.log('');

  // Fetch a batch — filter for empty tell_annotations in JS for reliability
  let query = supabase
    .from('tasks')
    .select('id, ai_image_url, category, difficulty_tier, tell_annotations')
    .order('created_at', { ascending: true })
    .limit(LIMIT * 4); // fetch extra since we filter down below

  if (STATUS !== 'all') query = query.eq('approval_status', STATUS);
  if (CATEGORY)         query = query.eq('category', CATEGORY);
  if (DIFFICULTY)       query = query.eq('difficulty_tier', DIFFICULTY);

  const { data: rows, error } = await query;
  if (error) { console.error('Supabase fetch error:', error.message); process.exit(1); }

  const toAnnotate = (rows ?? [])
    .filter(r => !r.tell_annotations || r.tell_annotations.length === 0)
    .slice(0, LIMIT);

  if (toAnnotate.length === 0) {
    console.log('Nothing to annotate — all fetched tasks already have tells.');
    return;
  }

  console.log(`Annotating ${toAnnotate.length} images...\n`);

  let succeeded = 0, failed = 0;

  for (const task of toAnnotate) {
    const tag = `[${succeeded + failed + 1}/${toAnnotate.length}]`;
    process.stdout.write(`${tag} ${task.category}/${task.difficulty_tier} ${task.id.slice(0, 8)} ... `);

    try {
      const tells = await annotateAiImage(task.ai_image_url);

      const { error: updateErr } = await supabase
        .from('tasks')
        .update({ tell_annotations: tells })
        .eq('id', task.id);

      if (updateErr) throw new Error(`Supabase: ${updateErr.message}`);

      console.log(`${tells.length} tell${tells.length > 1 ? 's' : ''}`);
      tells.forEach(t => console.log(`    · ${t.description} — ${t.location}`));
      succeeded++;
    } catch (err) {
      console.log(`FAILED: ${err.message.slice(0, 80)}`);
      failed++;
    }

    await sleep(400);
  }

  console.log(`\nDone: ${succeeded} annotated, ${failed} failed.`);
  if (failed > 0) console.log('Re-run to retry failed ones (they still have empty annotations).');
}

run().catch(err => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
