import { NextResponse } from 'next/server';
import { updateUserRole, updateUserActive, validateSession } from '@/lib/db';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

function getTokenFromRequest(request: Request): string | null {
  return request.headers.get('cookie')?.match(/session_token=([^;]+)/)?.[1] ?? null;
}

export async function PATCH(request: Request, { params }: Params) {
  const token = getTokenFromRequest(request);
  if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const session = await validateSession(token);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores.' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    if (body.role && ['admin', 'editor', 'viewer'].includes(body.role)) {
      await updateUserRole(id, body.role);
    }
    if (body.active !== undefined) {
      await updateUserActive(id, !!body.active);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/users/:id error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
