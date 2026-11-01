import { LockKey, Password, ShieldCheck, UserFocus } from "@phosphor-icons/react/dist/ssr";

/**
 * Why it is safe to talk freely in MemoValet. Each line is something checked
 * against the live site: a meeting id opened while signed out returns
 * nothing, recordings are served through links that expire, and a password
 * from a known breach is refused at sign-up.
 *
 * Deliberately absent: anything about AI training. Transcription and
 * translation currently run on a provider tier whose terms allow it to use
 * content to improve its products, so "never used to train AI" would not be
 * true. Add it only once that has changed.
 */
const ITEMS = [
  {
    Icon: UserFocus,
    title: "Only who you choose",
    body: "Everything you keep opens for you and the people you share it with. The database itself refuses everyone else, not just the page.",
  },
  {
    Icon: LockKey,
    title: "Private recordings",
    body: "Recordings are kept in private storage and played through links that expire after a few hours.",
  },
  {
    Icon: ShieldCheck,
    title: "Two-step sign-in",
    body: "Add a second step with Google Authenticator, Microsoft Authenticator or Authy, checked on every request once it is on.",
  },
  {
    Icon: Password,
    title: "No leaked passwords",
    body: "Passwords that have appeared in known data breaches are refused, without the password ever leaving your device.",
  },
];

export default function PrivateByDesign() {
  return (
    <section aria-labelledby="privacy-heading" className="relative px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8071ff]">Private by design</p>
            <h2 id="privacy-heading" className="mt-5 font-display text-3xl font-light leading-[1.16] tracking-[-0.045em] text-balance text-white sm:text-5xl">
              What you keep here <span className="text-[#bb99ff]">stays yours.</span>
            </h2>
            <p className="mt-6 max-w-md text-base leading-7 text-white/62">
              Your plans, promises, files and conversations are some of the most personal things you have. MemoValet keeps them between you and the people you choose.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {ITEMS.map(({ Icon, title, body }) => (
              <li key={title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition duration-300 hover:border-white/20 hover:bg-white/[0.05]">
                <Icon size={28} weight="duotone" className="text-[#a78bfa]" aria-hidden="true" />
                <h3 className="mt-5 font-display text-lg font-semibold tracking-[-0.01em] text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/58">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
