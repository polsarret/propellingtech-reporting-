// Sesión de login: cookie firmada (HMAC-SHA256) con el email y la caducidad.
// Usa Web Crypto para funcionar igual en el middleware (edge) y en las rutas (Node).
// Config en variables de entorno de Vercel:
// - ALLOWED_EMAILS: emails autorizados, separados por comas.
// - APP_PASSWORD: contraseña compartida.
// - AUTH_SECRET: clave aleatoria para firmar la cookie.

export const SESSION_COOKIE = "pt_session";
export const SESSION_DAYS = 30;

const enc = new TextEncoder();

export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const isAllowed = (email: string) => allowedEmails().includes(email.trim().toLowerCase());

function toB64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(data: string): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toB64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}

/** Comparación en tiempo constante (evita filtrar información por timing). */
export function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export async function createSession(email: string): Promise<string> {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = toB64url(enc.encode(`${email.trim().toLowerCase()}|${exp}`));
  return `${payload}.${await hmac(payload)}`;
}

/** Devuelve el email si la cookie es válida, no ha caducado y el email sigue autorizado. */
export async function readSession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    if (!safeEqual(sig, await hmac(payload))) return null;
    const [email, exp] = atob(payload.replace(/-/g, "+").replace(/_/g, "/")).split("|");
    if (!email || !(Number(exp) > Date.now())) return null;
    return isAllowed(email) ? email : null;
  } catch {
    return null;
  }
}
