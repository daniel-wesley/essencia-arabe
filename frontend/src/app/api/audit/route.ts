import { NextResponse } from 'next/server';
import { getAuditLogs, validateSession } from '@/lib/db';

export const runtime = 'nodejs';

function getTokenFromRequest(request: Request): string | null {
  return request.headers.get('cookie')?.match(/session_token=([^;]+)/)?.[1] ?? null;
}

export async function GET(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const session = await validateSession(token);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores.' }, { status: 403 });
  }

  try {
    return NextResponse.json(await getAuditLogs(100));
  } catch (err) {
    console.error('GET /api/audit error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
