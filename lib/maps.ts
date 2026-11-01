export function mapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

function isAppleTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return true;
  // iPadOS 13+ identifies itself as a Mac but is touch-capable, unlike a real Mac.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

// The <a> keeps a plain Google Maps href as the default (works everywhere,
// including with JS disabled). On an iPhone or iPad, this intercepts the
// click and sends the user to Apple Maps instead, since that's the app
// they actually have set up for turn-by-turn directions.
export function handleMapsClick(location: string) {
  return (e: { preventDefault: () => void }) => {
    if (isAppleTouchDevice()) {
      e.preventDefault();
      window.open(
        `https://maps.apple.com/?q=${encodeURIComponent(location)}`,
        "_blank",
        "noopener,noreferrer"
      );
    }
  };
}
