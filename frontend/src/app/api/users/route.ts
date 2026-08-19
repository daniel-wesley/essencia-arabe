import { NextResponse } from 'next/server';
import { listUsers, createUser, updateUserRole, validateSession } from '@/lib/db';

export const runtime = 'nodejs';

function getTokenFromRequest(request: Request): string | null {
  return request.headers.get('cookie')?.match(/session_token=([^;]+)/)?.[1] ?? null;
}

export async function GET(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const session = validateSession(token);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores.' }, { status: 403 });
  }

  try {
    return NextResponse.json(listUsers());
  } catch (err) {
    console.error('GET /api/users error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const session = validateSession(token);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const username = (body.username ?? '').toString().trim();
    const password = (body.password ?? '').toString();
    const role = body.role ?? 'viewer';

    if (!username || !password) {
      return NextResponse.json({ error: 'Usuário e senha são obrigatórios.' }, { status: 400 });
    }

    if (!['admin', 'editor', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Função inválida.' }, { status: 400 });
    }

    const user = createUser(username, password, role);
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    console.error('POST /api/users error:', err);
    return NextResponse.json({ error: 'Erro interno ao criar usuário.' }, { status: 500 });
  }
}
