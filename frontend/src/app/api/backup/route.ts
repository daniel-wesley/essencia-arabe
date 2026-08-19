import { NextResponse } from 'next/server';
import { createBackup, getBackupInfo, validateSession } from '@/lib/db';

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
    const info = await getBackupInfo();
    return NextResponse.json(info);
  } catch (err) {
    console.error('GET /api/backup error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const session = await validateSession(token);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores.' }, { status: 403 });
  }

  try {
    const path = await createBackup();
    return NextResponse.json({ success: true, path });
  } catch (err) {
    console.error('POST /api/backup error:', err);
    return NextResponse.json({ error: 'Erro ao criar backup.' }, { status: 500 });
  }
}
