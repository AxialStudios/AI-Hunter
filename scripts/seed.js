// scripts/seed.js — uploads images to Supabase storage and seeds the tasks table.
// Safe to run multiple times: skips any pair whose source_attribution already exists.
//
// Usage:
//   cd scripts && npm install
//   SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... node seed.js

const { createClient } = require('@supabase/supabase-js');
const fs   = require('fs');
const path = require('path');

const SUPABASE_URL             = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env vars. Run:');
  console.error('  SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... node seed.js');
  process.exit(1);
}

const supabase   = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const BUCKET     = 'task-images';
const IMAGES_DIR = path.join(__dirname, '..', 'Assets', 'seed-images');

// Difficulty spread across 15 cards:
//   easy  (≈80/20): pairs 01, 04, 06, 10, 13
//   medium(≈55/45): pairs 02, 03, 07, 09, 11
//   hard  (≈30/70): pairs 05, 08, 12, 14, 15
const TASKS = [
  {
    pair: 'pair01', real_ext: 'jpg', ai_ext: 'jpg',
    ai_model_engine:   'gpt-image-2',
    generation_prompt: 'A car alone in the parking lot at night of a store, hazy, rained earlier in the night.',
    source_attribution: 'https://unsplash.com/photos/megavalue-store-at-midnight-with-parked-car-i4Ru2xSn0hA',
    seed_real_votes: 165, seed_ai_votes: 35,
    tell_annotations: [
      { label: 'License plate',  description: 'Garbled, unreadable text on the license plate.',                          x: null, y: null, radius: null },
      { label: 'Tire metal',     description: 'Unevenness in the metal around the car\'s tires.',                        x: null, y: null, radius: null },
      { label: 'Generic signage',description: 'Fake store name "Big Mart" instead of a real brand name.',                x: null, y: null, radius: null },
    ],
  },
  {
    pair: 'pair02', real_ext: 'jpg', ai_ext: 'png',
    ai_model_engine:   'gpt-image-2',
    generation_prompt: 'Low angle on real glassy skyscrapers during the daytime.',
    source_attribution: 'https://unsplash.com/photos/modern-glass-skyscrapers-reaching-towards-a-cloudy-sky-GfKvccF9hZo',
    seed_real_votes: 120, seed_ai_votes: 100,
    tell_annotations: [
      { label: 'Window tiling',    description: 'Windows bend into each other like tiles rather than straight glass panes.', x: null, y: null, radius: null },
      { label: 'Curved lines',     description: 'Lines on the middle building that curves are not straight.',               x: null, y: null, radius: null },
      { label: 'Interior lights',  description: 'Interior office lights are inaccurate in placement and brightness.',       x: null, y: null, radius: null },
    ],
  },
  {
    pair: 'pair03', real_ext: 'jpg', ai_ext: 'jpg',
    ai_model_engine:   'gpt-image-2',
    generation_prompt: 'Side view of a glassy and brick apartment building with the architecture filling the frame.',
    source_attribution: 'https://unsplash.com/photos/modern-apartment-building-with-glass-balconies-and-brick-facade-qkoP3LPuUJE',
    seed_real_votes: 115, seed_ai_votes: 95,
    tell_annotations: [
      { label: 'Balcony plants',   description: 'Plants in the glass balconies are inaccurate and unnatural-looking.',    x: null, y: null, radius: null },
      { label: 'Glass distortion', description: 'Glass is bending and lines in the top left are not straight.',           x: null, y: null, radius: null },
    ],
  },
  {
    pair: 'pair04', real_ext: 'jpg', ai_ext: 'jpg',
    ai_model_engine:   'gpt-image-2',
    generation_prompt: 'Colorful staircase in portrait mode, realistic, daytime with sun coming from above.',
    source_attribution: 'https://unsplash.com/photos/modern-spiral-walkway-with-colorful-railing-xldNAKhPv-E',
    seed_real_votes: 155, seed_ai_votes: 45,
    tell_annotations: [
      { label: 'Corner warping',   description: 'Building begins to warp in the outer corners, top left.',               x: null, y: null, radius: null },
      { label: 'Depth of field',   description: 'Strange depth of field — some flowers in focus, others inexplicably blurred.', x: null, y: null, radius: null },
    ],
  },
  {
    pair: 'pair05', real_ext: 'jpg', ai_ext: 'jpg',
    ai_model_engine:   'gpt-image-2',
    generation_prompt: 'View of a window of a wooden cottage during the day, realistic, bright and rustic.',
    source_attribution: 'https://unsplash.com/photos/rustic-wooden-cabin-with-an-open-window-and-curtains-cXjsQEPXZfQ',
    seed_real_votes: 55, seed_ai_votes: 145,
    tell_annotations: [
      { label: 'Door shadow',      description: 'Inaccurate shadowing on the bottom right door.',                        x: null, y: null, radius: null },
      { label: 'Flower artifacts', description: 'Zooming in on the flowers reveals multiple AI-generation artifacts.',   x: null, y: null, radius: null },
    ],
  },
  {
    pair: 'pair06', real_ext: 'jpg', ai_ext: 'jpg',
    ai_model_engine:   'gemini',
    generation_prompt: 'Modern-looking office space with lots of white and beige wood. Bright.',
    source_attribution: 'https://unsplash.com/photos/modern-library-interior-with-bookshelves-and-tables-tT4Dg9AtjhU',
    seed_real_votes: 170, seed_ai_votes: 30,
    tell_annotations: [
      { label: 'Missing Apple logo', description: 'iMacs on the desks have no Apple logo — AI refuses to render real brand marks.', x: null, y: null, radius: null },
      { label: 'Chair physics',      description: 'White chairs are positioned in a way that would be physically non-functional in real life.', x: null, y: null, radius: null },
    ],
  },
  {
    pair: 'pair07', real_ext: 'jpg', ai_ext: 'jpg',
    ai_model_engine:   'gemini',
    generation_prompt: 'Black and white, slightly grainy view of two modern, beautifully architected buildings that bend.',
    source_attribution: 'https://unsplash.com/photos/black-and-white-modern-buildings-against-a-clear-sky-dH_0UwGY000',
    seed_real_votes: 130, seed_ai_votes: 90,
    tell_annotations: [
      { label: 'Tree warping',      description: 'Street tree on the left bends and warps unnaturally.',                 x: null, y: null, radius: null },
      { label: 'Uneven glass lines',description: 'Building on the left has uneven, non-parallel lines between glass panes.', x: null, y: null, radius: null },
      { label: 'Clumped leaves',    description: 'Dense tree leaves are blurred and clumped rather than distinct.',      x: null, y: null, radius: null },
    ],
  },
  {
    pair: 'pair08', real_ext: 'jpg', ai_ext: 'jpg',
    ai_model_engine:   'gemini',
    generation_prompt: 'Low-angle shot of a man working on top of scaffolding of an unfinished building, daytime, blue sky, no clouds.',
    source_attribution: 'https://unsplash.com/photos/scaffolding-structures-against-a-clear-blue-sky-3CbJkZw9dyU',
    seed_real_votes: 75, seed_ai_votes: 125,
    tell_annotations: [
      { label: 'Metal bars', description: 'Scaffolding metal bars do not remain straight along their full length.', x: null, y: null, radius: null },
    ],
  },
  {
    pair: 'pair09', real_ext: 'jpg', ai_ext: 'jpg',
    ai_model_engine:   'gemini',
    generation_prompt: 'Long shot of a busy street in Korea with a road/highway, buildings in the background, and people walking on a bridge in the foreground. Daytime.',
    source_attribution: 'https://unsplash.com/photos/city-street-with-elevated-walkway-and-buildings-IhnzaZvtnhU',
    seed_real_votes: 125, seed_ai_votes: 105,
    tell_annotations: [
      { label: 'Text / language',  description: 'Inaccurate Korean text and signage throughout the scene.',              x: null, y: null, radius: null },
      { label: 'Tree leaves',      description: 'Leaves on trees blur and clump rather than showing individual leaves.', x: null, y: null, radius: null },
      { label: 'Distant cars',     description: 'Cars in the distance become warped, merged, and indistinct.',           x: null, y: null, radius: null },
    ],
  },
  {
    pair: 'pair10', real_ext: 'jpg', ai_ext: 'jpg',
    ai_model_engine:   'gemini',
    generation_prompt: 'Bright, sunny shot looking down a rustic brick-style town with apartments on the left and trees and cars on the right.',
    source_attribution: 'https://unsplash.com/photos/sunny-street-with-traditional-brick-houses-and-a-sidewalk-FLY_LNi2L2c',
    seed_real_votes: 160, seed_ai_votes: 40,
    tell_annotations: [
      { label: 'Car logos',      description: 'Car logos and badges are inaccurate or missing.',      x: null, y: null, radius: null },
      { label: 'License plates', description: 'License plate text is illegible or nonsensical.',      x: null, y: null, radius: null },
    ],
  },
  {
    pair: 'pair11', real_ext: 'jpg', ai_ext: 'jpg',
    ai_model_engine:   'flux-1-schnell',
    generation_prompt: 'A single man wearing a hat cooking street food at night in a well-lit food truck environment.',
    source_attribution: 'https://unsplash.com/photos/cook-preparing-street-food-in-new-york-CG5YNB8zI60',
    seed_real_votes: 110, seed_ai_votes: 90,
    tell_annotations: [
      { label: 'Uncanny skin',     description: 'Uncanny, overly smooth texture on the man\'s face and ear.',           x: null, y: null, radius: null },
      { label: 'Watch distortion', description: 'The man\'s watch is warped and does not look like a real watch.',      x: null, y: null, radius: null },
    ],
  },
  {
    pair: 'pair12', real_ext: 'jpg', ai_ext: 'jpg',
    ai_model_engine:   'flux-1-schnell',
    generation_prompt: 'Green hue and neon lighting film look of an empty elevator to a subway station, street view, medium shot.',
    source_attribution: 'https://unsplash.com/photos/west-4th-street-subway-entrance-illuminated-at-night-wLUbUdT90QE',
    seed_real_votes: 60, seed_ai_votes: 140,
    tell_annotations: [
      { label: 'Unformed text', description: 'Numbers and text in the elevator are not fully formed or legible.', x: null, y: null, radius: null },
      { label: 'Metal bars',    description: 'Metal bars on each side of the elevator cut off abruptly and bend strangely.', x: null, y: null, radius: null },
    ],
  },
  {
    pair: 'pair13', real_ext: 'jpg', ai_ext: 'jpg',
    ai_model_engine:   'flux-1-schnell',
    generation_prompt: 'A very busy European street with two police officers speaking just left of center, surrounded by people and flags, tight cobblestone street. Realistic. Film look.',
    source_attribution: 'https://unsplash.com/photos/siena-police-officers-chatting-on-a-busy-street-A0hZsjQkW30',
    seed_real_votes: 175, seed_ai_votes: 25,
    tell_annotations: [
      { label: 'Crowd faces',     description: 'Faces in the crowd are warped, uncanny, and anatomically inaccurate.',   x: null, y: null, radius: null },
      { label: 'Bending buildings',description: 'Background buildings begin to bend and merge into each other.',         x: null, y: null, radius: null },
      { label: 'Officer\'s shoes', description: 'Left officer\'s shoes point in opposite directions — physically impossible stance.', x: null, y: null, radius: null },
    ],
  },
  {
    pair: 'pair14', real_ext: 'jpg', ai_ext: 'jpg',
    ai_model_engine:   'flux-1-schnell',
    generation_prompt: 'A woman with sunglasses and a dress sitting on concrete at a pier, looking into the distance, lighthouse behind her. Daytime.',
    source_attribution: 'https://unsplash.com/photos/woman-in-green-striped-dress-sitting-on-a-harbor-wall-aoinm1-wrs4',
    seed_real_votes: 85, seed_ai_votes: 115,
    tell_annotations: [
      { label: 'Smooth skin',    description: 'Ultra smooth, plastic-looking skin with no natural pores or texture variation.', x: null, y: null, radius: null },
      { label: 'Image quality',  description: 'General image quality feels artificial and over-processed.',                    x: null, y: null, radius: null },
    ],
  },
  {
    pair: 'pair15', real_ext: 'jpg', ai_ext: 'jpg',
    ai_model_engine:   'flux-1-realism',
    generation_prompt: 'Strong depth of field, blurred background, woman looking off in the distance holding her face with painted nails. High-quality realistic close-up.',
    source_attribution: 'https://unsplash.com/photos/woman-in-red-top-with-red-nails-gazing-upwards-xR1BT9AM_uc',
    seed_real_votes: 70, seed_ai_votes: 130,
    tell_annotations: [
      { label: 'Smooth skin',  description: 'Overly smooth, airbrushed skin lacking natural pores or detail.',             x: null, y: null, radius: null },
      { label: 'Nose shape',   description: 'Nose is uncanny and wrong-looking in its proportions.',                       x: null, y: null, radius: null },
      { label: 'Eyelashes',    description: 'Eyelashes start and stop inaccurately on the left eyelid.',                  x: null, y: null, radius: null },
    ],
  },
];

