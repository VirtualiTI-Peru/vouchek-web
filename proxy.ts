import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'

const PUBLIC_ROUTES = [
	'/sign-in',
	'/sign-up',
	'/set-password',
	'/welcome',
	'/privacy-policy',
	'/api/forgot-password',
	'/api/auth',
]

function isPublicRoute(pathname: string) {
	return PUBLIC_ROUTES.some((route) => pathname.startsWith(route))
}

export async function proxy(request: NextRequest) {
	const pathname = request.nextUrl.pathname

	if (isPublicRoute(pathname)) {
		return NextResponse.next({ request })
	}

	const session = await auth()
	if (!session) {
		const url = request.nextUrl.clone()
		url.pathname = '/sign-in'
		return NextResponse.redirect(url)
	}

	return NextResponse.next({ request })
}

export const config = {
	matcher: [
		'/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
		'/(api|trpc)(.*)',
	],
}
