import "server-only";

import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";

async function getServerJwt() {
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
  });
}

export async function getServerAccessToken(): Promise<string | null> {
  const session = await auth();
  if (typeof session?.accessToken === "string" && session.accessToken.length > 0) {
    return session.accessToken;
  }

  const token = await getServerJwt();
  return typeof token?.accessToken === "string" ? token.accessToken : null;
}
