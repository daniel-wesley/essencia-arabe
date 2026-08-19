import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

// ─── Supabase Client ─────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://akcvmvxjkdtarpowmoim.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrY3Ztdnhqa2R0YXJwb3dtb2ltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzE2MDk0MCwiZXhwIjoyMTAyNzM2OTQwfQ.2Ywehw39XMp9V0lchNm1Ajzk8tjYLfGhb8rC8flOmi0';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

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
export async function createSession(userId: string, ip?: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from('sessions').insert({
    user_id: userId, token_hash: tokenHash, expires_at: expiresAt,
  });
  if (error) throw new Error(error.message);

  await logAudit(userId, 'LOGIN', 'session', undefined, ip);
  return token;
}

export async function validateSession(token: string): Promise<{ id: string; username: string; role: string } | null> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const { data } = await supabase
    .from('sessions')
    .select('id, user_id, users!inner(id, username, role, active)')
    .eq('token_hash', tokenHash)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (!data || !data.users || (data.users as any).active !== 1) return null;
  const u = data.users as any;
  return { id: u.id, username: u.username, role: u.role };
}

export async function destroySession(token: string): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await supabase.from('sessions').delete().eq('token_hash', tokenHash);
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function checkRateLimit(username: string): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('login_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('username', username)
    .gt('attempted_at', windowStart)
    .eq('success', false);

  const failed = count ?? 0;
  return { allowed: failed < MAX_ATTEMPTS, remaining: Math.max(0, MAX_ATTEMPTS - failed) };
}

export async function recordLoginAttempt(username: string, success: boolean, ip?: string): Promise<void> {
  await supabase.from('login_attempts').insert({
    username, ip: ip ?? null, success: success ? 1 : 0,
  });
}

// ─── Audit Log ────────────────────────────────────────────────────────────────
export async function logAudit(
  userId: string | null,
  action: string,
  resource: string,
  resourceId?: string,
  ip?: string,
  details?: string,
): Promise<void> {
  await supabase.from('audit_logs').insert({
    user_id: userId, username: null, action, resource,
    resource_id: resourceId ?? null, details: details ?? null, ip: ip ?? null,
  });
}

export async function getAuditLogs(limit = 50) {
  const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
  return data ?? [];
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function createUser(username: string, password: string, role: string = 'viewer') {
  const id = crypto.randomUUID();
  const passwordHash = hashPassword(password);
  const { data, error } = await supabase.from('users').insert({
    id, username, password_hash: passwordHash, role,
  }).select('id, username, role').single();
  if (error) throw new Error(error.message);
  return data;
}

export async function authenticateUser(username: string, password: string) {
  const { data } = await supabase
    .from('users')
    .select('id, username, password_hash, role')
    .eq('username', username)
    .eq('active', 1)
    .single();

  if (!data) return null;
  if (!verifyPassword(password, data.password_hash)) return null;
  return { id: data.id, username: data.username, role: data.role };
}

export async function getUserById(id: string) {
  const { data } = await supabase.from('users').select('id, username, role, active').eq('id', id).single();
  return data ?? undefined;
}

export async function listUsers() {
  const { data } = await supabase.from('users').select('id, username, role, active, created_at').order('created_at', { ascending: false });
  return data ?? [];
}

export async function updateUserRole(id: string, role: string) {
  await supabase.from('users').update({ role, updated_at: new Date().toISOString() }).eq('id', id);
}

export async function updateUserActive(id: string, active: boolean) {
  await supabase.from('users').update({ active: active ? 1 : 0, updated_at: new Date().toISOString() }).eq('id', id);
}

// ─── Brands ───────────────────────────────────────────────────────────────────
export async function createBrand(data: { name: string; slug?: string; country?: string; description?: string; logoUrl?: string }) {
  const slug = data.slug || slugify(data.name);
  const { data: result, error } = await supabase.from('brands').insert({
    name: data.name, slug, country: data.country ?? null,
    description: data.description ?? null, logo_url: data.logoUrl ?? null,
  }).select('*').single();
  if (error) throw new Error(error.message);
  return result;
}

export async function getBrand(id: string) {
  const { data } = await supabase.from('brands').select('*').eq('id', id).single();
  return data ?? undefined;
}

export async function listBrands() {
  const { data } = await supabase.from('brands').select('*').eq('active', 1).order('name');
  return data ?? [];
}

export async function updateBrand(id: string, data: { name?: string; country?: string; description?: string; logoUrl?: string }) {
  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.country !== undefined) update.country = data.country;
  if (data.description !== undefined) update.description = data.description;
  if (data.logoUrl !== undefined) update.logo_url = data.logoUrl;
  if (Object.keys(update).length === 0) return getBrand(id);
  await supabase.from('brands').update(update).eq('id', id);
  return getBrand(id);
}

