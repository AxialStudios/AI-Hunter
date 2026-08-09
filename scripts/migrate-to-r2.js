// scripts/migrate-to-r2.js — one-time migration from Supabase Storage to Cloudflare R2.
// Reads local seed images, converts to WebP at 800px, uploads to R2, updates DB URLs.
// Safe to re-run: skips images already uploaded to R2.
//
// Usage:
//   cd scripts && npm install
//   R2_ACCOUNT_ID=... R2_ACCESS_KEY=... R2_SECRET_KEY=... R2_PUBLIC_URL=https://pub-xxx.r2.dev \
//   SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... node migrate-to-r2.js

const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { createClient } = require('@supabase/supabase-js');
const sharp  = require('sharp');
const fs     = require('fs');
const path   = require('path');

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY;
const R2_SECRET_KEY = process.env.R2_SECRET_KEY;
const R2_BUCKET     = process.env.R2_BUCKET || 'aihunter-images';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL; // https://pub-xxx.r2.dev (no trailing slash)
const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const IMAGES_DIR = path.join(__dirname, '..', 'Assets', 'seed-images');

for (const v of ['R2_ACCOUNT_ID','R2_ACCESS_KEY','R2_SECRET_KEY','R2_PUBLIC_URL','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[v]) { console.error(`Missing env var: ${v}`); process.exit(1); }
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
});

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PAIRS = [
  { pair: 'pair01', real_ext: 'jpg', ai_ext: 'jpg',  attribution: 'https://unsplash.com/photos/megavalue-store-at-midnight-with-parked-car-i4Ru2xSn0hA' },
  { pair: 'pair02', real_ext: 'jpg', ai_ext: 'png',  attribution: 'https://unsplash.com/photos/modern-glass-skyscrapers-reaching-towards-a-cloudy-sky-GfKvccF9hZo' },
  { pair: 'pair03', real_ext: 'jpg', ai_ext: 'jpg',  attribution: 'https://unsplash.com/photos/modern-apartment-building-with-glass-balconies-and-brick-facade-qkoP3LPuUJE' },
  { pair: 'pair04', real_ext: 'jpg', ai_ext: 'jpg',  attribution: 'https://unsplash.com/photos/modern-spiral-walkway-with-colorful-railing-xldNAKhPv-E' },
  { pair: 'pair05', real_ext: 'jpg', ai_ext: 'jpg',  attribution: 'https://unsplash.com/photos/rustic-wooden-cabin-with-an-open-window-and-curtains-cXjsQEPXZfQ' },
  { pair: 'pair06', real_ext: 'jpg', ai_ext: 'jpg',  attribution: 'https://unsplash.com/photos/modern-library-interior-with-bookshelves-and-tables-tT4Dg9AtjhU' },
  { pair: 'pair07', real_ext: 'jpg', ai_ext: 'jpg',  attribution: 'https://unsplash.com/photos/black-and-white-modern-buildings-against-a-clear-sky-dH_0UwGY000' },
  { pair: 'pair08', real_ext: 'jpg', ai_ext: 'jpg',  attribution: 'https://unsplash.com/photos/scaffolding-structures-against-a-clear-blue-sky-3CbJkZw9dyU' },
  { pair: 'pair09', real_ext: 'jpg', ai_ext: 'jpg',  attribution: 'https://unsplash.com/photos/city-street-with-elevated-walkway-and-buildings-IhnzaZvtnhU' },
  { pair: 'pair10', real_ext: 'jpg', ai_ext: 'jpg',  attribution: 'https://unsplash.com/photos/sunny-street-with-traditional-brick-houses-and-a-sidewalk-FLY_LNi2L2c' },
  { pair: 'pair11', real_ext: 'jpg', ai_ext: 'jpg',  attribution: 'https://unsplash.com/photos/cook-preparing-street-food-in-new-york-CG5YNB8zI60' },
  { pair: 'pair12', real_ext: 'jpg', ai_ext: 'jpg',  attribution: 'https://unsplash.com/photos/west-4th-street-subway-entrance-illuminated-at-night-wLUbUdT90QE' },
  { pair: 'pair13', real_ext: 'jpg', ai_ext: 'jpg',  attribution: 'https://unsplash.com/photos/siena-police-officers-chatting-on-a-busy-street-A0hZsjQkW30' },
  { pair: 'pair14', real_ext: 'jpg', ai_ext: 'jpg',  attribution: 'https://unsplash.com/photos/woman-in-green-striped-dress-sitting-on-a-harbor-wall-aoinm1-wrs4' },
  { pair: 'pair15', real_ext: 'jpg', ai_ext: 'jpg',  attribution: 'https://unsplash.com/photos/woman-in-red-top-with-red-nails-gazing-upwards-xR1BT9AM_uc' },
];

async function alreadyUploaded(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function uploadWebp(localPath, key) {
  const webpBuffer = await sharp(localPath)
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: webpBuffer,
    ContentType: 'image/webp',
  }));

  return `${R2_PUBLIC_URL}/${key}`;
}

async function run() {
  console.log(`Migrating ${PAIRS.length} pairs to R2 bucket: ${R2_BUCKET}\n`);

  for (const { pair, real_ext, ai_ext, attribution } of PAIRS) {
    console.log(`${pair}...`);

    const realKey  = `${pair}/real.webp`;
    const aiKey    = `${pair}/ai.webp`;
    const realFile = path.join(IMAGES_DIR, `${pair}_real.${real_ext}`);
    const aiFile   = path.join(IMAGES_DIR, `${pair}_ai.${ai_ext}`);

    if (!fs.existsSync(realFile)) { console.error(`  ✗ missing: ${realFile}`); continue; }
    if (!fs.existsSync(aiFile))   { console.error(`  ✗ missing: ${aiFile}`);   continue; }

    let realUrl, aiUrl;

    if (await alreadyUploaded(realKey)) {
      realUrl = `${R2_PUBLIC_URL}/${realKey}`;
      console.log(`  ↩ real already in R2`);
    } else {
      realUrl = await uploadWebp(realFile, realKey);
      console.log(`  ✓ real uploaded → ${realUrl}`);
    }

    if (await alreadyUploaded(aiKey)) {
      aiUrl = `${R2_PUBLIC_URL}/${aiKey}`;
      console.log(`  ↩ ai already in R2`);
    } else {
      aiUrl = await uploadWebp(aiFile, aiKey);
      console.log(`  ✓ ai uploaded   → ${aiUrl}`);
    }

    const { error } = await supabase
      .from('tasks')
      .update({ real_image_url: realUrl, ai_image_url: aiUrl })
      .eq('source_attribution', attribution);

    if (error) {
      console.error(`  ✗ DB update failed: ${error.message}`);
    } else {
      console.log(`  ✓ DB updated`);
    }
  }

  console.log('\nMigration complete. You can now delete images from Supabase Storage.');
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
