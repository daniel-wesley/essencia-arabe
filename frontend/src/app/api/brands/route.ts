import { NextResponse } from 'next/server';
import { listBrands, createBrand, updateBrand, deleteBrand, validateSession } from '@/lib/db';

export const runtime = 'nodejs';

function getTokenFromRequest(request: Request): string | null {
  return request.headers.get('cookie')?.match(/session_token=([^;]+)/)?.[1] ?? null;
}

export async function GET() {
  try {
    const brands = await listBrands();
    const response = NextResponse.json(brands);
    response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=120');
    return response;
  } catch (err) {
    console.error('GET /api/brands error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const session = await validateSession(token);
  if (!session || !['admin', 'editor'].includes(session.role)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = (body.name ?? '').toString().trim();
    if (!name) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });

    const brand = await createBrand({
      name,
      slug: body.slug,
      country: body.country,
      description: body.description,
      logoUrl: body.logoUrl,
    });

    return NextResponse.json(brand, { status: 201 });
  } catch (err) {
    console.error('POST /api/brands error:', err);
    return NextResponse.json({ error: 'Erro interno ao criar marca.' }, { status: 500 });
  }
}
