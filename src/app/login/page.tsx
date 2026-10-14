export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; email?: string }>;
}) {
  const { next = "/", error, email = "" } = await searchParams;

  return (
    <main className="mx-auto flex max-w-sm flex-col px-4 py-16 sm:py-24">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Sign in</h1>
      <p className="mt-1 text-sm text-muted">PropellingTech financial reporting · partners only.</p>

      <form method="post" action="/api/login" className="mt-8 space-y-4 rounded-lg border border-line bg-surface p-5">
        <input type="hidden" name="next" value={next} />
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={email}
            autoFocus={!email}
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-propel focus:ring-1 focus:ring-propel"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            autoFocus={!!email}
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-propel focus:ring-1 focus:ring-propel"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-hotlava">
            Email not authorized or wrong password.
          </p>
        )}
        <button type="submit" className="w-full rounded-md bg-nav px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90">
          Sign in
        </button>
      </form>

      <p className="mt-4 text-xs text-muted/80">No access? Ask Pol to add your email.</p>
    </main>
  );
}
