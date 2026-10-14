import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_DAYS, createSession, isAllowed, safeEqual } from "@/lib/session";

export const runtime = "nodejs";

// Solo rutas internas como destino tras el login (evita redirecciones abiertas).
const safeNext = (n: FormDataEntryValue | null) => {
  const s = typeof n === "string" ? n : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
};

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeNext(form.get("next"));
  const appPassword = process.env.APP_PASSWORD ?? "";

  // 303 → el navegador repite como GET a la página destino.
  if (!appPassword || !isAllowed(email) || !safeEqual(password, appPassword)) {
    await new Promise((r) => setTimeout(r, 600)); // frena intentos por fuerza bruta
    const url = new URL("/login", req.url);
    url.searchParams.set("error", "1");
    url.searchParams.set("next", next);
    if (email) url.searchParams.set("email", email);
    return NextResponse.redirect(url, 303);
  }

  const res = NextResponse.redirect(new URL(next, req.url), 303);
  res.cookies.set(SESSION_COOKIE, await createSession(email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return res;
}
