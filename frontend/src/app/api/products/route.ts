import { NextResponse } from 'next/server';
import { createProduct, listProducts, normalizeVariants, validateSession } from '@/lib/db';

export const runtime = 'nodejs';

function getTokenFromRequest(request: Request): string | null {
  return request.headers.get('cookie')?.match(/session_token=([^;]+)/)?.[1] ?? null;
}

async function requireAuth(request: Request, allowedRoles: string[] = ['admin', 'editor']): Promise<{ authorized: boolean; user?: { id: string; username: string; role: string } }> {
  const token = getTokenFromRequest(request);
  if (!token) return { authorized: false };
  const session = await validateSession(token);
  if (!session) return { authorized: false };
  if (!allowedRoles.includes(session.role)) return { authorized: false };
  return { authorized: true, user: session };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const featuredOnly = searchParams.get('featured') === '1' || searchParams.get('featured') === 'true';
    const categoryId = searchParams.get('categoryId') ?? undefined;
    const brandId = searchParams.get('brandId') ?? undefined;
    const search = searchParams.get('search') ?? undefined;
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : undefined;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    const products = await listProducts({ featuredOnly, categoryId, brandId, search, page, limit });
    return NextResponse.json(products);
  } catch (err) {
    console.error('GET /api/products error:', err);
    return NextResponse.json({ error: 'Erro interno ao listar produtos.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
    const auth = await requireAuth(request, ['admin', 'editor']);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const name = (body.name ?? '').toString().trim();
    if (!name) {
      return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
    }

    const variants = normalizeVariants(body.variants);
    const images = Array.isArray(body.images)
      ? body.images.filter((i: unknown) => typeof i === 'string' || (i && typeof i === 'object' && 'url' in (i as Record<string, unknown>)))
        .map((i: unknown) => typeof i === 'string' ? { url: i } : i as { url: string })
      : [];

    const notes = Array.isArray(body.notes)
      ? body.notes.filter((n: unknown) => n && typeof n === 'object' && 'type' in (n as Record<string, unknown>) && 'name' in (n as Record<string, unknown>))
      : [];

    const product = await createProduct({
      name,
      brandId: body.brandId,
      categoryId: body.categoryId,
      sku: body.sku,
      barcode: body.barcode,
      description: body.description,
      shortDescription: body.shortDescription,
      family: body.family,
      concentration: body.concentration,
      gender: body.gender,
      country: body.country,
      occasion: body.occasion,
      longevity: body.longevity,
      projection: body.projection,
      featured: body.featured === true,
      promotionalPrice: body.promotionalPrice ? Number(body.promotionalPrice) : undefined,
      promotionStart: body.promotionStart,
      promotionEnd: body.promotionEnd,
      variants,
      images,
      notes,
    });

    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    console.error('POST /api/products error:', err);
    return NextResponse.json({ error: 'Erro interno ao criar produto.' }, { status: 500 });
  }
}
