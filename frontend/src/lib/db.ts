import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

// ─── Supabase Client ─────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://akcvmvxjkdtarpowmoim.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrY3Ztdnhqa2R0YXJwb3dtb2ltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzE2MDk0MCwiZXhwIjoyMTAyNzM2OTQwfQ.2Ywehw39XMp9V0lchNm1Ajzk8tjYLfGhb8rC8flOmi0';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ─── In-Memory Cache ──────────────────────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttlMs: number = CACHE_TTL_MS): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

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
    .maybeSingle();

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
    .maybeSingle();

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
  invalidateCache('brands');
  return result;
}

export async function getBrand(id: string) {
  const { data } = await supabase.from('brands').select('id, name, slug, country, logo_url').eq('id', id).maybeSingle();
  return data ?? undefined;
}

export async function listBrands() {
  const cached = getCached<any[]>('brands:list');
  if (cached) return cached;

  const { data } = await supabase.from('brands').select('id, name, slug, country, logo_url').eq('active', 1).order('name');
  const result = data ?? [];
  setCache('brands:list', result);
  return result;
}

export async function updateBrand(id: string, data: { name?: string; country?: string; description?: string; logoUrl?: string }) {
  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.country !== undefined) update.country = data.country;
  if (data.description !== undefined) update.description = data.description;
  if (data.logoUrl !== undefined) update.logo_url = data.logoUrl;
  if (Object.keys(update).length === 0) return getBrand(id);
  await supabase.from('brands').update(update).eq('id', id);
  invalidateCache('brands');
  return getBrand(id);
}

export async function deleteBrand(id: string) {
  const { error } = await supabase.from('brands').update({ active: 0 }).eq('id', id);
  invalidateCache('brands');
  return !error;
}

// ─── Categories ───────────────────────────────────────────────────────────────
export async function createCategory(data: { name: string; slug?: string; parentId?: string; description?: string }) {
  const slug = data.slug || slugify(data.name);
  const { data: result, error } = await supabase.from('categories').insert({
    name: data.name, slug, parent_id: data.parentId ?? null, description: data.description ?? null,
  }).select('*').single();
  if (error) throw new Error(error.message);
  invalidateCache('categories');
  return result;
}

export async function getCategory(id: string) {
  const { data } = await supabase.from('categories').select('id, name, slug, parent_id, description, sort_order').eq('id', id).maybeSingle();
  return data ?? undefined;
}

export async function listCategories() {
  const cached = getCached<any[]>('categories:list');
  if (cached) return cached;

  const { data } = await supabase.from('categories').select('id, name, slug, parent_id, description, sort_order').eq('active', 1).order('sort_order').order('name');
  const result = data ?? [];
  setCache('categories:list', result);
  return result;
}

export async function updateCategory(id: string, data: { name?: string; description?: string }) {
  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.description !== undefined) update.description = data.description;
  if (Object.keys(update).length === 0) return getCategory(id);
  await supabase.from('categories').update(update).eq('id', id);
  invalidateCache('categories');
  return getCategory(id);
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from('categories').update({ active: 0 }).eq('id', id);
  invalidateCache('categories');
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
  const [variantsResult, imagesResult, notesResult] = await Promise.all([
    supabase.from('product_variants').select('id, product_id, size_ml, price, promotional_price, stock, sku').eq('product_id', p.id).eq('active', 1).order('size_ml'),
    supabase.from('product_images').select('id, product_id, url, is_main, sort_order').eq('product_id', p.id).order('sort_order'),
    supabase.from('product_notes').select('type, name').eq('product_id', p.id),
  ]);

  const vars = variantsResult.data ?? [];
  const imgs = imagesResult.data ?? [];
  const noteRows = notesResult.data ?? [];

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
  // Tenta buscar por slug e id em paralelo (reduz de 2 queries sequenciais para 1 roundtrip)
  const [slugResult, idResult] = await Promise.all([
    supabase.from('products').select('*').eq('slug', idOrSlug).eq('active', 1).maybeSingle(),
    supabase.from('products').select('*').eq('id', idOrSlug).eq('active', 1).maybeSingle(),
  ]);

  const p = slugResult.data ?? idResult.data;
  if (!p) return undefined;

  // Usar cache de brands/categories ao invés de queries individuais
  const [brands, categories] = await Promise.all([
    listBrands(),
    listCategories(),
  ]);

  const brand = p.brand_id ? brands.find((b: any) => b.id === p.brand_id) : null;
  const cat = p.category_id ? categories.find((c: any) => c.id === p.category_id) : null;

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

const LIST_COLUMNS = 'id, name, slug, brand_id, category_id, family, concentration, gender, occasion, featured, promotional_price, view_count, created_at';
const VARIANT_COLUMNS = 'product_id, size_ml, price, promotional_price, stock';

