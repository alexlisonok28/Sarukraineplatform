import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();
const BASE_PATH = "/make-server-5f926218";

// --- Supabase clients ---
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Admin client (server-only)
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Public client (for signup/login)
const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY);

// --- Middleware ---
app.use("*", logger(console.log));

app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  })
);

// --- Helpers ---
const getUser = async (c: any) => {
  const authHeader = c.req.header("Authorization");
  console.log(
    "getUser: Authorization header:",
    authHeader ? `Bearer ${authHeader.split(" ")[1]?.substring(0, 15)}...` : "MISSING"
  );

  if (!authHeader) return null;

  const token = authHeader.split(" ")[1];
  if (!token) return null;

  // If token looks like anon key, ignore
  if (!token || token.length < 20 || token === ANON_KEY) return null;

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error) {
      if (error.name !== "AuthSessionMissingError") {
        console.error("getUser: Auth Error:", {
          errorName: error.name,
          message: error.message,
          status: error.status,
        });
      }
      return null;
    }

    return data.user ?? null;
  } catch (e) {
    console.error("getUser: Exception:", e);
    return null;
  }
};

const getProfile = async (userId: string) => {
  const profile = await kv.get(`profile:${userId}`);
  return profile || { id: userId, role: "user" };
};

const logAudit = async (
  userId: string,
  action: string,
  context: string,
  status: "SUCCESS" | "ERROR" = "SUCCESS"
) => {
  const log = {
    id: crypto.randomUUID(),
    userId,
    action,
    context,
    status,
    timestamp: new Date().toISOString(),
  };

  let logs = (await kv.get("audit_logs")) || [];
  if (!Array.isArray(logs)) logs = [];
  logs.unshift(log);
  if (logs.length > 2000) logs = logs.slice(0, 2000);

  await kv.set("audit_logs", logs);
};

// =======================
// Routes
// =======================

// Health
app.get(`${BASE_PATH}/health`, (c) => c.json({ status: "ok" }));

// -----------------------
// PUBLIC AUTH (anyone)
// -----------------------

// ✅ Public signup: creates a normal Supabase auth user (no service role needed)
app.post(`${BASE_PATH}/signup`, async (c) => {
  try {
    const body = await c.req.json();
    const email = String(body.email || "").trim();
    const password = String(body.password || "");
    const name = String(body.name || "").trim();

    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    console.log("[Signup] Public signup:", email);

    const { data, error } = await supabaseAuth.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (error) {
      console.error("[Signup] Error:", error);
      return c.json({ error: error.message }, 400);
    }

    // Create initial profile in KV (optional)
    if (data.user?.id) {
      const profile = {
        id: data.user.id,
        role: "user",
        email: data.user.email,
        name: name || "",
        joinedAt: new Date().toISOString(),
      };
      await kv.set(`profile:${data.user.id}`, profile);

      // Add to users list for admin pages
      let allUsers = (await kv.get("users_list")) || [];
      if (!Array.isArray(allUsers)) allUsers = [];
      if (!allUsers.find((u: any) => u.id === data.user.id)) {
        allUsers.push({ id: data.user.id, email: data.user.email, name: profile.name });
        await kv.set("users_list", allUsers);
      }
    }

    return c.json({
      success: true,
      user: data.user ? { id: data.user.id, email: data.user.email } : null,
      session: data.session ?? null, // может быть null если включено подтверждение email
    });
  } catch (e) {
    console.error("[Signup] Exception:", e);
    return c.json({ error: "Signup failed" }, 500);
  }
});

// ✅ Public login: returns session + user
app.post(`${BASE_PATH}/login`, async (c) => {
  try {
    const body = await c.req.json();
    const email = String(body.email || "").trim();
    const password = String(body.password || "");

    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    console.log("[Login] Public login:", email);

    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("[Login] Error:", error);
      return c.json({ error: error.message }, 400);
    }

    return c.json({
      success: true,
      user: data.user ? { id: data.user.id, email: data.user.email } : null,
      session: data.session ?? null,
    });
  } catch (e) {
    console.error("[Login] Exception:", e);
    return c.json({ error: "Login failed" }, 500);
  }
});

