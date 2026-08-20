import { NextResponse } from 'next/server';
import { listCategories, createCategory, validateSession } from '@/lib/db';

export const runtime = 'nodejs';

function getTokenFromRequest(request: Request): string | null {
  return request.headers.get('cookie')?.match(/session_token=([^;]+)/)?.[1] ?? null;
}

export async function GET() {
  try {
    const categories = await listCategories();
    const response = NextResponse.json(categories);
    response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=120');
    return response;
  } catch (err) {
    console.error('GET /api/categories error:', err);
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

    const category = await createCategory({
      name,
      slug: body.slug,
      parentId: body.parentId,
      description: body.description,
    });

    return NextResponse.json(category, { status: 201 });
  } catch (err) {
    console.error('POST /api/categories error:', err);
    return NextResponse.json({ error: 'Erro interno ao criar categoria.' }, { status: 500 });
  }
}