export async function deleteBrand(id: string) {
  const { error } = await supabase.from('brands').update({ active: 0 }).eq('id', id);
  return !error;
}

// ─── Categories ───────────────────────────────────────────────────────────────
export async function createCategory(data: { name: string; slug?: string; parentId?: string; description?: string }) {
  const slug = data.slug || slugify(data.name);
  const { data: result, error } = await supabase.from('categories').insert({
    name: data.name, slug, parent_id: data.parentId ?? null, description: data.description ?? null,
  }).select('*').single();
  if (error) throw new Error(error.message);
  return result;
}

export async function getCategory(id: string) {
  const { data } = await supabase.from('categories').select('*').eq('id', id).single();
  return data ?? undefined;
}

export async function listCategories() {
  const { data } = await supabase.from('categories').select('*').eq('active', 1).order('sort_order').order('name');
  return data ?? [];
}

export async function updateCategory(id: string, data: { name?: string; description?: string }) {
  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.description !== undefined) update.description = data.description;
  if (Object.keys(update).length === 0) return getCategory(id);
  await supabase.from('categories').update(update).eq('id', id);
  return getCategory(id);
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from('categories').update({ active: 0 }).eq('id', id);
  return !error;
}

// ─── Products ─────────────────────────────────────────────────────────────────
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

async function buildProductResponse(p: any): Promise<ProductResponse> {
  const { data: variants } = await supabase.from('product_variants').select('*').eq('product_id', p.id).eq('active', 1).order('size_ml');
  const { data: images } = await supabase.from('product_images').select('*').eq('product_id', p.id).order('sort_order');
  const { data: notes } = await supabase.from('product_notes').select('*').eq('product_id', p.id);

  const vars = variants ?? [];
  const imgs = images ?? [];
  const noteRows = notes ?? [];

  const totalStock = vars.reduce((sum: number, v: any) => sum + (v.stock ?? 0), 0);
  const minPrice = vars.length > 0 ? Math.min(...vars.map((v: any) => v.price)) : 0;

  const grouped: { top: string[]; heart: string[]; base: string[] } = { top: [], heart: [], base: [] };
  for (const n of noteRows) {
    if (n.type in grouped) grouped[n.type as keyof typeof grouped].push(n.name);
  }

  return {
    id: p.id, name: p.name, slug: p.slug,
    brandId: p.brand_id, categoryId: p.category_id,
    sku: p.sku, barcode: p.barcode,
    description: p.description, shortDescription: p.short_description,
    family: p.family, concentration: p.concentration, gender: p.gender,
    country: p.country, occasion: p.occasion, longevity: p.longevity, projection: p.projection,
    featured: p.featured, active: p.active,
    promotionalPrice: p.promotional_price, promotionStart: p.promotion_start, promotionEnd: p.promotion_end,
    viewCount: p.view_count, created_at: p.created_at, updated_at: p.updated_at,
    brand: p.brand_name ?? null, brandSlug: p.brand_slug ?? null, brandLogo: p.brand_logo ?? null,
    category: p.category_name ?? null, categorySlug: p.category_slug ?? null,
    price: minPrice, stock: totalStock,
    variants: vars.map((v: any) => ({ id: v.id, sizeMl: v.size_ml, price: v.price, promotionalPrice: v.promotional_price, stock: v.stock, sku: v.sku })),
    images: imgs.map((i: any) => i.url),
    imageObjects: imgs.map((i: any) => ({ id: i.id, url: i.url, isMain: !!i.is_main })),
    notes: grouped,
  };
}

