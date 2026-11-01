"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Google's Identity Services, loaded from their CDN at runtime.
interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: { credential: string }) => void;
        nonce?: string;
        auto_select?: boolean;
        cancel_on_tap_outside?: boolean;
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: {
          type?: "standard" | "icon";
          theme?: "outline" | "filled_blue" | "filled_black";
          size?: "large" | "medium" | "small";
          text?: "signin_with" | "signup_with" | "continue_with";
          shape?: "rectangular" | "pill";
          logo_alignment?: "left" | "center";
          width?: number;
        }
      ) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

const GIS_SRC = "https://accounts.google.com/gsi/client";

// Google hashes the nonce it receives; Supabase verifies against the raw one.
async function makeNonce() {
  const raw = crypto.randomUUID();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { raw, hashed };
}

/**
 * Signs in with Google *on this domain*.
 *
 * The previous approach handed the whole handshake to Supabase, which meant
 * Google's account chooser said "to continue to <project>.supabase.co" — the
 * raw database address, which looks like a phishing page to anyone who reads
 * it. Here the browser gets an ID token on memovalet.com and only passes that
 * token to Supabase, so Google shows this site instead.
 *
 * If Google's script is blocked or the client id is missing, this falls back
 * to the old redirect flow so signing in never becomes impossible.
 */
export default function GoogleSignInButton({
  next,
  onError,
  className = "",
}: {
  next: string;
  onError: (message: string) => void;
  className?: string;
}) {
  const router = useRouter();
  const holderRef = useRef<HTMLDivElement>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  // No client id means Google's own button can never render, so start in
  // fallback rather than switching to it from inside an effect.
  const [useFallback, setUseFallback] = useState(!clientId);
  const [busy, setBusy] = useState(false);

  // The original redirect flow, kept as a safety net.
  const fallbackSignIn = useCallback(async () => {
    setBusy(true);
    onError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/auth/callback?next=" + encodeURIComponent(next) },
    });
    if (error) {
      onError("Couldn't start signing you in. Try again.");
      setBusy(false);
    }
  }, [next, onError]);

  useEffect(() => {
    if (!clientId) return;

    let cancelled = false;

    const start = async () => {
      const holder = holderRef.current;
      if (!holder || !window.google) return;

      const { raw, hashed } = await makeNonce();
      if (cancelled) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        nonce: hashed,
        auto_select: false,
        cancel_on_tap_outside: true,
        callback: async (response) => {
          setBusy(true);
          onError("");
          try {
            const supabase = createClient();
            const { error } = await supabase.auth.signInWithIdToken({
              provider: "google",
              token: response.credential,
              nonce: raw,
            });
            if (error) {
              onError("Couldn't sign you in with Google. Try the email option.");
              setBusy(false);
              return;
            }
            router.push(next);
            router.refresh();
          } catch {
            onError("Couldn't sign you in with Google. Try the email option.");
            setBusy(false);
          }
        },
      });

      holder.innerHTML = "";
      window.google.accounts.id.renderButton(holder, {
        type: "standard",
        theme: "filled_black",
        size: "large",
        text: "continue_with",
        shape: "pill",
        logo_alignment: "left",
        width: Math.min(Math.round(holder.getBoundingClientRect().width) || 320, 400),
      });
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (window.google) {
      void start();
    } else if (existing) {
      existing.addEventListener("load", () => void start());
      existing.addEventListener("error", () => setUseFallback(true));
    } else {
      const script = document.createElement("script");
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => void start();
      script.onerror = () => setUseFallback(true);
      document.head.appendChild(script);
    }

    // If Google's script is blocked (ad blockers, strict networks), don't
    // leave the user staring at an empty space.
    const timer = setTimeout(() => {
      if (!cancelled && !window.google) setUseFallback(true);
    }, 5000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [clientId, next, onError, router]);

  if (useFallback) {
    return (
      <button
        type="button"
        onClick={fallbackSignIn}
        disabled={busy}
        className={`w-full rounded-xl border border-white/20 bg-white/[0.04] py-2.5 text-base font-medium transition hover:border-indigo-400/40 hover:bg-indigo-400/10 disabled:opacity-60 ${className}`}
      >
        {busy ? "Redirecting…" : "Continue with Google"}
      </button>
    );
  }

  return (
    <div className={`flex w-full justify-center ${className}`}>
      <div
        ref={holderRef}
        className="w-full overflow-hidden rounded-xl [color-scheme:light]"
        aria-busy={busy}
      />
    </div>
  );
}
