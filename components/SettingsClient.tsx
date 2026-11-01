"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import TrelloListPicker from "@/components/TrelloListPicker";
import type { AccountType } from "@/lib/types";

export interface StripeStatus {
  configured: boolean;
  connected: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
}

interface NotificationPrefs {
  timed_reminders?: boolean;
  task_completed: boolean;
  invite_accepted: boolean;
  task_due_soon: boolean;
  overdue_digest: boolean;
}

interface SettingsClientProps {
  email: string;
  firstName: string;
  lastName: string;
  accountType: AccountType;
  stripe?: StripeStatus;
  createdAt: string;
  signInMethod: string;
  googleConnected: boolean;
  googleLinked?: boolean;
  googleNotice?: string;
  slackConfigured?: boolean;
  slackLabel?: string;
  slackNotice?: string;
  notion?: { configured: boolean; connected: boolean; label: string; needsPage: boolean; notice: string };
  trello?: { configured: boolean; connected: boolean; member: string; listLabel: string; notice: string };
  integrationStatus: {
    trello: boolean;
    slack: boolean;
    notion: boolean;
  };
  notificationPrefs: NotificationPrefs;
}

// drive.file is the narrowest Drive access Google offers: only files MemoValet
// itself creates (the exported Docs), never the rest of someone's Drive. The
// Docs export can't work without it.
const GOOGLE_SCOPES =
  "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive.file";

const NOTIFICATION_TOGGLES: { key: keyof NotificationPrefs; label: string }[] = [
  { key: "timed_reminders", label: "Scheduled reminders in your inbox and notifications" },
  { key: "task_completed", label: "Someone completes a task you sent them" },
  { key: "invite_accepted", label: "Someone accepts your live session invite" },
  { key: "task_due_soon", label: "A task you sent is due soon and still pending" },
  { key: "overdue_digest", label: "Daily email when action items from your meetings are overdue" },
];

