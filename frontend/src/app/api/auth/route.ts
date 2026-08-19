import { NextResponse } from 'next/server';
import { authenticateUser, createSession, validateSession, destroySession, recordLoginAttempt, checkRateLimit, getUserById } from '@/lib/db';

export const runtime = 'nodejs';

function getTokenFromRequest(request: Request): string | null {
  return request.headers.get('cookie')?.match(/session_token=([^;]+)/)?.[1] ?? null;
}

export async function GET(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const session = validateSession(token);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: { id: session.id, username: session.username, role: session.role },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = (body.username ?? '').toString().trim();
    const password = (body.password ?? '').toString();
    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Usuário e senha são obrigatórios.' },
        { status: 400 },
      );
    }

    // Rate limiting
    const rateLimit = checkRateLimit(username, ip);
    if (!rateLimit.allowed) {
      recordLoginAttempt(username, false, ip);
      return NextResponse.json(
        { error: `Conta bloqueada temporariamente. Tente novamente em 15 minutos.` },
        { status: 429 },
      );
    }

    const user = authenticateUser(username, password);

    if (!user) {
      recordLoginAttempt(username, false, ip);
      return NextResponse.json(
        { error: `Credenciais inválidas. ${rateLimit.remaining - 1} tentativa(s) restante(s).` },
        { status: 401 },
      );
    }

    recordLoginAttempt(username, true, ip);
    const token = createSession(user.id, ip);

    const response = NextResponse.json({
      user: { id: user.id, username: user.username, role: user.role },
    });

    response.cookies.set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (err) {
    console.error('POST /api/auth error:', err);
    return NextResponse.json(
      { error: 'Erro interno ao autenticar.' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const token = getTokenFromRequest(request);
  if (token) {
    destroySession(token);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('session_token', '', { maxAge: 0, path: '/' });
  return response;
}
