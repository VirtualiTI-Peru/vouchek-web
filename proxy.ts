import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isInvalidSessionError } from '@/lib/auth-session'

const PUBLIC_ROUTES = [
	'/sign-in',
	'/sign-up',
	'/set-password',
	'/welcome',
	'/privacy-policy',
	'/accept-invite',
	'/api/invitations/resolve',
	'/api/complete-invite',
	'/api/forgot-password',
]

function isPublicRoute(pathname: string) {
	return PUBLIC_ROUTES.some((route) => pathname.startsWith(route))
}

function copyCookies(from: NextResponse, to: NextResponse) {
	from.cookies.getAll().forEach(({ name, value }) => {
		to.cookies.set(name, value)
	})
}

export async function proxy(request: NextRequest) {
	const pathname = request.nextUrl.pathname

	// Rutas públicas: no llamar a Supabase (evita bloqueos y picos de CPU en login).
	if (isPublicRoute(pathname)) {
		return NextResponse.next({ request })
	}

	let supabaseResponse = NextResponse.next({ request })

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll()
				},
				setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
					cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
					supabaseResponse = NextResponse.next({ request })
					cookiesToSet.forEach(({ name, value, options }) =>
						supabaseResponse.cookies.set(name, value, options)
					)
				},
			},
		}
	)

	const { data: { user }, error } = await supabase.auth.getUser()

	if (isInvalidSessionError(error)) {
		await supabase.auth.signOut()
	}

	if (!user) {
		const url = request.nextUrl.clone()
		url.pathname = '/sign-in'
		const redirectResponse = NextResponse.redirect(url)
		copyCookies(supabaseResponse, redirectResponse)
		return redirectResponse
	}

	return supabaseResponse
}

export const config = {
	matcher: [
		'/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
		'/(api|trpc)(.*)',
	],
}
