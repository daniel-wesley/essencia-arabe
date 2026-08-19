// @ts-ignore
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ─── Database Setup ──────────────────────────────────────────────────────────
const dataDir = path.join(process.cwd(), 'data');
mkdirSync(dataDir, { recursive: true });

const backupDir = path.join(dataDir, 'backups');
mkdirSync(backupDir, { recursive: true });

const dbPath = path.join(dataDir, 'janilly.db');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// ─── Schema ──────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin','editor','viewer')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS brands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    country TEXT,
    description TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    parent_id TEXT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    sort_order INTEGER DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    brand_id TEXT,
    category_id TEXT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    sku TEXT,
    barcode TEXT,
    description TEXT,
    short_description TEXT,
    family TEXT,
    concentration TEXT,
    gender TEXT,
    country TEXT,
    occasion TEXT,
    longevity TEXT,
    projection TEXT,
    featured INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    promotional_price REAL,
    promotion_start TEXT,
    promotion_end TEXT,
    view_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS product_variants (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    size_ml INTEGER NOT NULL,
    price REAL NOT NULL DEFAULT 0,
    promotional_price REAL,
    stock INTEGER NOT NULL DEFAULT 0,
    sku TEXT,
    barcode TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS product_images (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    url TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_main INTEGER DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS product_notes (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('top','heart','base')),
    name TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS product_views (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    viewed_at TEXT DEFAULT (datetime('now')),
    ip TEXT,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    username TEXT,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    resource_id TEXT,
    details TEXT,
    ip TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS login_attempts (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    ip TEXT,
    success INTEGER NOT NULL DEFAULT 0,
    attempted_at TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Idempotent Migrations (legacy support) ──────────────────────────────────
function addColumnIfMissing(table: string, column: string, type: string) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch {
    // column already exists
  }
}

addColumnIfMissing('products', 'images', 'TEXT');
addColumnIfMissing('products', 'notes', 'TEXT');
addColumnIfMissing('products', 'variants', 'TEXT');

// ─── Password Hashing (bcrypt-like via crypto) ───────────────────────────────
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const verify = crypto.scryptSync(password, salt, 64).toString('hex');
  return verify === hash;
}

// ─── Session Management ──────────────────────────────────────────────────────
export function createSession(userId: string, ip?: string): string {
  const id = crypto.randomUUID();
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    'INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)'
  ).run(id, userId, tokenHash, expiresAt);

  logAudit(userId, 'LOGIN', 'session', id, ip);
  return token;
}

export function validateSession(token: string): { id: string; username: string; role: string } | null {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const row = db.prepare(`
    SELECT s.id, u.id as user_id, u.username, u.role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > datetime('now') AND u.active = 1
  `).get(tokenHash) as { id: string; user_id: string; username: string; role: string } | undefined;
  return row ? { id: row.user_id, username: row.username, role: row.role } : null;
}

export function destroySession(token: string): void {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export function checkRateLimit(username: string, ip?: string): { allowed: boolean; remaining: number } {
  const windowStart = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString();
  const attempts = db.prepare(`
    SELECT COUNT(*) as cnt FROM login_attempts
    WHERE username = ? AND attempted_at > ? AND success = 0
  `).get(username, windowStart) as { cnt: number };

  const failed = attempts?.cnt ?? 0;
  return {
    allowed: failed < MAX_ATTEMPTS,
    remaining: Math.max(0, MAX_ATTEMPTS - failed),
  };
}

export function recordLoginAttempt(username: string, success: boolean, ip?: string) {
  db.prepare(
    'INSERT INTO login_attempts (id, username, ip, success) VALUES (?, ?, ?, ?)'
  ).run(crypto.randomUUID(), username, ip ?? null, success ? 1 : 0);
}

// ─── Audit Log ────────────────────────────────────────────────────────────────
export function logAudit(
  userId: string | null,
  action: string,
  resource: string,
  resourceId?: string,
  ip?: string,
  details?: string,
) {
  db.prepare(
    'INSERT INTO audit_logs (id, user_id, username, action, resource, resource_id, details, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    crypto.randomUUID(),
    userId,
    null,
    action,
    resource,
    resourceId ?? null,
    details ?? null,
    ip ?? null,
  );
}

export function getAuditLogs(limit = 50) {
  return db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?').all(limit);
}

// ─── Users ────────────────────────────────────────────────────────────────────
export function createUser(username: string, password: string, role: string = 'viewer') {
  const id = crypto.randomUUID();
  const passwordHash = hashPassword(password);
  db.prepare(
    'INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(id, username, passwordHash, role);
  return { id, username, role };
}

export function authenticateUser(username: string, password: string) {
  const row = db.prepare(
    'SELECT id, username, password_hash, role FROM users WHERE username = ? AND active = 1'
  ).get(username) as { id: string; username: string; password_hash: string; role: string } | undefined;

  if (!row) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  return { id: row.id, username: row.username, role: row.role };
}

export function getUserById(id: string) {
  return db.prepare('SELECT id, username, role, active FROM users WHERE id = ?').get(id) as
    | { id: string; username: string; role: string; active: number }
    | undefined;
}

export function listUsers() {
  return db.prepare('SELECT id, username, role, active, created_at FROM users ORDER BY created_at DESC').all();
}

export function updateUserRole(id: string, role: string) {
  db.prepare('UPDATE users SET role = ?, updated_at = datetime(\'now\') WHERE id = ?').run(role, id);
}

export function updateUserActive(id: string, active: boolean) {
  db.prepare('UPDATE users SET active = ?, updated_at = datetime(\'now\') WHERE id = ?').run(active ? 1 : 0, id);
}

// ─── Brands ───────────────────────────────────────────────────────────────────
export function createBrand(data: { name: string; slug?: string; country?: string; description?: string; logoUrl?: string }) {
  const id = crypto.randomUUID();
  const slug = data.slug || slugify(data.name);
  db.prepare(
    'INSERT INTO brands (id, name, slug, country, description, logo_url) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, data.name, slug, data.country ?? null, data.description ?? null, data.logoUrl ?? null);
  return getBrand(id);
}

export function getBrand(id: string) {
  return db.prepare('SELECT * FROM brands WHERE id = ?').get(id);
}

export function listBrands() {
  return db.prepare('SELECT * FROM brands WHERE active = 1 ORDER BY name').all();
}

export function updateBrand(id: string, data: { name?: string; country?: string; description?: string; logoUrl?: string }) {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.country !== undefined) { fields.push('country = ?'); values.push(data.country); }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
  if (data.logoUrl !== undefined) { fields.push('logo_url = ?'); values.push(data.logoUrl); }
  if (fields.length === 0) return getBrand(id);
  values.push(id);
  db.prepare(`UPDATE brands SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getBrand(id);
}

export function deleteBrand(id: string) {
  return db.prepare('UPDATE brands SET active = 0 WHERE id = ?').run(id).changes > 0;
}

// ─── Categories ───────────────────────────────────────────────────────────────
export function createCategory(data: { name: string; slug?: string; parentId?: string; description?: string }) {
  const id = crypto.randomUUID();
  const slug = data.slug || slugify(data.name);
  db.prepare(
    'INSERT INTO categories (id, name, slug, parent_id, description) VALUES (?, ?, ?, ?, ?)'
  ).run(id, data.name, slug, data.parentId ?? null, data.description ?? null);
  return getCategory(id);
}

export function getCategory(id: string) {
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
}

export function listCategories() {
  return db.prepare('SELECT * FROM categories WHERE active = 1 ORDER BY sort_order, name').all();
}

export function updateCategory(id: string, data: { name?: string; description?: string }) {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
  if (fields.length === 0) return getCategory(id);
  values.push(id);
  db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getCategory(id);
}

export function deleteCategory(id: string) {
  return db.prepare('UPDATE categories SET active = 0 WHERE id = ?').run(id).changes > 0;
}

// ─── Products ─────────────────────────────────────────────────────────────────
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export interface ProductInput {
  name: string;
  brandId?: string;
  categoryId?: string;
  sku?: string;
  barcode?: string;
  description?: string;
  shortDescription?: string;
  family?: string;
  concentration?: string;
  gender?: string;
  country?: string;
  occasion?: string;
  longevity?: string;
  projection?: string;
  featured?: boolean;
  promotionalPrice?: number;
  promotionStart?: string;
  promotionEnd?: string;
  variants?: { sizeMl: number; price: number; promotionalPrice?: number; stock: number; sku?: string }[];
  images?: { url: string; isMain?: boolean }[];
  notes?: { type: 'top' | 'heart' | 'base'; name: string }[];
}

export function createProduct(data: ProductInput) {
  const id = crypto.randomUUID();
  const slug = slugify(data.name);

  db.prepare(`
    INSERT INTO products (
      id, brand_id, category_id, name, slug, sku, barcode,
      description, short_description, family, concentration, gender,
      country, occasion, longevity, projection, featured,
      promotional_price, promotion_start, promotion_end
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.brandId ?? null,
    data.categoryId ?? null,
    data.name,
    slug,
    data.sku ?? null,
    data.barcode ?? null,
    data.description ?? null,
    data.shortDescription ?? null,
    data.family ?? null,
    data.concentration ?? null,
    data.gender ?? null,
    data.country ?? null,
    data.occasion ?? null,
    data.longevity ?? null,
    data.projection ?? null,
    data.featured ? 1 : 0,
    data.promotionalPrice ?? null,
    data.promotionStart ?? null,
    data.promotionEnd ?? null,
  );

  // Insert variants
  if (data.variants && data.variants.length > 0) {
    for (const v of data.variants) {
      db.prepare(
        'INSERT INTO product_variants (id, product_id, size_ml, price, promotional_price, stock, sku) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(crypto.randomUUID(), id, v.sizeMl, v.price, v.promotionalPrice ?? null, v.stock, v.sku ?? null);
    }
  } else {
    // Default variant
    db.prepare(
      'INSERT INTO product_variants (id, product_id, size_ml, price, stock) VALUES (?, ?, 50, 0, 0)'
    ).run(crypto.randomUUID(), id);
  }

  // Insert images
  if (data.images && data.images.length > 0) {
    data.images.forEach((img, i) => {
      db.prepare(
        'INSERT INTO product_images (id, product_id, url, sort_order, is_main) VALUES (?, ?, ?, ?, ?)'
      ).run(crypto.randomUUID(), id, img.url, i, img.isMain ? 1 : i === 0 ? 1 : 0);
    });
  }

  // Insert notes
  if (data.notes && data.notes.length > 0) {
    for (const n of data.notes) {
      db.prepare(
        'INSERT INTO product_notes (id, product_id, type, name) VALUES (?, ?, ?, ?)'
      ).run(crypto.randomUUID(), id, n.type, n.name);
    }
  }

  logAudit(null, 'CREATE', 'product', id);
  return getProduct(id);
}

interface RawProductRow {
  id: string;
  name: string;
  slug: string;
  brand_id: string | null;
  category_id: string | null;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  short_description: string | null;
  family: string | null;
  concentration: string | null;
  gender: string | null;
  country: string | null;
  occasion: string | null;
  longevity: string | null;
  projection: string | null;
  featured: number;
  active: number;
  promotional_price: number | null;
  promotion_start: string | null;
  promotion_end: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
  brand_name: string | null;
  brand_slug: string | null;
  brand_logo: string | null;
  category_name: string | null;
  category_slug: string | null;
}

export interface ProductResponse {
  id: string;
  name: string;
  slug: string;
  brandId: string | null;
  categoryId: string | null;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  shortDescription: string | null;
  family: string | null;
  concentration: string | null;
  gender: string | null;
  country: string | null;
  occasion: string | null;
  longevity: string | null;
  projection: string | null;
  featured: number;
  active: number;
  promotionalPrice: number | null;
  promotionStart: string | null;
  promotionEnd: string | null;
  viewCount: number;
  created_at: string;
  updated_at: string;
  brand: string | null;
  brandSlug: string | null;
  brandLogo: string | null;
  category: string | null;
  categorySlug: string | null;
  price: number;
  stock: number;
  variants: { id: string; sizeMl: number; price: number; promotionalPrice: number | null; stock: number; sku: string | null }[];
  images: string[];
  imageObjects: { id: string; url: string; isMain: boolean }[];
  notes: { top: string[]; heart: string[]; base: string[] };
}

export function getProduct(idOrSlug: string): ProductResponse | undefined {
  const row = db.prepare(`
    SELECT p.*,
      b.name as brand_name, b.slug as brand_slug, b.logo_url as brand_logo,
      c.name as category_name, c.slug as category_slug
    FROM products p
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.id = ? OR p.slug = ?
  `).get(idOrSlug, idOrSlug) as RawProductRow | undefined;

  if (!row) return undefined;

  const variants = db.prepare(
    'SELECT * FROM product_variants WHERE product_id = ? AND active = 1 ORDER BY size_ml'
  ).all(row.id) as { id: string; size_ml: number; price: number; promotional_price: number | null; stock: number; sku: string | null }[];

  const images = db.prepare(
    'SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order'
  ).all(row.id) as { id: string; url: string; sort_order: number; is_main: number }[];

  const notes = db.prepare(
    'SELECT * FROM product_notes WHERE product_id = ?'
  ).all(row.id) as { type: string; name: string }[];

  const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
  const minPrice = variants.length > 0 ? Math.min(...variants.map(v => v.price)) : 0;

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    brandId: row.brand_id,
    categoryId: row.category_id,
    sku: row.sku,
    barcode: row.barcode,
    description: row.description,
    shortDescription: row.short_description,
    family: row.family,
    concentration: row.concentration,
    gender: row.gender,
    country: row.country,
    occasion: row.occasion,
    longevity: row.longevity,
    projection: row.projection,
    featured: row.featured,
    active: row.active,
    promotionalPrice: row.promotional_price,
    promotionStart: row.promotion_start,
    promotionEnd: row.promotion_end,
    viewCount: row.view_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
    brand: row.brand_name,
    brandSlug: row.brand_slug,
    brandLogo: row.brand_logo,
    category: row.category_name,
    categorySlug: row.category_slug,
    price: minPrice,
    stock: totalStock,
    variants: variants.map(v => ({
      id: v.id,
      sizeMl: v.size_ml,
      price: v.price,
      promotionalPrice: v.promotional_price,
      stock: v.stock,
      sku: v.sku,
    })),
    images: images.map(i => i.url),
    imageObjects: images.map(i => ({ id: i.id, url: i.url, isMain: !!i.is_main })),
    notes: groupNotes(notes),
  };
}

function groupNotes(notes: { type: string; name: string }[]) {
  const grouped: { top: string[]; heart: string[]; base: string[] } = { top: [], heart: [], base: [] };
  for (const n of notes) {
    if (n.type in grouped) grouped[n.type as keyof typeof grouped].push(n.name);
  }
  return grouped;
}

export function listProducts(options?: { featuredOnly?: boolean; categoryId?: string; brandId?: string }) {
  let query = `
    SELECT p.*,
      b.name as brand_name, b.slug as brand_slug,
      c.name as category_name, c.slug as category_slug
    FROM products p
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.active = 1
  `;
  const params: unknown[] = [];

  if (options?.featuredOnly) {
    query += ' AND p.featured = 1';
  }
  if (options?.categoryId) {
    query += ' AND p.category_id = ?';
    params.push(options.categoryId);
  }
  if (options?.brandId) {
    query += ' AND p.brand_id = ?';
    params.push(options.brandId);
  }

  query += ' ORDER BY p.created_at DESC';

  const rows = db.prepare(query).all(...params) as RawProductRow[];

  return rows.map(row => {
    const variants = db.prepare(
      'SELECT * FROM product_variants WHERE product_id = ? AND active = 1 ORDER BY size_ml'
    ).all(row.id) as { price: number; promotional_price: number | null; stock: number; size_ml: number }[];

    const images = db.prepare(
      'SELECT url FROM product_images WHERE product_id = ? ORDER BY sort_order'
    ).all(row.id) as { url: string }[];

    const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
    const minPrice = variants.length > 0 ? Math.min(...variants.map(v => v.price)) : 0;
    const minPromo = variants.length > 0
      ? Math.min(...variants.filter(v => v.promotional_price != null).map(v => v.promotional_price!))
      : null;

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      brandId: row.brand_id,
      categoryId: row.category_id,
      description: row.description,
      shortDescription: row.short_description,
      family: row.family,
      concentration: row.concentration,
      gender: row.gender,
      occasion: row.occasion,
      longevity: row.longevity,
      projection: row.projection,
      featured: row.featured,
      active: row.active,
      promotionalPrice: minPromo,
      viewCount: row.view_count,
      created_at: row.created_at,
      brand: row.brand_name,
      brandSlug: row.brand_slug,
      category: row.category_name,
      categorySlug: row.category_slug,
      price: minPrice,
      stock: totalStock,
      variants: variants.map(v => ({
        sizeMl: v.size_ml,
        price: v.price,
        promotionalPrice: v.promotional_price,
        stock: v.stock,
      })),
      images: images.map(i => i.url),
    };
  });
}

export function updateProduct(id: string, data: ProductInput) {
  const existing = getProduct(id);
  if (!existing) return undefined;

  const slug = data.name ? slugify(data.name) : existing.slug;

  db.prepare(`
    UPDATE products SET
      brand_id = ?, category_id = ?, name = ?, slug = ?, sku = ?, barcode = ?,
      description = ?, short_description = ?, family = ?, concentration = ?, gender = ?,
      country = ?, occasion = ?, longevity = ?, projection = ?, featured = ?,
      promotional_price = ?, promotion_start = ?, promotion_end = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    data.brandId ?? existing.brandId ?? null,
    data.categoryId ?? existing.categoryId ?? null,
    data.name ?? existing.name,
    slug,
    data.sku ?? existing.sku ?? null,
    data.barcode ?? existing.barcode ?? null,
    data.description ?? existing.description ?? null,
    data.shortDescription ?? existing.shortDescription ?? null,
    data.family ?? existing.family ?? null,
    data.concentration ?? existing.concentration ?? null,
    data.gender ?? existing.gender ?? null,
    data.country ?? existing.country ?? null,
    data.occasion ?? existing.occasion ?? null,
    data.longevity ?? existing.longevity ?? null,
    data.projection ?? existing.projection ?? null,
    data.featured !== undefined ? (data.featured ? 1 : 0) : existing.featured ? 1 : 0,
    data.promotionalPrice ?? existing.promotionalPrice ?? null,
    data.promotionStart ?? existing.promotionStart ?? null,
    data.promotionEnd ?? existing.promotionEnd ?? null,
    id,
  );

  // Replace variants if provided
  if (data.variants) {
    db.prepare('DELETE FROM product_variants WHERE product_id = ?').run(id);
    for (const v of data.variants) {
      db.prepare(
        'INSERT INTO product_variants (id, product_id, size_ml, price, promotional_price, stock, sku) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(crypto.randomUUID(), id, v.sizeMl, v.price, v.promotionalPrice ?? null, v.stock, v.sku ?? null);
    }
  }

  // Replace images if provided
  if (data.images) {
    db.prepare('DELETE FROM product_images WHERE product_id = ?').run(id);
    data.images.forEach((img, i) => {
      db.prepare(
        'INSERT INTO product_images (id, product_id, url, sort_order, is_main) VALUES (?, ?, ?, ?, ?)'
      ).run(crypto.randomUUID(), id, img.url, i, img.isMain ? 1 : i === 0 ? 1 : 0);
    });
  }

  // Replace notes if provided
  if (data.notes) {
    db.prepare('DELETE FROM product_notes WHERE product_id = ?').run(id);
    for (const n of data.notes) {
      db.prepare(
        'INSERT INTO product_notes (id, product_id, type, name) VALUES (?, ?, ?, ?)'
      ).run(crypto.randomUUID(), id, n.type, n.name);
    }
  }

  logAudit(null, 'UPDATE', 'product', id);
  return getProduct(id);
}

export function deleteProduct(id: string) {
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(id);
  return result.changes > 0;
}

export function incrementViewCount(productId: string, ip?: string) {
  db.prepare('UPDATE products SET view_count = view_count + 1 WHERE id = ?').run(productId);
  db.prepare(
    'INSERT INTO product_views (id, product_id, ip) VALUES (?, ?, ?)'
  ).run(crypto.randomUUID(), productId, ip ?? null);
}

export function getMostViewed(limit = 10) {
  const rows = db.prepare(`
    SELECT p.*, b.name as brand_name
    FROM products p
    LEFT JOIN brands b ON b.id = p.brand_id
    WHERE p.active = 1
    ORDER BY p.view_count DESC
    LIMIT ?
  `).all(limit) as Record<string, unknown>[];

  return rows.map(row => {
    const images = db.prepare(
      'SELECT url FROM product_images WHERE product_id = ? ORDER BY sort_order LIMIT 1'
    ).all(row.id as string) as { url: string }[];
    return {
      ...row,
      brand: row.brand_name,
      images: images.map(i => i.url),
    };
  });
}

// ─── Backup ───────────────────────────────────────────────────────────────────
export function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = path.join(backupDir, `janilly-${timestamp}.db`);
  copyFileSync(dbPath, backupPath);
  return backupPath;
}

export function getBackupInfo() {
  const files = require('fs').readdirSync(backupDir).filter((f: string) => f.endsWith('.db')).sort().reverse();
  return {
    count: files.length,
    lastBackup: files.length > 0 ? files[0] : null,
  };
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export function getDashboardStats() {
  const totalProducts = (db.prepare('SELECT COUNT(*) as cnt FROM products WHERE active = 1').get() as { cnt: number }).cnt;
  const activeProducts = totalProducts;
  const outOfStock = (db.prepare(`
    SELECT COUNT(DISTINCT p.id) as cnt FROM products p
    JOIN product_variants pv ON pv.product_id = p.id
    WHERE p.active = 1 AND pv.stock = 0 AND NOT EXISTS (
      SELECT 1 FROM product_variants pv2 WHERE pv2.product_id = p.id AND pv2.stock > 0
    )
  `).get() as { cnt: number }).cnt;

  const lowStock = (db.prepare(`
    SELECT COUNT(DISTINCT p.id) as cnt FROM products p
    JOIN product_variants pv ON pv.product_id = p.id
    WHERE p.active = 1 AND pv.stock > 0 AND pv.stock <= 5
  `).get() as { cnt: number }).cnt;

  const totalStock = (db.prepare('SELECT COALESCE(SUM(stock), 0) as total FROM product_variants').get() as { total: number }).total;

  const productsOnPromotion = (db.prepare(`
    SELECT COUNT(*) as cnt FROM products
    WHERE active = 1 AND promotional_price IS NOT NULL
    AND (promotion_start IS NULL OR promotion_start <= datetime('now'))
    AND (promotion_end IS NULL OR promotion_end >= datetime('now'))
  `).get() as { cnt: number }).cnt;

  const mostViewed = getMostViewed(5);

  return {
    totalProducts,
    activeProducts,
    outOfStock,
    lowStock,
    totalStock,
    productsOnPromotion,
    mostViewed,
  };
}

// ─── Seed ─────────────────────────────────────────────────────────────────────
function seedInitialData() {
  const userCount = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt;
  if (userCount === 0) {
    createUser('admin', 'janilly@2026', 'admin');
  }

  const brandCount = (db.prepare('SELECT COUNT(*) as cnt FROM brands').get() as { cnt: number }).cnt;
  if (brandCount === 0) {
    const arabicBrands = [
      { name: 'Lattafa', country: 'Emirados Árabes' },
      { name: 'Afnan', country: 'Emirados Árabes' },
      { name: 'Armaf', country: 'Emirados Árabes' },
      { name: 'Maison Alhambra', country: 'Emirados Árabes' },
      { name: 'Rasasi', country: 'Emirados Árabes' },
      { name: 'Ajmal', country: 'Emirados Árabes' },
      { name: 'Al Rehab', country: 'Arábia Saudita' },
      { name: 'Swiss Arabian', country: 'Emirados Árabes' },
      { name: 'Abdul Samad Al Qurashi', country: 'Arábia Saudita' },
      { name: 'Hamidi', country: 'Emirados Árabes' },
    ];
    for (const b of arabicBrands) {
      createBrand(b);
    }
  }

  const catCount = (db.prepare('SELECT COUNT(*) as cnt FROM categories').get() as { cnt: number }).cnt;
  if (catCount === 0) {
    const cats = [
      { name: 'Masculino', slug: 'masculino' },
      { name: 'Feminino', slug: 'feminino' },
      { name: 'Unissex', slug: 'unissex' },
      { name: 'Lançamentos', slug: 'lancamentos' },
      { name: 'Promoções', slug: 'promocoes' },
      { name: 'Mais Vendidos', slug: 'mais-vendidos' },
    ];
    for (const c of cats) {
      createCategory(c);
    }
  }

  const prodCount = (db.prepare('SELECT COUNT(*) as cnt FROM products').get() as { cnt: number }).cnt;
  if (prodCount === 0) {
    const brands = listBrands() as { id: string; name: string }[];
    const getBrandId = (name: string) => brands.find(b => b.name === name)?.id;

    const arabicPerfumes = [
      {
        name: 'Khamrah', brandId: getBrandId('Lattafa'), family: 'Oriental', concentration: 'EdP', gender: 'M',
        description: 'Khamrah é uma fragrância oriental intensa e envolvente. Com notas de topo de canela e noz-moscada, coração de baunilha e âmbar, e fundo de sândalo e couro, é perfeita para noites especiais.',
        shortDescription: 'Oriental intensa com baunilha e âmbar',
        occasion: 'Noite', longevity: 'Longa', projection: 'Forte',
        variants: [
          { sizeMl: 50, price: 149.90, stock: 15 },
          { sizeMl: 100, price: 229.90, stock: 10 },
        ],
        notes: [
          { type: 'top' as const, name: 'Canela' }, { type: 'top' as const, name: 'Noz-moscada' },
          { type: 'heart' as const, name: 'Baunilha' }, { type: 'heart' as const, name: 'Âmbar' },
          { type: 'base' as const, name: 'Sândalo' }, { type: 'base' as const, name: 'Couro' },
        ],
      },
      {
        name: '9PM', brandId: getBrandId('Afnan'), family: 'Oriental', concentration: 'EdP', gender: 'M',
        description: '9PM é uma fragrância moderna e viciante. Abertura doced de maçã verde e flor de laranjeira, coração de lavanda e baunilha, com fundo de âmbar e almíscar.',
        shortDescription: 'Moderna e viciante com baunilha',
        occasion: 'Noite', longevity: 'Longa', projection: 'Forte',
        variants: [
          { sizeMl: 50, price: 139.90, stock: 20 },
          { sizeMl: 100, price: 199.90, stock: 12 },
        ],
        notes: [
          { type: 'top' as const, name: 'Maçã Verde' }, { type: 'top' as const, name: 'Flor de Laranjeira' },
          { type: 'heart' as const, name: 'Lavanda' }, { type: 'heart' as const, name: 'Baunilha' },
          { type: 'base' as const, name: 'Âmbar' }, { type: 'base' as const, name: 'Almíscar' },
        ],
      },
      {
        name: 'Club de Nuit Intense', brandId: getBrandId('Armaf'), family: 'Amadeirado', concentration: 'EdP', gender: 'M',
        description: 'Inspirado em fragrâncias clássicas francesas. Abertura cítrica de limão e bergamota, coração de rosas e jasmim, com fundo de vetiver e âmbar.',
        shortDescription: 'Cítrica e elegante com rosas',
        occasion: 'Dia', longevity: 'Média', projection: 'Médio',
        variants: [
          { sizeMl: 50, price: 119.90, stock: 25 },
          { sizeMl: 100, price: 179.90, stock: 18 },
        ],
        notes: [
          { type: 'top' as const, name: 'Limão' }, { type: 'top' as const, name: 'Bergamota' },
          { type: 'heart' as const, name: 'Rosa' }, { type: 'heart' as const, name: 'Jasmim' },
          { type: 'base' as const, name: 'Vetiver' }, { type: 'base' as const, name: 'Âmbar' },
        ],
      },
      {
        name: 'L\'Aventure', brandId: getBrandId('Maison Alhambra'), family: 'Amadeirado', concentration: 'EdP', gender: 'M',
        description: 'Fragrância fresca e aventurera. Notas aquáticas de melão e pepino, com toques de pimenta e fundo de musgo e cedro.',
        shortDescription: 'Fresca e aventurera aquática',
        occasion: 'Dia', longevity: 'Média', projection: 'Médio',
        variants: [
          { sizeMl: 50, price: 109.90, stock: 15 },
          { sizeMl: 100, price: 169.90, stock: 10 },
        ],
        notes: [
          { type: 'top' as const, name: 'Melão' }, { type: 'top' as const, name: 'Pepino' },
          { type: 'heart' as const, name: 'Pimenta' }, { type: 'heart' as const, name: 'Lavanda' },
          { type: 'base' as const, name: 'Musgo' }, { type: 'base' as const, name: 'Cedro' },
        ],
      },
      {
        name: 'Oud Wild', brandId: getBrandId('Rasasi'), family: 'Oriental', concentration: 'EdP', gender: 'Unissex',
        description: 'Oud selvagem e puro. Uma experiência olfativa intensa com madeira de oud, pachouli e âmbar negro.',
        shortDescription: 'Oud selvagem e puro',
        occasion: 'Noite', longevity: 'Muito Longa', projection: 'Forte',
        variants: [
          { sizeMl: 50, price: 249.90, stock: 8 },
          { sizeMl: 100, price: 389.90, stock: 5 },
        ],
        notes: [
          { type: 'top' as const, name: 'Pimenta Rosa' }, { type: 'top' as const, name: 'Açafrão' },
          { type: 'heart' as const, name: 'Oud' }, { type: 'heart' as const, name: 'Pachouli' },
          { type: 'base' as const, name: 'Âmbar Negro' }, { type: 'base' as const, name: 'Almíscar' },
        ],
      },
      {
        name: 'Silver Blur', brandId: getBrandId('Ajmal'), family: 'Aquático', concentration: 'EdP', gender: 'M',
        description: 'Fragrância aquática moderna e sofisticada. Notas marinhas, cítricas e de madeira clara.',
        shortDescription: 'Aquática moderna e sofisticada',
        occasion: 'Dia', longevity: 'Média', projection: 'Médio',
        variants: [
          { sizeMl: 50, price: 129.90, stock: 12 },
          { sizeMl: 100, price: 189.90, stock: 8 },
        ],
        notes: [
          { type: 'top' as const, name: 'Bergamota' }, { type: 'top' as const, name: 'Água Marine' },
          { type: 'heart' as const, name: 'Lavanda' }, { type: 'heart' as const, name: 'Gerânio' },
          { type: 'base' as const, name: 'Cedro' }, { type: 'base' as const, name: 'Âmbar' },
        ],
      },
      {
        name: 'Rafa High', brandId: getBrandId('Al Rehab'), family: 'Floral', concentration: 'Parfum', gender: 'F',
        description: 'Floral delicado e envolvente. Notas de rosa, jasmim e peônia com fundo de almíscar branco.',
        shortDescription: 'Floral delicado com rosas',
        occasion: 'Dia', longevity: 'Longa', projection: 'Médio',
        variants: [
          { sizeMl: 50, price: 89.90, stock: 20 },
          { sizeMl: 100, price: 149.90, stock: 15 },
        ],
        notes: [
          { type: 'top' as const, name: 'Rosa' }, { type: 'top' as const, name: 'Peônia' },
          { type: 'heart' as const, name: 'Jasmim' }, { type: 'heart' as const, name: 'Ylang-ylang' },
          { type: 'base' as const, name: 'Almíscar Branco' }, { type: 'base' as const, name: 'Sândalo' },
        ],
      },
      {
        name: 'Haya', brandId: getBrandId('Swiss Arabian'), family: 'Oriental', concentration: 'EdP', gender: 'F',
        description: 'Oriental doce e sofisticado. Baunilha, carameloe flores brancas se misturam em uma composição luxuosa.',
        shortDescription: 'Oriental doce e sofisticado',
        occasion: 'Noite', longevity: 'Longa', projection: 'Forte',
        variants: [
          { sizeMl: 50, price: 179.90, stock: 10 },
          { sizeMl: 100, price: 269.90, stock: 6 },
        ],
        notes: [
          { type: 'top' as const, name: 'Açafrão' }, { type: 'top' as const, name: 'Damascena' },
          { type: 'heart' as const, name: 'Baunilha' }, { type: 'heart' as const, name: 'Caramelo' },
          { type: 'base' as const, name: 'Oud' }, { type: 'base' as const, name: 'Almíscar' },
        ],
      },
      {
        name: 'Al Oud', brandId: getBrandId('Abdul Samad Al Qurashi'), family: 'Oriental', concentration: 'Parfum', gender: 'M',
        description: 'Oud puro e nobre da tradição árabe. Composição intensa e duradoura para os apreciadores de fragrâncias orientais.',
        shortDescription: 'Oud puro e nobre',
        occasion: 'Noite', longevity: 'Muito Longa', projection: 'Forte',
        variants: [
          { sizeMl: 50, price: 329.90, stock: 5 },
          { sizeMl: 100, price: 499.90, stock: 3 },
        ],
        notes: [
          { type: 'top' as const, name: 'Açafrão' }, { type: 'top' as const, name: 'Cardamomo' },
          { type: 'heart' as const, name: 'Oud' }, { type: 'heart' as const, name: 'Rosa' },
          { type: 'base' as const, name: 'Sândalo' }, { type: 'base' as const, name: 'Âmbar' },
        ],
      },
      {
        name: 'Ice Drink', brandId: getBrandId('Hamidi'), family: 'Aquático', concentration: 'EdT', gender: 'M',
        description: 'Frescor gelado e refrescante. Perfeita para os dias quentes com notas de menta, cítricos e âmbar gelado.',
        shortDescription: 'Frescor gelado e refrescante',
        occasion: 'Dia', longevity: 'Média', projection: 'Médio',
        variants: [
          { sizeMl: 50, price: 79.90, stock: 30 },
          { sizeMl: 100, price: 129.90, stock: 20 },
        ],
        notes: [
          { type: 'top' as const, name: 'Menta' }, { type: 'top' as const, name: 'Limão' },
          { type: 'heart' as const, name: 'Manjericão' }, { type: 'heart' as const, name: 'Gengibre' },
          { type: 'base' as const, name: 'Âmbar Gelado' }, { type: 'base' as const, name: 'Cedro' },
        ],
      },
    ];

    for (const p of arabicPerfumes) {
      createProduct(p);
    }
  }
}

seedInitialData();

// ─── Legacy Compatibility (for backward compat with existing frontend code) ───
export function normalizeVariants(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((v): v is Record<string, unknown> => v && typeof v === 'object')
    .map((v) => ({
      sizeMl: Math.max(1, Math.round(Number(v.sizeMl) || 0)),
      price: Math.max(0, Number(v.price) || 0),
      stock: Math.max(0, Math.round(Number(v.stock) || 0)),
    }))
    .filter((v) => v.sizeMl > 0)
    .sort((a, b) => a.sizeMl - b.sizeMl);
}
