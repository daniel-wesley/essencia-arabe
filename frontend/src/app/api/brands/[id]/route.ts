import { NextResponse } from 'next/server';
import { updateBrand, deleteBrand, validateSession } from '@/lib/db';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

function getTokenFromRequest(request: Request): string | null {
  return request.headers.get('cookie')?.match(/session_token=([^;]+)/)?.[1] ?? null;
}

export async function PATCH(request: Request, { params }: Params) {
  const token = getTokenFromRequest(request);
  if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const session = await validateSession(token);
  if (!session || !['admin', 'editor'].includes(session.role)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const brand = await updateBrand(id, body);
    if (!brand) return NextResponse.json({ error: 'Marca não encontrada.' }, { status: 404 });
    return NextResponse.json(brand);
  } catch (err) {
    console.error('PATCH /api/brands/:id error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const token = getTokenFromRequest(request);
  if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const session = await validateSession(token);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores.' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const ok = await deleteBrand(id);
    if (!ok) return NextResponse.json({ error: 'Marca não encontrada.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/brands/:id error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