async function ensureBucket() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw new Error(`listBuckets failed: ${error.message}`);
  if (!buckets.some(b => b.name === BUCKET)) {
    const { error: createErr } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (createErr) throw new Error(`createBucket failed: ${createErr.message}`);
    console.log(`Created storage bucket: ${BUCKET}`);
  }
}

async function uploadImage(pair, side, ext) {
  const filename    = `${pair}_${side}.${ext}`;
  const storagePath = `${pair}/${side}.${ext}`;
  const localPath   = path.join(IMAGES_DIR, filename);

  const { data: listed } = await supabase.storage.from(BUCKET).list(pair);
  if (listed?.some(f => f.name === `${side}.${ext}`)) {
    console.log(`    ↩ already uploaded: ${storagePath}`);
  } else {
    const buffer      = fs.readFileSync(localPath);
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const { error }   = await supabase.storage.from(BUCKET).upload(storagePath, buffer, { contentType });
    if (error) throw new Error(`Upload failed for ${filename}: ${error.message}`);
    console.log(`    ✓ uploaded: ${storagePath}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

async function run() {
  console.log('Checking storage bucket...');
  await ensureBucket();

  for (const task of TASKS) {
    console.log(`\n${task.pair}...`);

    const { data: existing } = await supabase
      .from('tasks')
      .select('id')
      .eq('source_attribution', task.source_attribution)
      .maybeSingle();

    if (existing) {
      console.log('  ↩ already seeded, skipping');
      continue;
    }

    const realUrl = await uploadImage(task.pair, 'real', task.real_ext);
    const aiUrl   = await uploadImage(task.pair, 'ai',   task.ai_ext);

    const { error } = await supabase.from('tasks').insert({
      real_image_url:     realUrl,
      ai_image_url:       aiUrl,
      ai_model_engine:    task.ai_model_engine,
      generation_prompt:  task.generation_prompt,
      source_attribution: task.source_attribution,
      tell_annotations:   task.tell_annotations,
      approval_status:    'active',
      seed_real_votes:    task.seed_real_votes,
      seed_ai_votes:      task.seed_ai_votes,
    });

    if (error) {
      console.error(`  ✗ insert failed: ${error.message}`);
    } else {
      console.log(`  ✓ inserted (${task.seed_real_votes}R / ${task.seed_ai_votes}A)`);
    }
  }

  console.log('\nDone.');
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