export async function listProducts(options?: { featuredOnly?: boolean; categoryId?: string; brandId?: string; search?: string; page?: number; limit?: number }) {
  let query = supabase.from('products').select(LIST_COLUMNS).eq('active', 1);

  if (options?.featuredOnly) query = query.eq('featured', 1);
  if (options?.categoryId) query = query.eq('category_id', options.categoryId);
  if (options?.brandId) query = query.eq('brand_id', options.brandId);
  if (options?.search) {
    const term = `%${options.search}%`;
    query = query.or(`name.ilike.${term},slug.ilike.${term}`);
  }

  query = query.order('created_at', { ascending: false });

  const page = options?.page ?? 1;
  const limit = options?.limit ?? 100;
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data: rows } = await query;
  if (!rows || rows.length === 0) return [];

  const productIds = rows.map((r: any) => r.id);
  const brandIds = [...new Set(rows.map((r: any) => r.brand_id).filter(Boolean))];
  const categoryIds = [...new Set(rows.map((r: any) => r.category_id).filter(Boolean))];

  // Usar cache para brands e categories ao invés de queries separadas
  const [allBrands, allCategories, variantsResult, imagesResult] = await Promise.all([
    listBrands(),
    listCategories(),
    supabase.from('product_variants').select(VARIANT_COLUMNS).in('product_id', productIds).eq('active', 1).order('size_ml'),
    supabase.from('product_images').select('product_id, url').in('product_id', productIds).eq('is_main', 1),
  ]);

  const brandMap = new Map<string, any>(allBrands.map((b: any) => [b.id, b]));
  const catMap = new Map<string, any>(allCategories.map((c: any) => [c.id, c]));

  const variantsByProduct = new Map<string, any[]>();
  for (const v of variantsResult.data ?? []) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list.push(v);
    variantsByProduct.set(v.product_id, list);
  }

  const mainImageByProduct = new Map<string, string>();
  for (const i of imagesResult.data ?? []) {
    if (!mainImageByProduct.has(i.product_id)) mainImageByProduct.set(i.product_id, i.url);
  }

  return rows.map((row: any) => {
    const brand = row.brand_id ? brandMap.get(row.brand_id) ?? null : null;
    const cat = row.category_id ? catMap.get(row.category_id) ?? null : null;
    const vars = variantsByProduct.get(row.id) ?? [];

    const totalStock = vars.reduce((sum: number, v: any) => sum + (v.stock ?? 0), 0);
    const minPrice = vars.length > 0 ? Math.min(...vars.map((v: any) => v.price)) : 0;
    const promoPrices = vars.filter((v: any) => v.promotional_price != null).map((v: any) => v.promotional_price);
    const minPromo = promoPrices.length > 0 ? Math.min(...promoPrices) : null;

    return {
      id: row.id, name: row.name, slug: row.slug,
      brandId: row.brand_id, categoryId: row.category_id,
      family: row.family, concentration: row.concentration,
      gender: row.gender, occasion: row.occasion,
      featured: row.featured,
      promotionalPrice: minPromo, viewCount: row.view_count,
      created_at: row.created_at,
      brand: brand?.name ?? null, brandSlug: brand?.slug ?? null,
      category: cat?.name ?? null, categorySlug: cat?.slug ?? null,
      price: minPrice, stock: totalStock,
      variants: vars.map((v: any) => ({ sizeMl: v.size_ml, price: v.price, promotionalPrice: v.promotional_price, stock: v.stock })),
      images: mainImageByProduct.has(row.id) ? [mainImageByProduct.get(row.id)!] : [],
    };
  });
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
  // Buscar apenas os dados básicos do produto (1 query leve em vez de getProduct com 5-6 queries)
  const { data: existing } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
  if (!existing) return undefined;

  const slug = data.name ? slugify(data.name) : existing.slug;
  const { error } = await supabase.from('products').update({
    brand_id: data.brandId ?? existing.brand_id ?? null,
    category_id: data.categoryId ?? existing.category_id ?? null,
    name: data.name ?? existing.name, slug,
    sku: data.sku ?? existing.sku ?? null, barcode: data.barcode ?? existing.barcode ?? null,
    description: data.description ?? existing.description ?? null,
    short_description: data.shortDescription ?? existing.short_description ?? null,
    family: data.family ?? existing.family ?? null,
    concentration: data.concentration ?? existing.concentration ?? null,
    gender: data.gender ?? existing.gender ?? null, country: data.country ?? existing.country ?? null,
    occasion: data.occasion ?? existing.occasion ?? null,
    longevity: data.longevity ?? existing.longevity ?? null,
    projection: data.projection ?? existing.projection ?? null,
    featured: data.featured !== undefined ? (data.featured ? 1 : 0) : existing.featured ? 1 : 0,
    promotional_price: data.promotionalPrice ?? existing.promotional_price ?? null,
    promotion_start: data.promotionStart ?? existing.promotion_start ?? null,
    promotion_end: data.promotionEnd ?? existing.promotion_end ?? null,
    updated_at: new Date().toISOString(),
  }).eq('id', id);

  if (error) throw new Error(error.message);

  // Executar deletes + inserts em paralelo quando possível
  const parallelOps: PromiseLike<any>[] = [];

  if (data.variants) {
    parallelOps.push(
      supabase.from('product_variants').delete().eq('product_id', id).then(() =>
        supabase.from('product_variants').insert(
          data.variants!.map(v => ({
            product_id: id, size_ml: v.sizeMl, price: v.price,
            promotional_price: v.promotionalPrice ?? null, stock: v.stock, sku: v.sku ?? null,
          })) as any
        )
      )
    );
  }

  if (data.images) {
    parallelOps.push(
      supabase.from('product_images').delete().eq('product_id', id).then(() =>
        supabase.from('product_images').insert(
          data.images!.map((img, i) => ({
            product_id: id, url: img.url, sort_order: i, is_main: img.isMain ? 1 : (i === 0 ? 1 : 0),
          })) as any
        )
      )
    );
  }

  if (data.notes) {
    parallelOps.push(
      supabase.from('product_notes').delete().eq('product_id', id).then(() =>
        supabase.from('product_notes').insert(
          data.notes!.map(n => ({ product_id: id, type: n.type, name: n.name })) as any
        )
      )
    );
  }

  parallelOps.push(logAudit(null, 'UPDATE', 'product', id));
  await Promise.all(parallelOps);

  return getProduct(id);
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from('products').delete().eq('id', id);
  return !error;
}

