#!/usr/bin/env node
/**
 * AI Hunter — Image Generation Pipeline
 *
 * Fetches real photos from Unsplash, uses GPT-4o Vision to write a matching
 * prompt, generates an AI version with the chosen model, converts both to
 * 800×800 WebP, uploads to Cloudflare R2, and inserts as pending tasks in
 * Supabase for review before going live.
 *
 * Usage (run from the scripts/ directory):
 *   npm install
 *   node generate.js \
 *     --category "food" \
 *     --query "street food night market photography" \
 *     --count 10 \
 *     --difficulty easy \
 *     --model schnell
 *
 * Models:
 *   schnell    — Flux Schnell (fast, cheapest, most AI-looking — good for easy pairs)
 *   dev        — Flux Dev    (higher quality, slower)
 *   pro        — Flux Pro    (best Flux, costs more)
 *   dalle3     — DALL-E 3   (OpenAI, good for medium/hard)
 *   gpt-image  — GPT-Image-1 (OpenAI, highest quality)
 *
 * Required env vars (root .env or exported in shell):
 *   UNSPLASH_ACCESS_KEY      — Unsplash developer key (free at unsplash.com/developers)
 *   OPENAI_API_KEY           — OpenAI key (used for prompt generation + dalle3/gpt-image)
 *   REPLICATE_API_TOKEN      — Replicate token (required for schnell/dev/pro only)
 *   R2_ACCOUNT_ID            — Cloudflare account ID
 *   R2_ACCESS_KEY            — R2 access key ID
 *   R2_SECRET_KEY            — R2 secret access key
 *   R2_PUBLIC_URL            — Public base URL, e.g. https://pub-xxx.r2.dev
 *   R2_BUCKET                — Bucket name (default: aihunter-images)
 *   SUPABASE_URL             — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Service role key (bypasses RLS for inserts)
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { createClient }               = require('@supabase/supabase-js');
const Replicate                      = require('replicate');
const OpenAI                         = require('openai');
const sharp                          = require('sharp');
const https                          = require('https');
const http                           = require('http');
const fs                             = require('fs');
const path                           = require('path');

// ── Load root .env ────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim();
    }
  }
}

// ── Parse CLI args ─────────────────────────────────────────────────────────────
const argv = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) {
    argv[process.argv[i].slice(2)] = process.argv[i + 1] ?? true;
    i++;
  }
}

const CATEGORY   = argv.category   ?? 'general';
const QUERY      = argv.query      ?? CATEGORY;
const COUNT      = Math.max(1, parseInt(argv.count ?? '5', 10));
const DIFFICULTY = argv.difficulty ?? 'medium';
const MODEL_KEY  = argv.model      ?? 'schnell';

// ── Model registry ─────────────────────────────────────────────────────────────
const MODELS = {
  schnell:     { backend: 'replicate', id: 'black-forest-labs/flux-schnell' },
  dev:         { backend: 'replicate', id: 'black-forest-labs/flux-dev' },
  pro:         { backend: 'replicate', id: 'black-forest-labs/flux-pro' },
  dalle3:      { backend: 'openai',    id: 'dall-e-3' },
  'gpt-image': { backend: 'openai',    id: 'gpt-image-1' },
};

const MODEL = MODELS[MODEL_KEY];
if (!MODEL) {
  console.error(`Unknown model "${MODEL_KEY}". Options: ${Object.keys(MODELS).join(', ')}`);
  process.exit(1);
}

// ── Validate env ───────────────────────────────────────────────────────────────
const REQUIRED_VARS = [
  'UNSPLASH_ACCESS_KEY', 'OPENAI_API_KEY',
  'R2_ACCOUNT_ID', 'R2_ACCESS_KEY', 'R2_SECRET_KEY', 'R2_PUBLIC_URL',
  'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
];
if (MODEL.backend === 'replicate') REQUIRED_VARS.push('REPLICATE_API_TOKEN');
for (const v of REQUIRED_VARS) {
  if (!process.env[v]) { console.error(`Missing env var: ${v}`); process.exit(1); }
}

// ── Seed vote splits by difficulty (realistic-looking initial counts) ──────────
const SEEDS = {
  easy:   { real: 160, ai: 40  },
  medium: { real: 115, ai: 85  },
  hard:   { real: 75,  ai: 125 },
};
const seeds = SEEDS[DIFFICULTY] ?? SEEDS.medium;

// ── Clients ────────────────────────────────────────────────────────────────────
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const replicate = MODEL.backend === 'replicate'
  ? new Replicate({ auth: process.env.REPLICATE_API_TOKEN })
  : null;

// ── Utilities ──────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function downloadBuffer(url, hops = 0) {
  return new Promise((resolve, reject) => {
    if (hops > 5) return reject(new Error('Too many redirects'));
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadBuffer(res.headers.location, hops + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} — ${url.slice(0, 80)}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

function getJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.get(
      { hostname: parsed.hostname, path: parsed.pathname + parsed.search,
        headers: { 'User-Agent': 'ai-hunter-pipeline/1.0', ...headers } },
      res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
          catch (e) { reject(new Error('JSON parse error: ' + e.message)); }
        });
        res.on('error', reject);
      }
    );
    req.on('error', reject);
  });
}

async function toWebP(buf) {
  return sharp(buf)
    .resize(1024, 1024, { fit: 'cover', position: 'attention' })
    .resize(800, 800)
    .webp({ quality: 82 })
    .toBuffer();
}

async function uploadToR2(buf, key) {
  await s3.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET || 'aihunter-images',
    Key: key,
    Body: buf,
    ContentType: 'image/webp',
  }));
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

// ── Unsplash ───────────────────────────────────────────────────────────────────
async function searchUnsplash(query, count) {
  const perPage = Math.min(count * 2, 30);
  const url = [
    'https://api.unsplash.com/search/photos',
    `?query=${encodeURIComponent(query)}`,
    `&per_page=${perPage}`,
    '&content_filter=high',
    '&orientation=squarish',
  ].join('');
  const data = await getJSON(url, {
    Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
  });
  if (data.errors) throw new Error(`Unsplash API: ${data.errors.join(', ')}`);
  if (!data.results?.length) throw new Error(`Unsplash found no results for "${query}"`);
  return data.results.slice(0, count);
}

// ── Prompt generation ──────────────────────────────────────────────────────────
async function generatePrompt(imageUrl) {
  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 120,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
        {
          type: 'text',
          text: 'Write a 1–2 sentence prompt for an AI image generator to produce a photo similar to this one. Be specific: include the subject, setting, lighting, time of day, mood, and photographic style. Output only the prompt text, nothing else.',
        },
      ],
    }],
  });
  return res.choices[0].message.content.trim();
}

// ── AI generation ──────────────────────────────────────────────────────────────
async function generateAiImage(prompt) {
  if (MODEL.backend === 'replicate') {
    const inputs = {
      'black-forest-labs/flux-schnell': {
        prompt, aspect_ratio: '1:1', output_format: 'webp', output_quality: 90, num_outputs: 1,
      },
      'black-forest-labs/flux-dev': {
        prompt, aspect_ratio: '1:1', output_format: 'webp', output_quality: 90,
        num_outputs: 1, num_inference_steps: 28,
      },
      'black-forest-labs/flux-pro': {
        prompt, aspect_ratio: '1:1', output_format: 'webp', num_outputs: 1,
      },
    };
    const output = await replicate.run(MODEL.id, { input: inputs[MODEL.id] ?? { prompt } });
    const raw = Array.isArray(output) ? output[0] : output;
    // SDK v0.x returns a string; v1.x returns a FileOutput with .url() method
    return typeof raw?.url === 'function' ? raw.url().toString() : raw.toString();
  }

  if (MODEL.id === 'dall-e-3') {
    const res = await openai.images.generate({
      model: 'dall-e-3', prompt, n: 1, size: '1024x1024', quality: 'standard',
    });
    return res.data[0].url;
  }

  if (MODEL.id === 'gpt-image-1') {
    const res = await openai.images.generate({
      model: 'gpt-image-1', prompt, n: 1, size: '1024x1024',
    });
    return res.data[0].url;
  }

  throw new Error(`Unhandled model: ${MODEL.id}`);
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\nAI Hunter — Image Pipeline');
  console.log(`  category:   ${CATEGORY}`);
  console.log(`  query:      "${QUERY}"`);
  console.log(`  count:      ${COUNT}`);
  console.log(`  difficulty: ${DIFFICULTY}  (seed ${seeds.real}/${seeds.ai})`);
  console.log(`  model:      ${MODEL_KEY} → ${MODEL.id}\n`);

  const photos = await searchUnsplash(QUERY, COUNT);
  console.log(`  Found ${photos.length} photos on Unsplash\n`);

  let succeeded = 0, failed = 0;

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const tag = `[${i + 1}/${photos.length}]`;
    const desc = photo.alt_description ?? photo.description ?? '(no description)';
    console.log(`${tag} ${photo.id} — ${desc}`);

    try {
      process.stdout.write(`  generating prompt ...\n`);
      const prompt = await generatePrompt(photo.urls.regular);
      console.log(`  → "${prompt}"`);

      process.stdout.write(`  generating AI image (${MODEL_KEY}) ... `);
      const aiImageUrl = await generateAiImage(prompt);
      console.log('ok');

      process.stdout.write(`  downloading + converting ... `);
      const [realWebP, aiWebP] = await Promise.all([
        downloadBuffer(photo.urls.regular).then(toWebP),
        downloadBuffer(aiImageUrl).then(toWebP),
      ]);
      console.log('ok');

      const pairKey = `gen/${CATEGORY}-${Date.now()}-${i}`;
      process.stdout.write(`  uploading to R2 ... `);
      const [realUrl, aiUrl] = await Promise.all([
        uploadToR2(realWebP, `${pairKey}/real.webp`),
        uploadToR2(aiWebP,   `${pairKey}/ai.webp`),
      ]);
      console.log(`ok (${pairKey})`);

      const attribution = `${photo.links.html}?utm_source=ai_hunter&utm_medium=referral`;
      const { error: dbErr } = await supabase.from('tasks').insert({
        real_image_url:     realUrl,
        ai_image_url:       aiUrl,
        ai_model_engine:    MODEL_KEY,
        generation_prompt:  prompt,
        source_attribution: attribution,
        category:           CATEGORY,
        difficulty_tier:    DIFFICULTY,
        tell_annotations:   [],
        approval_status:    'pending',
        seed_real_votes:    seeds.real,
        seed_ai_votes:      seeds.ai,
      });
      if (dbErr) throw new Error(`Supabase insert: ${dbErr.message}`);

      console.log(`  inserted as pending\n`);
      succeeded++;
    } catch (err) {
      console.error(`  FAILED: ${err.message}\n`);
      failed++;
    }

    if (i < photos.length - 1) await sleep(800);
  }

  console.log(`Done: ${succeeded} inserted, ${failed} failed.`);
  if (succeeded > 0) {
    console.log('\nReview and approve pending pairs:');
    console.log('  open scripts/review.html in your browser\n');
  }
}

run().catch(err => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
