import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.1/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller is an admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check admin role
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Not admin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, access_code, collaborator_id } = await req.json();

    if (!email || !access_code || !collaborator_id) {
      return new Response(JSON.stringify({ error: "Missing email, access_code or collaborator_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if collaborator already has a user_id
    const { data: collab } = await adminClient
      .from("collaborators")
      .select("user_id")
      .eq("id", collaborator_id)
      .single();

    let authUserId: string;

    if (collab?.user_id) {
      // Update existing auth user's password and email
      const { data: updated, error: updateErr } = await adminClient.auth.admin.updateUserById(
        collab.user_id,
        { password: access_code, email }
      );
      if (updateErr) throw updateErr;
      authUserId = updated.user.id;
    } else {
      // Check if auth user with this email already exists
      const { data: { users } } = await adminClient.auth.admin.listUsers();
      const existing = users?.find((u) => u.email === email);

      if (existing) {
        // Update password for existing user
        const { error: updateErr } = await adminClient.auth.admin.updateUserById(
          existing.id,
          { password: access_code }
        );
        if (updateErr) throw updateErr;
        authUserId = existing.id;
      } else {
        // Create new auth user
        const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
          email,
          password: access_code,
          email_confirm: true,
        });
        if (createErr) throw createErr;
        authUserId = newUser.user.id;
      }

      // Link auth user to collaborator
      await adminClient
        .from("collaborators")
        .update({ user_id: authUserId, access_code })
        .eq("id", collaborator_id);
    }

    // Update the access_code in collaborators table
    await adminClient
      .from("collaborators")
      .update({ access_code })
      .eq("id", collaborator_id);

    return new Response(JSON.stringify({ success: true, user_id: authUserId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