export async function getProduct(idOrSlug: string): Promise<ProductResponse | undefined> {
  const { data: p } = await supabase
    .from('products')
    .select('*')
    .or(`id.eq.${idOrSlug},slug.eq.${idOrSlug}`)
    .single();

  if (!p) return undefined;

  const { data: brand } = p.brand_id
    ? await supabase.from('brands').select('name, slug, logo_url').eq('id', p.brand_id).single()
    : { data: null };
  const { data: cat } = p.category_id
    ? await supabase.from('categories').select('name, slug').eq('id', p.category_id).single()
    : { data: null };

  const enriched: any = {
    ...p,
    brand_name: brand?.name ?? null,
    brand_slug: brand?.slug ?? null,
    brand_logo: brand?.logo_url ?? null,
    category_name: cat?.name ?? null,
    category_slug: cat?.slug ?? null,
  };
  return buildProductResponse(enriched);
}

function groupNotes(notes: { type: string; name: string }[]) {
  const grouped: { top: string[]; heart: string[]; base: string[] } = { top: [], heart: [], base: [] };
  for (const n of notes) {
    if (n.type in grouped) grouped[n.type as keyof typeof grouped].push(n.name);
  }
  return grouped;
}

export async function listProducts(options?: { featuredOnly?: boolean; categoryId?: string; brandId?: string }) {
  let query = supabase.from('products').select('*').eq('active', 1);

  if (options?.featuredOnly) query = query.eq('featured', 1);
  if (options?.categoryId) query = query.eq('category_id', options.categoryId);
  if (options?.brandId) query = query.eq('brand_id', options.brandId);

  query = query.order('created_at', { ascending: false });
  const { data: rows } = await query;
  if (!rows) return [];

  const results: any[] = [];
  for (const row of rows) {
    const { data: brand } = row.brand_id ? await supabase.from('brands').select('name, slug').eq('id', row.brand_id).single() : { data: null };
    const { data: cat } = row.category_id ? await supabase.from('categories').select('name, slug').eq('id', row.category_id).single() : { data: null };
    const { data: variants } = await supabase.from('product_variants').select('*').eq('product_id', row.id).eq('active', 1).order('size_ml');
    const { data: images } = await supabase.from('product_images').select('url').eq('product_id', row.id).order('sort_order');

    const vars = variants ?? [];
    const totalStock = vars.reduce((sum: number, v: any) => sum + (v.stock ?? 0), 0);
    const minPrice = vars.length > 0 ? Math.min(...vars.map((v: any) => v.price)) : 0;
    const minPromo = vars.length > 0
      ? Math.min(...vars.filter((v: any) => v.promotional_price != null).map((v: any) => v.promotional_price))
      : null;

    results.push({
      id: row.id, name: row.name, slug: row.slug,
      brandId: row.brand_id, categoryId: row.category_id,
      description: row.description, shortDescription: row.short_description,
      family: row.family, concentration: row.concentration,
      gender: row.gender, occasion: row.occasion, longevity: row.longevity, projection: row.projection,
      featured: row.featured, active: row.active,
      promotionalPrice: minPromo, viewCount: row.view_count,
      created_at: row.created_at,
      brand: brand?.name ?? null, brandSlug: brand?.slug ?? null,
      category: cat?.name ?? null, categorySlug: cat?.slug ?? null,
      price: minPrice, stock: totalStock,
      variants: vars.map((v: any) => ({ sizeMl: v.size_ml, price: v.price, promotionalPrice: v.promotional_price, stock: v.stock })),
      images: (images ?? []).map((i: any) => i.url),
    });
  }
  return results;
}

