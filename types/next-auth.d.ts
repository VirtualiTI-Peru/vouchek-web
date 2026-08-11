import type { DefaultSession } from "next-auth";
import type { VirtualitiCustomer } from "@virtualiti-peru/universal-auth/core";

declare module "next-auth" {
  interface Session {
    userId?: string;
    accessToken?: string;
    refreshToken?: string | null;
    applicationId?: string;
    tenantIds: string[];
    tenants: VirtualitiCustomer[];
    primaryTenantId: string | null;
    appRole: string | null;
    appRoleName: string | null;
    appRoleSlug: string | null;
    isSuperAdmin: boolean;
    user: DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    accessToken?: string;
    accessTokenExpiresMs?: number;
    refreshToken?: string | null;
    applicationId?: string;
    tenantIds?: string[];
    tenants?: VirtualitiCustomer[];
    primaryTenantId?: string | null;
    appRole?: string | null;
    appRoleName?: string | null;
    appRoleSlug?: string | null;
    isSuperAdmin?: boolean;
  }
}

export {};
