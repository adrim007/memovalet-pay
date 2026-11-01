"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin } from "@phosphor-icons/react";
import { fetchAddressSuggestions, type AddressLookupConfig, type AddressSuggestion } from "@/lib/addressSuggest";

// Lookups that worked this visit, so retyping costs nothing. Failed ones aren't kept.
const suggestionCache = new Map<string, AddressSuggestion[]>();
// Set once the server says suggestions aren't set up, so typing stops asking.
let suggestionsOff = false;
// The key and rough location, fetched once per visit when a location box is first used.
let configRequest: Promise<AddressLookupConfig | null> | null = null;

function loadConfig(): Promise<AddressLookupConfig | null> {
  if (!configRequest) {
    configRequest = fetch("/api/address/config")
      .then(async (response) => {
        const data = await response.json();
        if (response.ok && data.enabled === false) {
          suggestionsOff = true;
          return null;
        }
        if (!response.ok || typeof data.key !== "string") {
          // A hiccup rather than "switched off": ask again next time.
          configRequest = null;
          return null;
        }
        return { key: data.key, near: data.near ?? null, country: data.country ?? null, lang: data.lang ?? null };
      })
      .catch(() => {
        configRequest = null;
        return null;
      });
  }
  return configRequest;
}

// Room the list needs below the box before it opens upwards instead.
const LIST_ROOM = 300;

// Earlier suggestions that still contain every word typed since.
function stillMatching(suggestions: AddressSuggestion[], typed: string) {
  const words = typed.split(/\s+/).filter(Boolean);
  return suggestions.filter((suggestion) => {
    const label = suggestion.label.toLowerCase();
    return words.every((word) => label.includes(word));
  });
}

interface ListPlacement {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
}

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  // A suggestion was picked, or Enter pressed without one: the address is settled.
  onCommit?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

// A location box that suggests real addresses as you type, nearest first.
export default function AddressInput({ value, onChange, onCommit, onBlur, placeholder, ariaLabel, className }: AddressInputProps) {
  const listId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [placement, setPlacement] = useState<ListPlacement | null>(null);
  const [latest, setLatest] = useState<{ key: string; suggestions: AddressSuggestion[]; failed: boolean }>({
    key: "",
    suggestions: [],
    failed: false,
  });

  const q = value.trim();
  const key = q.toLowerCase();
  const active = q.length >= 3 && q.length <= 200;

  // Asks when typing pauses for a quarter of a second, which also keeps a fast
  // typist under Geoapify's five lookups a second.
  useEffect(() => {
    if (!active || suggestionsOff || suggestionCache.has(key)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const config = await loadConfig();
      if (controller.signal.aborted) return;
      if (!config) {
        setLatest({ key, suggestions: [], failed: true });
        return;
      }
      const suggestions = await fetchAddressSuggestions(q, {
        apiKey: config.key,
        near: config.near,
        country: config.country,
        lang: config.lang,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (suggestions) suggestionCache.set(key, suggestions);
      setLatest({ key, suggestions: suggestions ?? [], failed: !suggestions });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [active, key, q]);

  const cached = suggestionCache.get(key);
  const on = active && !suggestionsOff;
  // While a lookup runs, earlier suggestions that still fit stay up, narrowing as you type.
  const carried = latest.key && key.startsWith(latest.key) ? stillMatching(latest.suggestions, key) : [];
  const suggestions = on ? cached ?? (latest.key === key ? latest.suggestions : carried) : [];
  const looking = on && !cached && latest.key !== key;
  const menuVisible = open && (suggestions.length > 0 || looking);

  // The list is drawn at the top level of the page, lined up with the box, so
  // cards and buttons further down can't cover it. It follows the box on scroll
  // and opens upwards when there isn't room below.
  useEffect(() => {
    if (!menuVisible) return;
    let frame = 0;
    const place = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = wrapperRef.current?.getBoundingClientRect();
        if (!box) return;
        const upwards = window.innerHeight - box.bottom < LIST_ROOM && box.top > LIST_ROOM;
        setPlacement(
          upwards
            ? { left: box.left, width: box.width, bottom: window.innerHeight - box.top + 6 }
            : { left: box.left, width: box.width, top: box.bottom + 6 }
        );
      });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [menuVisible]);

  const pick = (suggestion: AddressSuggestion) => {
    onChange(suggestion.label);
    setOpen(false);
    setActiveIndex(-1);
    onCommit?.(suggestion.label);
  };

  const list = (
    // Mouse-down inside must not blur the box, or it closes before the click lands.
    <div
      onMouseDown={(event) => event.preventDefault()}
      style={placement ?? undefined}
      className="fixed z-[100] overflow-hidden rounded-xl bg-[var(--surface)] shadow-xl shadow-indigo-500/15 ring-1 ring-[var(--surface-border)]"
    >
      {suggestions.length > 0 ? (
        <>
          <ul id={listId} role="listbox" aria-label="Address suggestions" className="p-1">
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onClick={() => pick(suggestion)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                  index === activeIndex ? "bg-indigo-500/10" : ""
                }`}
              >
                <MapPin size={16} weight="fill" className="mt-0.5 shrink-0 text-indigo-500" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-[var(--foreground)]">{suggestion.main}</span>
                  {suggestion.secondary && <span className="block truncate text-xs text-[var(--muted)]">{suggestion.secondary}</span>}
                </span>
              </li>
            ))}
          </ul>
          {/* Geoapify's free plan asks for this credit wherever its results appear. */}
          <p className="border-t border-[var(--surface-border)] px-3 py-1.5 text-right text-[10px] text-[var(--muted)]">
            Powered by{" "}
            <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              Geoapify
            </a>
          </p>
        </>
      ) : (
        <p id={listId} role="status" className="flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--muted)]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-400" aria-hidden />
          Looking up addresses…
        </p>
      )}
    </div>
  );

  return (
    <div ref={wrapperRef} className="relative min-w-0 flex-1">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={ariaLabel ?? placeholder}
        aria-expanded={menuVisible}
        aria-controls={menuVisible ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={menuVisible && suggestions[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        // The browser's own saved-address dropdown would cover this one.
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setActiveIndex(-1);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          // Fetch the key and location before the first letters arrive.
          void loadConfig();
        }}
        onBlur={() => {
          setOpen(false);
          onBlur?.();
        }}
        onKeyDown={(event) => {
          const count = suggestions.length;
          if (menuVisible && count > 0 && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            setActiveIndex((current) => (event.key === "ArrowDown" ? (current + 1) % count : (Math.min(current, count) - 1 + count) % count));
          } else if (event.key === "Escape" && menuVisible) {
            event.preventDefault();
            setOpen(false);
          } else if (event.key === "Enter") {
            const highlighted = menuVisible ? suggestions[activeIndex] : undefined;
            if (highlighted) {
              event.preventDefault();
              pick(highlighted);
            } else if (onCommit) {
              event.preventDefault();
              onCommit(value);
              inputRef.current?.blur();
            }
          }
        }}
        className={className}
      />
      {menuVisible && placement && createPortal(list, document.body)}
    </div>
  );
}