function formatMemberSince(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function SettingsClient({
  email,
  firstName: initialFirstName,
  lastName: initialLastName,
  accountType: initialAccountType,
  stripe: initialStripe,
  createdAt,
  signInMethod,
  googleConnected,
  googleLinked = false,
  googleNotice = "",
  slackConfigured = false,
  slackLabel = "",
  slackNotice = "",
  notion = { configured: false, connected: false, label: "", needsPage: false, notice: "" },
  trello = { configured: false, connected: false, member: "", listLabel: "", notice: "" },
  integrationStatus,
  notificationPrefs: initialNotificationPrefs,
}: SettingsClientProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [notificationPrefs, setNotificationPrefs] = useState(initialNotificationPrefs);
  const [prefsError, setPrefsError] = useState("");
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [restartingTour, setRestartingTour] = useState(false);

  const [mfaLoading, setMfaLoading] = useState(true);
  const [activeFactorId, setActiveFactorId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollFactorId, setEnrollFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [enrollCode, setEnrollCode] = useState("");
  const [enrollSubmitting, setEnrollSubmitting] = useState(false);
  const [enrollError, setEnrollError] = useState("");
  const [unenrolling, setUnenrolling] = useState(false);

  const refreshFactors = async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    const verified = data?.totp.find((f) => f.status === "verified");
    setActiveFactorId(verified ? verified.id : null);
    setMfaLoading(false);
  };

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const verified = data?.totp.find((f) => f.status === "verified");
      setActiveFactorId(verified ? verified.id : null);
      setMfaLoading(false);
    });
  }, []);

  const startEnroll = async () => {
    setEnrollError("");
    const supabase = createClient();
    const { data, error: enrollErr } = await supabase.auth.mfa.enroll({ factorType: "totp" });

    if (enrollErr || !data) {
      setEnrollError("Couldn't start setup. Try again.");
      return;
    }

    setEnrollFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setEnrolling(true);
  };

  const cancelEnroll = async () => {
    if (enrollFactorId) {
      const supabase = createClient();
      await supabase.auth.mfa.unenroll({ factorId: enrollFactorId });
    }
    setEnrolling(false);
    setEnrollFactorId(null);
    setEnrollCode("");
    setEnrollError("");
  };

  const confirmEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollFactorId || enrollCode.trim().length !== 6) return;

    setEnrollSubmitting(true);
    setEnrollError("");

    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: enrollFactorId,
    });

    if (challengeError || !challenge) {
      setEnrollError("Couldn't verify. Try again.");
      setEnrollSubmitting(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enrollFactorId,
      challengeId: challenge.id,
      code: enrollCode.trim(),
    });

    if (verifyError) {
      setEnrollError("That code didn't work. Check your authenticator app and try again.");
      setEnrollSubmitting(false);
      return;
    }

    setEnrolling(false);
    setEnrollCode("");
    setEnrollSubmitting(false);
    await refreshFactors();
  };

  const turnOff = async () => {
    if (!activeFactorId) return;
    setUnenrolling(true);
    const supabase = createClient();
    await supabase.auth.mfa.unenroll({ factorId: activeFactorId });
    await refreshFactors();
    setUnenrolling(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      data: { first_name: firstName.trim(), last_name: lastName.trim() },
    });

    if (updateError) {
      setError("Couldn't save that. Mind trying again?");
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      router.refresh();
    }
    setSaving(false);
  };

  const [accountType, setAccountType] = useState<AccountType>(initialAccountType);
  const [savingAccountType, setSavingAccountType] = useState(false);
  const [accountTypeError, setAccountTypeError] = useState("");

  const chooseAccountType = async (value: AccountType) => {
    if (value === accountType || savingAccountType) return;
    const previous = accountType;
    setAccountType(value);
    setSavingAccountType(true);
    setAccountTypeError("");
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ data: { account_type: value } });
    if (updateError) {
      setAccountType(previous);
      setAccountTypeError("Couldn't save that. Mind trying again?");
    } else {
      router.refresh();
    }
    setSavingAccountType(false);
  };

  const [stripe, setStripe] = useState<StripeStatus>(
    initialStripe || { configured: false, connected: false, chargesEnabled: false, detailsSubmitted: false }
  );
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [stripeError, setStripeError] = useState("");

  // Back from Stripe onboarding: re-check the account status.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const flag = new URLSearchParams(window.location.search).get("stripe");
    if (!flag) return;
    let cancelled = false;
    fetch("/api/stripe/connect")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data && typeof data.connected === "boolean") setStripe(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const connectStripe = async () => {
    if (connectingStripe) return;
    setConnectingStripe(true);
    setStripeError("");
    try {
      const response = await fetch("/api/stripe/connect", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.url) {
        setStripeError(data.error || "Couldn't start Stripe setup.");
        setConnectingStripe(false);
        return;
      }
      window.location.assign(data.url);
    } catch {
      setStripeError("Couldn't start Stripe setup.");
      setConnectingStripe(false);
    }
  };

  const toggleNotificationPref = async (key: keyof NotificationPrefs, value: boolean) => {
    if (savingPrefs) return;
    const next = { ...notificationPrefs, [key]: value };
    setPrefsError("");
    setSavingPrefs(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ data: { notification_prefs: next } });
      if (error) throw error;
      setNotificationPrefs(next);
    } catch { setPrefsError("Could not save notification preferences. Please try again."); }
    finally { setSavingPrefs(false); }
  };

  const retakeTour = () => {
    setRestartingTour(true);
    router.push("/dashboard?tour=1");
  };

  const connectGoogle = async () => {
    setConnectingGoogle(true);
    const supabase = createClient();
    const options = {
      // connect=google tells the callback this trip is the one to save access from.
      redirectTo: window.location.origin + "/auth/callback?connect=google&next=" + encodeURIComponent("/settings"),
      scopes: GOOGLE_SCOPES,
      queryParams: { access_type: "offline", prompt: "consent" },
    };
    // Linking attaches Google to *this* account whatever its email. Signing in
    // with Google instead switches to whichever account owns that Google email
    // — a separate, empty one when the emails differ. Linking needs "Allow
    // manual linking" on in Supabase; when it's off, or Google is already linked
    // here (reconnecting), sign in with Google as before.
    if (!googleLinked) {
      const { error: linkError } = await supabase.auth.linkIdentity({ provider: "google", options });
      if (!linkError) return; // on the way to Google
    }
    await supabase.auth.signInWithOAuth({ provider: "google", options });
  };

  const inputClasses =
    "w-full rounded-xl border border-[var(--surface-border)] bg-transparent px-3.5 py-2.5 text-sm placeholder:text-[var(--muted)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20";

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-6">Settings</h1>

      <nav className="mb-6 flex gap-2 overflow-x-auto pb-1" aria-label="Settings sections">
        {[
          ["profile", "Profile"],
          ["account-type", "Account type"],
          ["get-paid", "Get paid"],
          ["integrations", "Integrations"],
          ["notifications", "Notifications"],
          ["security", "Security"],
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="surface-card shrink-0 rounded-xl px-3.5 py-2 text-sm font-medium text-[var(--muted)] transition hover:border-indigo-400/40 hover:text-[var(--foreground)]"
          >
            {label}
          </a>
        ))}
      </nav>

      <div id="profile" className="surface-card scroll-mt-6 rounded-2xl p-6 shadow-xl shadow-indigo-500/5">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full brand-gradient-bg" />
          Your profile
        </h2>
        <p className="text-sm text-[var(--muted)] mb-5">
          This is how your name shows up across MemoValet, instead of guessing it from your
          email.
        </p>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label htmlFor="settings-email" className="block text-xs font-medium text-[var(--muted)] mb-1.5">Email</label>
            <input id="settings-email" type="email" value={email} disabled className={`${inputClasses} opacity-60`} />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="settings-first-name" className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                First name
              </label>
              <input
                id="settings-first-name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Maya"
                className={inputClasses}
              />
            </div>
            <div>
              <label htmlFor="settings-last-name" className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                Last name
              </label>
              <input
                id="settings-last-name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Sharma"
                className={inputClasses}
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="brand-gradient-bg text-white font-medium py-2.5 px-5 rounded-xl transition hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
          </button>
        </form>
      </div>

      <div id="account-type" className="surface-card scroll-mt-6 rounded-2xl p-6 shadow-xl shadow-indigo-500/5 mt-6">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full brand-gradient-bg" />
          Account type
        </h2>
        <p className="text-sm text-[var(--muted)] mb-5">
          Personal keeps things simple: notes, reminders and errands. Business adds projects, clients
          and jobs for your team. Switch whenever you like. Your saved work stays available.
        </p>

        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Account type">
          {(
            [
              ["personal", "Personal", "Your own notes, reminders, errands and appointments."],
              ["business", "Business", "Projects, clients, team assignments and meeting actions."],
            ] as [AccountType, string, string][]
          ).map(([value, label, blurb]) => {
            const selected = accountType === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={savingAccountType}
                onClick={() => chooseAccountType(value)}
                className={`rounded-xl border px-4 py-3.5 text-left transition disabled:opacity-70 ${
                  selected
                    ? "border-indigo-400 bg-indigo-400/5 ring-2 ring-indigo-400/20"
                    : "border-[var(--surface-border)] hover:border-indigo-400/40"
                }`}
              >
                <span className="block text-sm font-semibold">{label}</span>
                <span className="mt-0.5 block text-xs leading-5 text-[var(--muted)]">{blurb}</span>
              </button>
            );
          })}
        </div>
        {accountTypeError && (
          <p className="mt-3 text-xs text-red-500 dark:text-red-400">{accountTypeError}</p>
        )}
      </div>

      <div id="get-paid" className="surface-card scroll-mt-6 rounded-2xl p-6 shadow-xl shadow-indigo-500/5 mt-6">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full brand-gradient-bg" />
          Get paid
        </h2>
        <p className="text-sm text-[var(--muted)] mb-5">
          Put a price on a job when you send it. The moment it&apos;s marked done, the customer gets a secure
          Stripe payment link and the money lands in your own Stripe account. Card details never touch MemoValet.
        </p>

        {!stripe.configured ? (
          <p className="rounded-xl border border-[var(--surface-border)] px-4 py-3 text-sm text-[var(--muted)]">
            Payments aren&apos;t switched on for MemoValet yet. Once they are, this is where you connect your Stripe
            account.
          </p>
        ) : stripe.chargesEnabled ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Stripe is connected. You can accept customer payments.
            </span>
            <button
              type="button"
              onClick={connectStripe}
              disabled={connectingStripe}
              className="text-sm font-medium text-[var(--muted)] hover:text-current disabled:opacity-60"
            >
              {connectingStripe ? "Opening…" : "Update Stripe details"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {stripe.connected && (
              <p className="text-sm text-amber-700">
                Complete the remaining details in Stripe before accepting payments.
              </p>
            )}
            <button
              type="button"
              onClick={connectStripe}
              disabled={connectingStripe}
              className="brand-gradient-bg text-white font-medium py-2.5 px-5 rounded-xl transition hover:opacity-90 disabled:opacity-60"
            >
              {connectingStripe ? "Opening Stripe…" : stripe.connected ? "Continue Stripe setup" : "Connect Stripe"}
            </button>
            <p className="text-xs text-[var(--muted)]">
              Takes about five minutes on Stripe&apos;s site. Free to set up; Stripe takes a small fee per payment.
            </p>
          </div>
        )}
        {stripeError && <p className="mt-3 text-xs text-red-500 dark:text-red-400">{stripeError}</p>}
      </div>

      <div className="surface-card rounded-2xl p-6 shadow-xl shadow-indigo-500/5 mt-6">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full brand-gradient-bg" />
          Account
        </h2>
        <p className="text-sm text-[var(--muted)] mb-5">The basics about your account.</p>

        <div className="space-y-2.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[var(--muted)]">Signed in with</span>
            <span className="font-medium">{signInMethod}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--muted)]">Member since</span>
            <span className="font-medium">{formatMemberSince(createdAt)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--muted)]">Product tour</span>
            <button
              type="button"
              onClick={retakeTour}
              disabled={restartingTour}
              className="text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:opacity-80 disabled:opacity-60"
            >
              {restartingTour ? "Loading…" : "Retake the tour"}
            </button>
          </div>
        </div>
      </div>

      <div id="integrations" className="surface-card scroll-mt-6 rounded-2xl p-6 shadow-xl shadow-indigo-500/5 mt-6">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full brand-gradient-bg" />
          Connected accounts
        </h2>
        <p className="text-sm text-[var(--muted)] mb-5">
          Connections are separate from the method you use to sign in and only grant the permissions needed
          for that destination.
        </p>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--surface-border)] px-4 py-3">
          <div className="flex items-center gap-3">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${googleConnected ? "bg-emerald-500" : "border border-[var(--surface-border)]"}`}
            />
            <div>
              <p className="text-sm font-medium">Google</p>
              <p className="text-xs text-[var(--muted)]">
                {googleConnected ? "Connected" : "Not connected"}
              </p>
              {googleNotice && <p role="alert" className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">{googleNotice}</p>}
              {/* Connecting goes through Google sign-in, which can only attach to
                  this account when the emails match; a different Google account
                  signs in separately instead of connecting here. */}
              {!googleConnected && email && (
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  Use the Google account for <span className="font-medium text-[var(--foreground)]">{email}</span>
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={connectGoogle}
            disabled={connectingGoogle}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--surface-border)] hover:border-indigo-400/40 hover:bg-indigo-400/5 transition disabled:opacity-60 shrink-0"
          >
            {connectingGoogle ? "Redirecting…" : googleConnected ? "Reconnect" : "Connect"}
          </button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <IntegrationStatusRow
            name="Microsoft Teams"
            description="Join and import by Teams link"
            status="coming"
          />
          <div className="rounded-xl border border-[var(--surface-border)] px-4 py-3">
            <p className="text-sm font-medium">Trello</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {trello.connected ? `Connected as ${trello.member}` : "Turn each action item into a card on your own board."}
            </p>
            {trello.notice && <p role="alert" className="mt-2 text-xs text-amber-700">{trello.notice}</p>}
            {trello.connected && <TrelloListPicker current={trello.listLabel} />}
            {trello.configured ? (
              !trello.connected && <a className="mt-2 inline-block text-xs font-semibold text-violet-600" href="/api/integrations/trello/connect">Connect Trello</a>
            ) : (
              <p className="mt-2 text-xs text-[var(--muted)]">Available after MemoValet’s Trello app is configured.</p>
            )}
            {trello.connected && <form action="/api/integrations/trello/disconnect" method="post"><button className="mt-2 text-xs text-red-700" type="submit">Disconnect from MemoValet</button></form>}
          </div>
          <div className="rounded-xl border border-[var(--surface-border)] px-4 py-3">
            <p className="text-sm font-medium">Slack</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{slackLabel || "Connect your own workspace and choose the channel that receives exports."}</p>
            {slackNotice && <p role="alert" className="mt-2 text-xs text-amber-700">{slackNotice}</p>}
            {slackConfigured ? <a className="mt-2 inline-block text-xs font-semibold text-violet-600" href="/api/integrations/slack/connect">{integrationStatus.slack ? "Change workspace or channel" : "Connect Slack"}</a> : <p className="mt-2 text-xs text-[var(--muted)]">Available after MemoValet’s Slack app is configured.</p>}
            {integrationStatus.slack && <form action="/api/integrations/slack/disconnect" method="post"><button className="mt-2 text-xs text-red-700" type="submit">Disconnect from MemoValet</button></form>}
          </div>
          <div className="rounded-xl border border-[var(--surface-border)] px-4 py-3">
            <p className="text-sm font-medium">Notion</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {notion.connected && notion.label
                ? `Saving to ${notion.label}`
                : "While connecting, tick one page. Each meeting is saved as a page inside it."}
            </p>
            {notion.notice && <p role="alert" className="mt-2 text-xs text-amber-700">{notion.notice}</p>}
            {notion.configured ? (
              <a className="mt-2 inline-block text-xs font-semibold text-violet-600" href="/api/integrations/notion/connect">
                {!notion.connected ? "Connect Notion" : notion.needsPage ? "Connect again and share a page" : "Change page"}
              </a>
            ) : (
              <p className="mt-2 text-xs text-[var(--muted)]">Available after MemoValet’s Notion app is configured.</p>
            )}
            {notion.connected && <form action="/api/integrations/notion/disconnect" method="post"><button className="mt-2 text-xs text-red-700" type="submit">Disconnect from MemoValet</button></form>}
          </div>
        </div>
      </div>

      <div id="notifications" className="surface-card scroll-mt-6 rounded-2xl p-6 shadow-xl shadow-indigo-500/5 mt-6">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full brand-gradient-bg" />
          Notifications
        </h2>
        <p className="text-sm text-[var(--muted)] mb-5">
          Choose which notifications and reminder emails you receive{savingPrefs ? " (saving…)" : ""}.
        </p>

        <div className="space-y-1.5">
          {prefsError && <p role="alert" className="mb-3 text-sm text-red-600">{prefsError}</p>}
          {NOTIFICATION_TOGGLES.map((t) => {
            const checked = notificationPrefs[t.key] !== false;
            return (
              <label
                key={t.key}
                className="flex items-center justify-between rounded-xl border border-[var(--surface-border)] px-3 py-2.5 text-sm cursor-pointer transition hover:border-indigo-400/40"
              >
                <span>{t.label}</span>
                <span
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                    checked ? "brand-gradient-bg" : "bg-[var(--surface-border)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => toggleNotificationPref(t.key, e.target.checked)}
                    className="sr-only"
                  />
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                      checked ? "translate-x-[18px]" : "translate-x-[3px]"
                    }`}
                  />
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div id="security" className="surface-card scroll-mt-6 rounded-2xl p-6 shadow-xl shadow-indigo-500/5 mt-6">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full brand-gradient-bg" />
          Account verification
        </h2>
        <p className="text-sm text-[var(--muted)] mb-5">
          Use Google Authenticator, Microsoft Authenticator or Authy for an extra six-digit code
          after login. It protects your whole MemoValet workspace, including documents and recordings.
        </p>

        {mfaLoading ? (
          <p className="text-sm text-[var(--muted)]">Checking…</p>
        ) : enrolling ? (
          <form onSubmit={confirmEnroll} className="space-y-3">
            <p className="text-sm">Scan this with your authenticator app:</p>
            {qrCode && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrCode}
                alt="Scan this QR code with your authenticator app"
                className="h-40 w-40 rounded-xl border border-[var(--surface-border)] bg-white p-2"
              />
            )}
            {secret && (
              <p className="text-xs text-[var(--muted)]">
                Can&apos;t scan? Enter this code manually:{" "}
                <span className="font-mono text-[var(--foreground)]">{secret}</span>
              </p>
            )}
            <div>
              <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                Enter the 6-digit code it shows
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={enrollCode}
                onChange={(e) => setEnrollCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className={`${inputClasses} tracking-[0.4em] text-center`}
              />
            </div>
            {enrollError && (
              <p className="text-xs text-red-500 dark:text-red-400">{enrollError}</p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={enrollSubmitting || enrollCode.length !== 6}
                className="brand-gradient-bg text-white font-medium py-2.5 px-5 rounded-xl transition hover:opacity-90 disabled:opacity-60"
              >
                {enrollSubmitting ? "Confirming…" : "Confirm and turn on"}
              </button>
              <button
                type="button"
                onClick={cancelEnroll}
                className="text-sm font-medium text-[var(--muted)] hover:text-current transition px-2"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : activeFactorId ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              Additional verification is enabled
            </p>
            <button
              type="button"
              onClick={turnOff}
              disabled={unenrolling}
              className="text-xs font-medium text-red-500 dark:text-red-400 hover:opacity-80 disabled:opacity-60 shrink-0"
            >
              {unenrolling ? "Turning off…" : "Turn off"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEnroll}
            className="font-medium py-2.5 px-5 rounded-xl border border-[var(--surface-border)] transition hover:border-indigo-400/40 hover:bg-indigo-400/5"
          >
            Add authenticator app
          </button>
        )}
      </div>
    </div>
  );
}

function IntegrationStatusRow({
  name,
  description,
  status,
}: {
  name: string;
  description: string;
  status: "connected" | "workspace" | "coming";
}) {
  const label =
    status === "connected"
      ? "Connected"
      : status === "workspace"
        ? "Workspace setup needed"
        : "Coming next";

  return (
    <div className="rounded-xl border border-[var(--surface-border)] px-4 py-3">
      <div className="flex items-start gap-3">
        <span
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
            status === "connected" ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
          }`}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium">{name}</p>
          <p className="mt-0.5 text-xs leading-5 text-[var(--muted)]">{description}</p>
          <p
            className={`mt-1 text-[10px] font-semibold ${
              status === "connected"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-[var(--muted)]"
            }`}
          >
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}
