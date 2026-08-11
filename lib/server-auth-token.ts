import "server-only";

import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";

async function getServerJwt() {
  await auth();

  const cookieHeader = (await cookies())
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");

  if (!cookieHeader) {
    return null;
  }

  return getToken({
    req: {
      headers: {
        cookie: cookieHeader,
      },
    },
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });
}

export async function getServerAccessToken(): Promise<string | null> {
  const token = await getServerJwt();
  return typeof token?.accessToken === "string" ? token.accessToken : null;
}