export async function createProduct(data: ProductInput): Promise<ProductResponse | undefined> {
  const slug = slugify(data.name);
  const { data: p, error } = await supabase.from('products').insert({
    brand_id: data.brandId ?? null, category_id: data.categoryId ?? null,
    name: data.name, slug, sku: data.sku ?? null, barcode: data.barcode ?? null,
    description: data.description ?? null, short_description: data.shortDescription ?? null,
    family: data.family ?? null, concentration: data.concentration ?? null,
    gender: data.gender ?? null, country: data.country ?? null,
    occasion: data.occasion ?? null, longevity: data.longevity ?? null, projection: data.projection ?? null,
    featured: data.featured ? 1 : 0,
    promotional_price: data.promotionalPrice ?? null,
    promotion_start: data.promotionStart ?? null, promotion_end: data.promotionEnd ?? null,
  }).select('*').single();

  if (error || !p) throw new Error(error?.message ?? 'Failed to create product');

  // Variants
  if (data.variants && data.variants.length > 0) {
    await supabase.from('product_variants').insert(
      data.variants.map(v => ({
        product_id: p.id, size_ml: v.sizeMl, price: v.price,
        promotional_price: v.promotionalPrice ?? null, stock: v.stock, sku: v.sku ?? null,
      }))
    );
  } else {
    await supabase.from('product_variants').insert({ product_id: p.id, size_ml: 50, price: 0, stock: 0 });
  }

  // Images
  if (data.images && data.images.length > 0) {
    await supabase.from('product_images').insert(
      data.images.map((img, i) => ({
        product_id: p.id, url: img.url, sort_order: i, is_main: img.isMain ? 1 : (i === 0 ? 1 : 0),
      }))
    );
  }

  // Notes
  if (data.notes && data.notes.length > 0) {
    await supabase.from('product_notes').insert(
      data.notes.map(n => ({ product_id: p.id, type: n.type, name: n.name }))
    );
  }

  await logAudit(null, 'CREATE', 'product', p.id);
  return getProduct(p.id);
}

export async function updateProduct(id: string, data: ProductInput): Promise<ProductResponse | undefined> {
  const existing = await getProduct(id);
  if (!existing) return undefined;

  const slug = data.name ? slugify(data.name) : existing.slug;
  const { error } = await supabase.from('products').update({
    brand_id: data.brandId ?? existing.brandId ?? null,
    category_id: data.categoryId ?? existing.categoryId ?? null,
    name: data.name ?? existing.name, slug,
    sku: data.sku ?? existing.sku ?? null, barcode: data.barcode ?? existing.barcode ?? null,
    description: data.description ?? existing.description ?? null,
    short_description: data.shortDescription ?? existing.shortDescription ?? null,
    family: data.family ?? existing.family ?? null,
    concentration: data.concentration ?? existing.concentration ?? null,
    gender: data.gender ?? existing.gender ?? null, country: data.country ?? existing.country ?? null,
    occasion: data.occasion ?? existing.occasion ?? null,
    longevity: data.longevity ?? existing.longevity ?? null,
    projection: data.projection ?? existing.projection ?? null,
    featured: data.featured !== undefined ? (data.featured ? 1 : 0) : existing.featured ? 1 : 0,
    promotional_price: data.promotionalPrice ?? existing.promotionalPrice ?? null,
    promotion_start: data.promotionStart ?? existing.promotionStart ?? null,
    promotion_end: data.promotionEnd ?? existing.promotionEnd ?? null,
    updated_at: new Date().toISOString(),
  }).eq('id', id);

  if (error) throw new Error(error.message);

  if (data.variants) {
    await supabase.from('product_variants').delete().eq('product_id', id);
    await supabase.from('product_variants').insert(
      data.variants.map(v => ({
        product_id: id, size_ml: v.sizeMl, price: v.price,
        promotional_price: v.promotionalPrice ?? null, stock: v.stock, sku: v.sku ?? null,
      }))
    );
  }

  if (data.images) {
    await supabase.from('product_images').delete().eq('product_id', id);
    await supabase.from('product_images').insert(
      data.images.map((img, i) => ({
        product_id: id, url: img.url, sort_order: i, is_main: img.isMain ? 1 : (i === 0 ? 1 : 0),
      }))
    );
  }

  if (data.notes) {
    await supabase.from('product_notes').delete().eq('product_id', id);
    await supabase.from('product_notes').insert(
      data.notes.map(n => ({ product_id: id, type: n.type, name: n.name }))
    );
  }

  await logAudit(null, 'UPDATE', 'product', id);
  return getProduct(id);
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from('products').delete().eq('id', id);
  return !error;
}

