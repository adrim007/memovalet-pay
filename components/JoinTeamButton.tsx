"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinTeamButton({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const join = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/teams/join/${token}`, { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Couldn't join that group.");
        setLoading(false);
        return;
      }

      router.push(`/dashboard?team=${data.teamId}`);
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  };

  return (
    <div>
      {error && <p className="text-sm text-red-500 dark:text-red-400 mb-3">{error}</p>}
      <button
        onClick={join}
        disabled={loading}
        className="w-full brand-gradient-bg text-white font-medium py-2.5 rounded-xl transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60 shadow-lg shadow-indigo-500/25"
      >
        {loading ? "Joining…" : "Join group"}
      </button>
    </div>
  );
}
