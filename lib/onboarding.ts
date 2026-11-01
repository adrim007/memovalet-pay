export function shouldOfferWelcome(completed: unknown, hasSavedWork: boolean) {
  return completed === false || (completed !== true && !hasSavedWork);
}

export function onboardingStorageKey(userId: string) {
  return `memovalet:welcome:v1:${userId}`;
}

export interface TourRect { top: number; left: number; width: number; height: number }

export function tourPanelPosition(viewport: { width: number; height: number }, panel: { width: number; height: number }, target: TourRect | null) {
  const edge = 16;
  const width = Math.min(panel.width, viewport.width - edge * 2);
  const height = Math.min(panel.height, viewport.height - edge * 2);
  const clamp = (value: number, max: number) => Math.max(edge, Math.min(value, max));
  if (target && (target.top >= viewport.height || target.top + target.height <= 0 || target.left >= viewport.width || target.left + target.width <= 0)) target = null;
  if (target && target.left + target.width + width + 40 <= viewport.width) return {
    left: target.left + target.width + 24,
    top: clamp(target.top - 24, viewport.height - height - edge),
  };
  if (target && target.top + target.height + height + 40 <= viewport.height) return {
    left: clamp(target.left, viewport.width - width - edge),
    top: target.top + target.height + 24,
  };
  if (target && target.left - width - 24 >= edge) return {
    left: target.left - width - 24,
    top: clamp(target.top - 24, viewport.height - height - edge),
  };
  if (target) {
    const above = Math.max(0, target.top - 24 - edge);
    const below = Math.max(0, viewport.height - (target.top + target.height) - 24 - edge);
    const useAbove = above > below;
    const available = Math.max(above, below);
    if (available >= 100) {
      const maxHeight = Math.min(height, available);
      return {
        left: clamp(target.left, viewport.width - width - edge),
        top: useAbove ? target.top - 24 - maxHeight : target.top + target.height + 24,
        maxHeight,
      };
    }
  }
  return { left: (viewport.width - width) / 2, top: Math.max(edge, (viewport.height - height) / 2) };
}