export async function incrementViewCount(productId: string, ip?: string) {
  // Increment view_count
  const { data: p } = await supabase.from('products').select('view_count').eq('id', productId).single();
  if (p) {
    await supabase.from('products').update({ view_count: (p.view_count ?? 0) + 1 }).eq('id', productId);
  }
  await supabase.from('product_views').insert({ product_id: productId, ip: ip ?? null });
}

export async function getMostViewed(limit = 10) {
  const { data: rows } = await supabase
    .from('products')
    .select('*')
    .eq('active', 1)
    .order('view_count', { ascending: false })
    .limit(limit);

  if (!rows) return [];

  const results = [];
  for (const row of rows) {
    const { data: brand } = row.brand_id ? await supabase.from('brands').select('name').eq('id', row.brand_id).single() : { data: null };
    const { data: images } = await supabase.from('product_images').select('url').eq('product_id', row.id).order('sort_order').limit(1);
    results.push({ ...row, brand: brand?.name ?? null, images: (images ?? []).map((i: any) => i.url) });
  }
  return results;
}

// ─── Backup ───────────────────────────────────────────────────────────────────
export async function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const { data: products } = await supabase.from('products').select('*');
  const { data: brands } = await supabase.from('brands').select('*');
  const { data: categories } = await supabase.from('categories').select('*');
  const backup = { timestamp, products: products ?? [], brands: brands ?? [], categories: categories ?? [] };
  return JSON.stringify(backup);
}

export async function getBackupInfo() {
  return { count: 0, lastBackup: 'Supabase Cloud (always available)', message: 'Dados hospedados no Supabase' };
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export async function getDashboardStats() {
  const { count: totalProducts } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('active', 1);

  const { data: allProducts } = await supabase.from('products').select('id').eq('active', 1);
  const { data: allVariants } = await supabase.from('product_variants').select('product_id, stock');
  const { data: promoProducts } = await supabase.from('products').select('id').eq('active', 1).not('promotional_price', 'is', null);

  let outOfStock = 0;
  let lowStock = 0;
  let totalStock = 0;
  const productStocks: Record<string, number> = {};

  for (const v of allVariants ?? []) {
    productStocks[v.product_id] = (productStocks[v.product_id] ?? 0) + (v.stock ?? 0);
    totalStock += v.stock ?? 0;
  }

  for (const p of allProducts ?? []) {
    const stock = productStocks[p.id] ?? 0;
    if (stock === 0) outOfStock++;
    else if (stock <= 5) lowStock++;
  }

  const mostViewed = await getMostViewed(5);

  return {
    totalProducts: totalProducts ?? 0,
    activeProducts: totalProducts ?? 0,
    outOfStock,
    lowStock,
    totalStock,
    productsOnPromotion: promoProducts?.length ?? 0,
    mostViewed,
  };
}

// ─── Seed ─────────────────────────────────────────────────────────────────────
export async function seedInitialData() {
  const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
  if ((userCount ?? 0) === 0) {
    const passwordHash = hashPassword('admin');
    await supabase.from('users').insert({ username: 'admin', password_hash: passwordHash, role: 'admin' });
  }

  const { count: brandCount } = await supabase.from('brands').select('*', { count: 'exact', head: true });
  if ((brandCount ?? 0) === 0) {
    const brands = [
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
    await supabase.from('brands').insert(brands.map(b => ({ ...b, slug: slugify(b.name) })));
  }

  const { count: catCount } = await supabase.from('categories').select('*', { count: 'exact', head: true });
  if ((catCount ?? 0) === 0) {
    const cats = [
      { name: 'Masculino', slug: 'masculino' },
      { name: 'Feminino', slug: 'feminino' },
      { name: 'Unissex', slug: 'unissex' },
      { name: 'Lançamentos', slug: 'lancamentos' },
      { name: 'Promoções', slug: 'promocoes' },
      { name: 'Mais Vendidos', slug: 'mais-vendidos' },
    ];
    await supabase.from('categories').insert(cats);
  }
}

// ─── Legacy ───────────────────────────────────────────────────────────────────
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
