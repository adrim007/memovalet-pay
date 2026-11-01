const COLORS = [
  "bg-indigo-500",
  "bg-fuchsia-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-pink-500",
];

function colorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "xs" }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const dimensionClasses = size === "xs" ? "h-5 w-5 text-[10px]" : "h-7 w-7 text-xs";

  return (
    <span
      className={
        "inline-flex items-center justify-center rounded-full text-white font-semibold shrink-0 " +
        colorForName(name) +
        " " +
        dimensionClasses
      }
    >
      {initial}
    </span>
  );
}
