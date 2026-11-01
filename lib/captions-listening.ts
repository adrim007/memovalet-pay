/**
 * Whether this device should be listening for captions.
 *
 * This existed only as a button before — one that the call page never rendered,
 * so on a real call nothing ever listened and live translation sat on "Waiting
 * for speech…" for the whole meeting. Written out here so the rule is something
 * that can be read and tested, rather than a control someone has to find.
 */
export function shouldListen(state: {
  /** The demo page, with nothing real behind it. */
  previewMode?: boolean;
  /** The transcript view, which has its own "Start the meeting" button. */
  embedded?: boolean;
  joined: boolean;
  ended?: boolean;
  left?: boolean;
  callClosed?: boolean;
  /** A muted microphone has nothing to caption. */
  micEnabled: boolean;
  /** Captions can hear this device: the browser's own recognition, or MemoValet's. */
  recordingSupported: boolean;
}): boolean {
  if (state.previewMode || state.embedded) return false;
  if (!state.joined || state.ended || state.left || state.callClosed) return false;
  return state.micEnabled && state.recordingSupported;
}
