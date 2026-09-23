import { NextResponse, NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

type Papel = 'USUARIO' | 'BACKOFFICE' | 'TECNICO' | 'ADMINISTRADOR'
const ADMIN_ROLES: ReadonlySet<Papel> = new Set(['BACKOFFICE', 'TECNICO', 'ADMINISTRADOR'])
const ALUNO_ROLE: Papel = 'USUARIO'
const ADMIN_HOME = '/admin/home'
const ALUNO_HOME = '/aluno/home'
const LOGIN_PATH = '/login'

const AUTH_PAGES: ReadonlySet<string> = new Set(['/login', '/primeiro-acesso', '/esqueci-senha', '/reset-senha'])
const protectedPrefixes = ['/admin', '/aluno']

async function getJwtPayload(token: string) {
  try {
    if (!process.env.JWT_ACCESS_SECRET) return null
    const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET)
    const { payload } = await jwtVerify(token, secret, {
      issuer: process.env.JWT_ISSUER || 'helpdesk',
      audience: process.env.JWT_AUDIENCE || 'helpdesk-app',
    })
    return payload as { sub: string; email: string; role: Papel }
  } catch {
    return null
  }
}

function redirectLogin(req: NextRequest, pathname: string, clearCookies = false) {
  const url = req.nextUrl.clone()
  url.pathname = LOGIN_PATH
  if (protectedPrefixes.some(p => pathname.startsWith(p))) {
    url.search = `?redirect=${encodeURIComponent(pathname)}`
  }
  const res = NextResponse.redirect(url)
  if (clearCookies) {
    res.cookies.delete('accessToken')
    res.cookies.delete('refreshToken')
  }
  return res
}

function homeForRole(role: Papel) {
  return ADMIN_ROLES.has(role) ? ADMIN_HOME : ALUNO_HOME
}

function guardRoute(pathname: string, role: Papel) {
  if (pathname.startsWith('/admin') && !ADMIN_ROLES.has(role)) return ALUNO_HOME
  if (pathname.startsWith('/aluno') && role !== ALUNO_ROLE) return ADMIN_HOME
  return null
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const sessionToken = req.cookies.get('accessToken')?.value
  const isAuthRoute = AUTH_PAGES.has(pathname)
  const isProtectedRoute = protectedPrefixes.some(prefix => pathname.startsWith(prefix))

  if (!sessionToken) {
    return isProtectedRoute ? redirectLogin(req, pathname) : NextResponse.next()
  }

  const payload = await getJwtPayload(sessionToken)
  if (!payload) return redirectLogin(req, pathname, true)

  const { role } = payload

  if (isAuthRoute) {
    return NextResponse.redirect(new URL(homeForRole(role), req.nextUrl.origin))
  }

  const blockedHome = guardRoute(pathname, role)
  if (blockedHome) {
    return NextResponse.redirect(new URL(blockedHome, req.nextUrl.origin))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|images|assets|favicon.svg).*)'],
}