export async function incrementViewCount(productId: string, ip?: string) {
  // Executar incremento e registro de view em paralelo
  await Promise.all([
    // Tenta RPC atômica primeiro; fallback para read+write se RPC não existir
    supabase.rpc('increment_view_count', { p_product_id: productId }).then(({ error }) => {
      if (error) {
        // Fallback: leitura + escrita (menos eficiente, mas funcional)
        return supabase.from('products').select('view_count').eq('id', productId).single()
          .then(({ data: p }) => {
            if (p) {
              return supabase.from('products')
                .update({ view_count: (p.view_count ?? 0) + 1 })
                .eq('id', productId);
            }
          });
      }
    }),
    supabase.from('product_views').insert({ product_id: productId, ip: ip ?? null }),
  ]);
}

export async function getMostViewed(limit = 10) {
  const { data: rows } = await supabase
    .from('products')
    .select(LIST_COLUMNS)
    .eq('active', 1)
    .order('view_count', { ascending: false })
    .limit(limit);

  if (!rows || rows.length === 0) return [];

  const productIds = rows.map((r: any) => r.id);

  // Usar cache de brands ao invés de query separada
  const [allBrands, imagesResult] = await Promise.all([
    listBrands(),
    supabase.from('product_images').select('product_id, url').in('product_id', productIds).order('sort_order'),
  ]);

  const brandMap = new Map<string, any>(allBrands.map((b: any) => [b.id, b]));
  const imagesByProduct = new Map<string, string[]>();
  for (const i of imagesResult.data ?? []) {
    const list = imagesByProduct.get(i.product_id) ?? [];
    if (list.length === 0) list.push(i.url);
    imagesByProduct.set(i.product_id, list);
  }

  return rows.map((row: any) => ({
    ...row,
    brand: row.brand_id ? brandMap.get(row.brand_id)?.name ?? null : null,
    images: imagesByProduct.get(row.id) ?? [],
  }));
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
  const [mostViewedResult, countResult, variantsResult, promoResult] = await Promise.all([
    getMostViewed(5),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('active', 1),
    supabase.from('product_variants').select('product_id, stock').eq('active', 1),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('active', 1).not('promotional_price', 'is', null),
  ]);

  const totalProducts = countResult.count ?? 0;
  const allVariants = variantsResult.data ?? [];
  const totalProductsOnPromotion = promoResult.count ?? 0;

  let outOfStock = 0;
  let lowStock = 0;
  let totalStock = 0;
  const productStocks: Record<string, number> = {};

  for (const v of allVariants) {
    productStocks[v.product_id] = (productStocks[v.product_id] ?? 0) + (v.stock ?? 0);
    totalStock += v.stock ?? 0;
  }

  for (const stock of Object.values(productStocks)) {
    if (stock === 0) outOfStock++;
    else if (stock <= 5) lowStock++;
  }

  return {
    totalProducts,
    activeProducts: totalProducts,
    outOfStock,
    lowStock,
    totalStock,
    productsOnPromotion: totalProductsOnPromotion,
    mostViewed: mostViewedResult,
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
