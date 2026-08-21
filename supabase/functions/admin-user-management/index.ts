import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = request.headers.get("Authorization");
  if (!supabaseUrl || !serviceRoleKey || !authHeader) return json({ error: "Unauthorized" }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: { user: actor }, error: actorError } = await adminClient.auth.getUser(token);
  if (actorError || !actor) return json({ error: "Unauthorized" }, 401);

  const { data: actorAdmin, error: actorAdminError } = await adminClient
    .from("admin_users")
    .select("id, role, status")
    .eq("id", actor.id)
    .maybeSingle();
  if (actorAdminError || !actorAdmin || actorAdmin.status !== "active" || !["SUPER_ADMIN", "ADMIN"].includes(actorAdmin.role)) {
    return json({ error: "غير مصرح — يتطلب صلاحيات الإدارة" }, 403);
  }

  let payload: { action?: string; email?: string; fullName?: string; password?: string; role?: string; userId?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (payload.action === "create") {
    if (!payload.email || !payload.password || !payload.fullName || !payload.role) return json({ error: "بيانات المستخدم غير مكتملة" }, 400);
    if (payload.role === "SUPER_ADMIN" && actorAdmin.role !== "SUPER_ADMIN") return json({ error: "لا يمكن إنشاء Super Admin" }, 403);

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: { full_name: payload.fullName },
    });
    if (createError || !created.user) return json({ error: createError?.message ?? "تعذر إنشاء المستخدم" }, 400);

    const limits = { max_daily_searches: 50, max_monthly_searches: 1000, max_daily_leads: 500, max_monthly_leads: 10000, max_ai_requests: 200, max_exports: 20, max_active_jobs: 3 };
    const usage = { daily_searches: 0, monthly_searches: 0, daily_leads: 0, monthly_leads: 0, ai_requests: 0, export_count: 0, active_jobs: 0 };
    const { data: roleDef } = await adminClient.from("admin_roles").select("permissions").eq("name", payload.role).maybeSingle();
    const { data: adminUser, error: upsertError } = await adminClient.from("admin_users").upsert({
      id: created.user.id,
      email: payload.email,
      full_name: payload.fullName,
      role: payload.role,
      status: "active",
      permissions: roleDef?.permissions ?? [],
      usage,
      limits,
      updated_at: new Date().toISOString(),
    }).select().single();
    if (upsertError) return json({ error: upsertError.message }, 400);
    return json({ adminUser });
  }

  if (payload.action === "reset_password") {
    if (!payload.userId || !payload.password || payload.password.length < 6) return json({ error: "كلمة المرور غير صالحة" }, 400);
    const { error } = await adminClient.auth.admin.updateUserById(payload.userId, { password: payload.password });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: "Action not supported" }, 400);
});
