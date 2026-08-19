import { NextResponse } from 'next/server';
import { updateProduct, deleteProduct, getProduct, normalizeVariants, incrementViewCount, validateSession } from '@/lib/db';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

function getTokenFromRequest(request: Request): string | null {
  return request.headers.get('cookie')?.match(/session_token=([^;]+)/)?.[1] ?? null;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const product = getProduct(id);

    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 });
    }

    // Increment view count
    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
    incrementViewCount(product.id as string, ip);

    return NextResponse.json(product);
  } catch (err) {
    console.error('GET /api/products/:id error:', err);
    return NextResponse.json({ error: 'Erro interno ao buscar produto.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }
  const session = validateSession(token);
  if (!session || !['admin', 'editor'].includes(session.role)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const name = (body.name ?? '').toString().trim();
    if (!name) {
      return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
    }

    const variants = normalizeVariants(body.variants);
    const images = Array.isArray(body.images)
      ? body.images.filter((i: unknown) => typeof i === 'string' || (i && typeof i === 'object' && 'url' in (i as Record<string, unknown>)))
        .map((i: unknown) => typeof i === 'string' ? { url: i } : i as { url: string })
      : undefined;

    const notes = Array.isArray(body.notes)
      ? body.notes.filter((n: unknown) => n && typeof n === 'object' && 'type' in (n as Record<string, unknown>) && 'name' in (n as Record<string, unknown>))
      : undefined;

    const product = updateProduct(id, {
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
      featured: body.featured,
      promotionalPrice: body.promotionalPrice ? Number(body.promotionalPrice) : undefined,
      promotionStart: body.promotionStart,
      promotionEnd: body.promotionEnd,
      variants,
      images,
      notes,
    });

    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (err) {
    console.error('PATCH /api/products error:', err);
    return NextResponse.json({ error: 'Erro interno ao atualizar produto.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }
  const session = validateSession(token);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem excluir produtos.' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const ok = deleteProduct(id);

    if (!ok) {
      return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/products/:id error:', err);
    return NextResponse.json({ error: 'Erro interno ao excluir produto.' }, { status: 500 });
  }
}
