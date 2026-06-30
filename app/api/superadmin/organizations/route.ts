export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { ApiErrors } from '@/lib/api-errors';
import {
  ORG_PLAN_SELECT,
  getOrganizationUsage,
  syncCustomerLimitsToAzure,
  type OrganizationPlanRow,
} from '@/lib/organization-limits';
import { getPlanDefinition, isPlanTier, resolvePlanLimits, type PlanTier } from '@/lib/plans';

async function getAuthContext(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll() {},
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!user) {
    return { user: null, isSuperAdmin: false, role: '', accessToken: null as string | null };
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_super_admin')
    .eq('user_id', user.id)
    .single();

  return {
    user,
    isSuperAdmin: profile?.is_super_admin === true,
    role: String(user.app_metadata?.role ?? ''),
    accessToken: session?.access_token ?? null,
  };
}

function buildPlanInsert(planTier: PlanTier, body: Record<string, unknown>) {
  const plan = getPlanDefinition(planTier);
  const resolved = resolvePlanLimits(planTier, {
    maxUsers: body.maxUsers != null ? Number(body.maxUsers) : undefined,
    maxReceiptsPerMonth: body.maxReceiptsPerMonth != null ? Number(body.maxReceiptsPerMonth) : undefined,
    monthlyFeePen: body.monthlyFeePen != null ? Number(body.monthlyFeePen) : undefined,
  });

  return {
    plan_tier: planTier,
    max_users: resolved.maxUsers,
    max_receipts_per_month: resolved.maxReceiptsPerMonth,
    extra_users: body.extraUsers != null ? Number(body.extraUsers) : 0,
    extra_receipts: body.extraReceipts != null ? Number(body.extraReceipts) : 0,
    allow_receipt_overage: body.allowReceiptOverage === true,
    overage_fee_per_receipt: body.overageFeePerReceipt != null ? Number(body.overageFeePerReceipt) : 0.07,
    monthly_fee_pen: resolved.monthlyFeePen,
    billing_cycle: String(body.billingCycle ?? 'monthly'),
    subscription_starts_at: body.subscriptionStartsAt
      ? new Date(String(body.subscriptionStartsAt)).toISOString()
      : new Date().toISOString(),
    subscription_ends_at: body.subscriptionEndsAt
      ? new Date(String(body.subscriptionEndsAt)).toISOString()
      : null,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Calcula los campos de demo. Cuando se habilita un demo, el periodo arranca
// "ahora" y subscription_ends_at se usa para bloquear el acceso al expirar.
function buildDemoFields(body: Record<string, unknown>): Record<string, unknown> | null {
  if (body.demoEnabled === undefined) {
    return null;
  }

  const enabled = body.demoEnabled === true;
  if (!enabled) {
    return {
      demo_enabled: false,
      demo_days: null,
      subscription_ends_at: null,
    };
  }

  const days = Math.max(1, Math.floor(Number(body.demoDays) || 0));
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + days * DAY_MS);

  return {
    demo_enabled: true,
    demo_days: days,
    subscription_starts_at: startsAt.toISOString(),
    subscription_ends_at: endsAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { user, isSuperAdmin, role } = await getAuthContext(req);
    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }
    if (!isSuperAdmin) {
      return NextResponse.json({ error: ApiErrors.FORBIDDEN }, { status: 403 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const includeUsage = req.nextUrl.searchParams.get('includeUsage') === 'true';

    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select(ORG_PLAN_SELECT)
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message || 'No se pudieron cargar las empresas' }, { status: 500 });
    }

    const organizations = (data ?? []) as OrganizationPlanRow[];

    if (!includeUsage || organizations.length === 0) {
      return NextResponse.json(organizations);
    }

    const withUsage = await Promise.all(
      organizations.map(async (org) => {
        try {
          const usage = await getOrganizationUsage(supabaseAdmin, org.id);
          return { ...org, usage };
        } catch {
          return { ...org, usage: null };
        }
      }),
    );

    return NextResponse.json(withUsage);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ApiErrors.UNKNOWN;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, isSuperAdmin, accessToken } = await getAuthContext(req);
    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }
    if (!isSuperAdmin) {
      return NextResponse.json({ error: ApiErrors.SUPERADMIN_CREATE_ORGS }, { status: 403 });
    }
    if (!accessToken) {
      return NextResponse.json({ error: ApiErrors.NO_AUTH_USER }, { status: 401 });
    }

    const body = await req.json();
    const name = String(body?.name ?? '').trim();
    const code = String(body?.code ?? '').trim();
    const ruc = String(body?.ruc ?? '').trim();
    const isActive = body?.isActive === false ? false : true;
    const planTierRaw = String(body?.planTier ?? 'esencial');
    const planTier: PlanTier = isPlanTier(planTierRaw) ? planTierRaw : 'esencial';

    if (!name || !code) {
      return NextResponse.json({ error: ApiErrors.MISSING_NAME_OR_CODE }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const planFields = buildPlanInsert(planTier, body);
    const demoFields = buildDemoFields(body);

    const { data, error } = await supabaseAdmin
      .from('organizations')
      .insert({
        name,
        code,
        ruc: ruc || null,
        is_active: isActive,
        ...planFields,
        ...(demoFields ?? {}),
      })
      .select(ORG_PLAN_SELECT)
      .single();

    if (error) {
      const message = String(error.message ?? 'No se pudo crear el cliente');
      if (message.toLowerCase().includes('duplicate') || message.toLowerCase().includes('unique')) {
        return NextResponse.json({ error: 'El código de cliente ya existe' }, { status: 409 });
      }
      return NextResponse.json({ error: message }, { status: 500 });
    }

    try {
      await syncCustomerLimitsToAzure(data as OrganizationPlanRow, accessToken);
    } catch (storageError: unknown) {
      await supabaseAdmin.from('organizations').delete().eq('id', data.id);
      const message =
        storageError instanceof Error
          ? storageError.message
          : 'No se pudo registrar el cliente en almacenamiento';
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ success: true, organization: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ApiErrors.UNKNOWN;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user, isSuperAdmin, accessToken } = await getAuthContext(req);
    if (!user) {
      return NextResponse.json({ error: ApiErrors.NOT_AUTHENTICATED }, { status: 401 });
    }
    if (!isSuperAdmin) {
      return NextResponse.json({ error: ApiErrors.SUPERADMIN_UPDATE_STATUS }, { status: 403 });
    }

    const body = await req.json();
    const id = String(body?.id ?? '').trim();
    if (!id) {
      return NextResponse.json({ error: 'Falta el id de la empresa' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const updates: Record<string, unknown> = {};

    if (body.isActive != null) {
      updates.is_active = Boolean(body.isActive);
    }

    if (body.planTier != null) {
      const planTierRaw = String(body.planTier);
      if (!isPlanTier(planTierRaw)) {
        return NextResponse.json({ error: 'Plan inválido' }, { status: 400 });
      }
      Object.assign(updates, buildPlanInsert(planTierRaw, body));
    } else {
      if (body.maxUsers != null) updates.max_users = Number(body.maxUsers);
      if (body.maxReceiptsPerMonth != null) updates.max_receipts_per_month = Number(body.maxReceiptsPerMonth);
      if (body.extraUsers != null) updates.extra_users = Number(body.extraUsers);
      if (body.extraReceipts != null) updates.extra_receipts = Number(body.extraReceipts);
      if (body.allowReceiptOverage != null) updates.allow_receipt_overage = Boolean(body.allowReceiptOverage);
      if (body.monthlyFeePen != null) updates.monthly_fee_pen = Number(body.monthlyFeePen);
      if (body.subscriptionEndsAt !== undefined) {
        updates.subscription_ends_at = body.subscriptionEndsAt
          ? new Date(String(body.subscriptionEndsAt)).toISOString()
          : null;
      }
    }

    const demoFields = buildDemoFields(body);
    if (demoFields) {
      Object.assign(updates, demoFields);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No hay cambios para aplicar' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('organizations')
      .update(updates)
      .eq('id', id)
      .select(ORG_PLAN_SELECT)
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message || 'No se pudo actualizar la empresa' },
        { status: 500 },
      );
    }

    if (accessToken) {
      try {
        await syncCustomerLimitsToAzure(data as OrganizationPlanRow, accessToken);
      } catch (syncError) {
        console.error('Azure sync after org update failed:', syncError);
      }
    }

    return NextResponse.json({ success: true, organization: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ApiErrors.UNKNOWN;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