// -----------------------
// PROFILE (protected)
// -----------------------
app.get(`${BASE_PATH}/profile/registrations`, async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const comps = (await kv.get("competitions")) || [];
  const registrations: any[] = [];
  const userDogs = (await kv.get(`dogs:${user.id}`)) || [];

  for (const comp of comps) {
    if (!comp.participants) continue;
    const participant = comp.participants.find((p: any) => p.userId === user.id);
    if (participant) {
      const dog = userDogs.find((d: any) => d.id === participant.dogId);
      registrations.push({
        competitionId: comp.id,
        competitionName: comp.name,
        startDate: comp.startDate || comp.date,
        endDate: comp.endDate,
        location: comp.location,
        dogName: dog?.name || "Unknown",
        category: participant.category,
        class: participant.class,
        status: participant.status,
        documents: participant.documents,
        notes: participant.results?.notes,
      });
    }
  }
  return c.json(registrations);
});

app.get(`${BASE_PATH}/profile`, async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  let profile = await kv.get(`profile:${user.id}`);
  if (!profile) {
    profile = {
      id: user.id,
      role: "user",
      email: user.email,
      name: user.user_metadata?.name || "",
      joinedAt: new Date().toISOString(),
    };
    await kv.set(`profile:${user.id}`, profile);

    let allUsers = (await kv.get("users_list")) || [];
    if (!Array.isArray(allUsers)) allUsers = [];
    if (!allUsers.find((u: any) => u.id === user.id)) {
      allUsers.push({ id: user.id, email: user.email, name: profile.name });
      await kv.set("users_list", allUsers);
    }
  }

  // Backdoor admin bootstrap (оставил как было)
  if ((user.email === "kkek5039@gmail.com" || user.email === "kkek5039gmail.com") && profile.role !== "admin") {
    profile.role = "admin";
    await kv.set(`profile:${user.id}`, profile);
  }

  return c.json(profile);
});

app.post(`${BASE_PATH}/profile`, async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const data = await c.req.json();
  const currentProfile = await getProfile(user.id);

  const newProfile = { ...currentProfile, ...data, role: currentProfile.role, id: user.id };
  await kv.set(`profile:${user.id}`, newProfile);

  let allUsers = (await kv.get("users_list")) || [];
  const uIndex = allUsers.findIndex((u: any) => u.id === user.id);
  if (uIndex >= 0) {
    allUsers[uIndex].name = newProfile.name || allUsers[uIndex].name;
    await kv.set("users_list", allUsers);
  }

  await logAudit(user.id, "UPDATE_PROFILE", user.id);
  return c.json(newProfile);
});

// -----------------------
// DOGS (protected)
// -----------------------
app.get(`${BASE_PATH}/dogs`, async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const dogs = (await kv.get(`dogs:${user.id}`)) || [];
  return c.json(dogs);
});

app.post(`${BASE_PATH}/dogs`, async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const dogData = await c.req.json();
  const newDog = { ...dogData, id: crypto.randomUUID(), userId: user.id };

  let dogs = (await kv.get(`dogs:${user.id}`)) || [];
  if (!Array.isArray(dogs)) dogs = [];
  dogs.push(newDog);

  await kv.set(`dogs:${user.id}`, dogs);
  await logAudit(user.id, "CREATE_DOG", newDog.id);
  return c.json(newDog);
});

app.put(`${BASE_PATH}/dogs/:id`, async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const id = c.req.param("id");
  const updates = await c.req.json();

  let dogs = (await kv.get(`dogs:${user.id}`)) || [];
  const index = dogs.findIndex((d: any) => d.id === id);
  if (index === -1) return c.json({ error: "Dog not found" }, 404);

  dogs[index] = { ...dogs[index], ...updates };
  await kv.set(`dogs:${user.id}`, dogs);
  await logAudit(user.id, "UPDATE_DOG", id);
  return c.json(dogs[index]);
});

app.delete(`${BASE_PATH}/dogs/:id`, async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const id = c.req.param("id");
  let dogs = (await kv.get(`dogs:${user.id}`)) || [];
  const newDogs = dogs.filter((d: any) => d.id !== id);

  await kv.set(`dogs:${user.id}`, newDogs);
  await logAudit(user.id, "DELETE_DOG", id);

  return c.json({ success: true });
});

// -----------------------
// COMPETITIONS (public read, protected write)
// -----------------------
app.get(`${BASE_PATH}/competitions`, async (c) => {
  const comps = (await kv.get("competitions")) || [];
  return c.json(comps);
});

// ======= Далее можно оставить твой исходный код без изменений =======
// Чтобы ответ не был гигантским, я не дублирую оставшиеся 500+ строк.
// ВАЖНО: просто оставь все остальные роуты как у тебя были, ниже этого места.
// Единственное, что мы реально меняли — /signup и добавили /login.
// ===================================================================

Deno.serve(app.fetch);
