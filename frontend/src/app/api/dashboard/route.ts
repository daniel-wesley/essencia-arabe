import { NextResponse } from 'next/server';
import { getDashboardStats, validateSession } from '@/lib/db';

export const runtime = 'nodejs';

function getTokenFromRequest(request: Request): string | null {
  return request.headers.get('cookie')?.match(/session_token=([^;]+)/)?.[1] ?? null;
}

export async function GET(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const session = await validateSession(token);
  if (!session || !['admin', 'editor'].includes(session.role)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const stats = await getDashboardStats();
    return NextResponse.json(stats);
  } catch (err) {
    console.error('GET /api/dashboard error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
