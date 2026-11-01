export default function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className="text-sm font-medium px-3.5 py-2 rounded-xl border border-[var(--surface-border)] transition hover:border-indigo-400/40 hover:bg-indigo-400/5"
      >
        Sign out
      </button>
    </form>
  );
}
