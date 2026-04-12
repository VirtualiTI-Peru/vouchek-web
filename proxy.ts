import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = [
	'/sign-in',
	'/sign-up',
	'/set-password',
	'/welcome',
	'/accept-invite',
	'/api/invitations/resolve',
	'/api/complete-invite',
]

export async function proxy(request: NextRequest) {
	let supabaseResponse = NextResponse.next({ request })

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll()
				},
				setAll(cookiesToSet) {
					cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
					supabaseResponse = NextResponse.next({ request })
					cookiesToSet.forEach(({ name, value, options }) =>
						supabaseResponse.cookies.set(name, value, options)
					)
				},
			},
		}
	)

	const { data: { user } } = await supabase.auth.getUser()

	const isPublicRoute = PUBLIC_ROUTES.some(route =>
		request.nextUrl.pathname.startsWith(route)
	)

	if (!user && !isPublicRoute) {
		const url = request.nextUrl.clone()
		url.pathname = '/sign-in'
		return NextResponse.redirect(url)
	}

	return supabaseResponse
}

export const config = {
	matcher: [
		'/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
		'/(api|trpc)(.*)',
	],
}

