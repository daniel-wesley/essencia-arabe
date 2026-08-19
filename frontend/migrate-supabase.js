const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');

const SUPABASE_URL = 'akcvmvxjkdtarpowmoim.supabase.co';
const SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrY3Ztdnhqa2R0YXJwb3dtb2ltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzE2MDk0MCwiZXhwIjoyMTAyNzM2OTQwfQ.2Ywehw39XMp9V0lchNm1Ajzk8tjYLfGhb8rC8flOmi0';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrY3Ztdnhqa2R0YXJwb3dtb2ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNjA5NDAsImV4cCI6MjEwMjczNjk0MH0.U3UywKy6_PHx9kx3AsbInrcCZj4QUcjT_c1MIelsH4U';
const SQLITE_PATH = path.join(__dirname, 'data', 'janilly.db');

function supaRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: SUPABASE_URL,
      path: `/rest/v1${path}`,
      method,
      headers: {
        'apikey': SERVICE_ROLE,
        'Authorization': `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation,resolution=merge-duplicates'
      }
    };
    const req = https.request(opts, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`${res.statusCode}: ${buf}`));
        else resolve(buf ? JSON.parse(buf) : null);
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function slugify(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function main() {
  console.log('Reading SQLite data...');
  const sqlite = new DatabaseSync(SQLITE_PATH);

  const users = sqlite.prepare('SELECT * FROM users').all();
  const brands = sqlite.prepare('SELECT * FROM brands WHERE active = 1').all();
  const categories = sqlite.prepare('SELECT * FROM categories WHERE active = 1').all();
  const products = sqlite.prepare('SELECT * FROM products').all();

  console.log(`  Users: ${users.length}, Brands: ${brands.length}, Categories: ${categories.length}, Products: ${products.length}`);

  // ─── Migrate Users ─────────────────────────────────────────────────────
  console.log('\nMigrating users...');
  for (const u of users) {
    try {
      await supaRequest('POST', '/users', [{
        id: u.id, username: u.username, password_hash: u.password_hash,
        role: u.role || 'admin', active: u.active || 1,
        created_at: u.created_at || new Date().toISOString(),
        updated_at: u.updated_at || new Date().toISOString()
      }]);
      console.log(`  ✓ ${u.username}`);
    } catch (e) { console.log(`  ✗ ${u.username}: ${e.message}`); }
  }

  // ─── Migrate Brands ────────────────────────────────────────────────────
  console.log('\nMigrating brands...');
  const brandRows = [];
  for (const b of brands) {
    brandRows.push({
      name: b.name, slug: b.slug || slugify(b.name),
      logo_url: b.logo_url || null, country: b.country || null,
      description: b.description || null, active: b.active || 1,
      created_at: b.created_at || new Date().toISOString()
    });
  }
  try {
    const result = await supaRequest('POST', '/brands', brandRows);
    console.log(`  ✓ ${brandRows.length} brands inserted`);
  } catch (e) { console.log(`  ✗ brands: ${e.message}`); }

  // Read back brand IDs
  const supaBrands = await supaRequest('GET', '/brands?select=id,name');
  const brandMap = {};
  for (const b of supaBrands) brandMap[b.name] = b.id;

  // ─── Migrate Categories ────────────────────────────────────────────────
  console.log('\nMigrating categories...');
  const catRows = [];
  for (const c of categories) {
    catRows.push({
      name: c.name, slug: c.slug || slugify(c.name),
      description: c.description || null, image_url: c.image_url || null,
      sort_order: c.sort_order || 0, active: c.active || 1
    });
  }
  try {
    await supaRequest('POST', '/categories', catRows);
    console.log(`  ✓ ${catRows.length} categories inserted`);
  } catch (e) { console.log(`  ✗ categories: ${e.message}`); }

  const supaCats = await supaRequest('GET', '/categories?select=id,name,slug');
  const catMap = {};
  for (const c of supaCats) { catMap[c.slug] = c.id; catMap[c.name.toLowerCase()] = c.id; }

  // ─── Migrate Products ──────────────────────────────────────────────────
  console.log('\nMigrating products...');
  const genderCat = { 'M': 'masculino', 'F': 'feminino', 'Unissex': 'unissex', 'unissex': 'unissex' };
  let count = 0;
  for (const p of products) {
    const brandId = brandMap[p.brand] || null;
    const catSlug = genderCat[p.gender] || genderCat[p.gender?.toLowerCase()];
    const categoryId = catSlug ? catMap[catSlug] : null;

    const productRow = {
      name: p.name, slug: p.slug || slugify(p.name),
      sku: p.sku || null, barcode: p.barcode || null,
      description: p.description || null, short_description: p.short_description || null,
      family: p.family || null, concentration: p.concentration || null,
      gender: p.gender || null, country: p.country || null,
      occasion: p.occasion || null, longevity: p.longevity || null,
      projection: p.projection || null, featured: p.featured || 0,
      active: p.active !== undefined ? p.active : 1,
      promotional_price: p.promotional_price || null,
      view_count: p.view_count || 0
    };
    if (brandId) productRow.brand_id = brandId;
    if (categoryId) productRow.category_id = categoryId;

    try {
      const result = await supaRequest('POST', '/products', [productRow]);
      const productId = result[0].id;

      // Variants
      if (p.variants) {
        try {
          const variants = JSON.parse(p.variants);
          if (Array.isArray(variants) && variants.length > 0) {
            const vRows = variants.map(v => ({
              product_id: productId, size_ml: v.sizeMl, price: v.price,
              stock: v.stock || 0, active: 1
            }));
            await supaRequest('POST', '/product_variants', vRows);
          }
        } catch (e) {}
      }

      // Images
      if (p.images) {
        try {
          const images = JSON.parse(p.images);
          if (Array.isArray(images) && images.length > 0) {
            const iRows = images.map((url, i) => ({
              product_id: productId, url, sort_order: i, is_main: i === 0 ? 1 : 0
            }));
            await supaRequest('POST', '/product_images', iRows);
          }
        } catch (e) {}
      }

      // Notes
      if (p.notes) {
        const notesText = p.notes.replace(/^Acordes:\s*/i, '');
        const noteNames = notesText.split(',').map(n => n.trim()).filter(n => n.length > 0);
        if (noteNames.length > 0) {
          const nRows = noteNames.map((name, i) => ({
            product_id: productId,
            type: i < 2 ? 'top' : i < 5 ? 'heart' : 'base',
            name
          }));
          await supaRequest('POST', '/product_notes', nRows);
        }
      }
      count++;
      console.log(`  ✓ ${p.name}`);
    } catch (e) { console.log(`  ✗ ${p.name}: ${e.message}`); }
  }
  console.log(`\n  Total: ${count}/${products.length} products migrated`);

  // ─── Create default admin user ─────────────────────────────────────────
  console.log('\nCreating default admin...');
  try {
    const scrypt = crypto.scryptSync;
    const hash = scrypt('admin', 'essencia-arabe-salt', 64).toString('hex');
    await supaRequest('POST', '/users', [{
      username: 'admin', password_hash: hash,
      role: 'admin', active: 1
    }]);
    console.log('  ✓ admin user created');
  } catch (e) { console.log(`  ✗ admin: ${e.message}`); }

  // ─── Verify ────────────────────────────────────────────────────────────
  console.log('\n=== Verification ===');
  const counts = {};
  for (const table of ['users', 'brands', 'categories', 'products', 'product_variants', 'product_images', 'product_notes']) {
    const r = await supaRequest('GET', `/${table}?select=id`);
    counts[table] = r ? r.length : 0;
  }
  console.log(counts);

  sqlite.close();
  console.log('\nMigration complete!');
}

main().catch(err => { console.error('Migration failed:', err.message); process.exit(1); });
