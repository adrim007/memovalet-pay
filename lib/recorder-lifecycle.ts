export interface RecordingResult { blob: Blob; warning?: string }

/** Owns finalization, including browsers that never deliver their final stop event. */
export function manageRecorder(recorder: MediaRecorder, cleanup: () => void, onLimit: () => void,
  mimeType: string, timeoutMs = 8000, maxBytes = 450 * 1024 * 1024) {
  const chunks: Blob[] = [];
  let bytes = 0;
  let settled = false;
  let stopRequested = false;
  let warning: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let resolve!: (result: RecordingResult) => void;
  let reject!: (error: Error) => void;
  const finished = new Promise<RecordingResult>((yes, no) => { resolve = yes; reject = no; });
  void finished.catch(() => {});
  const settle = (incomplete = false) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    cleanup();
    if (!bytes) { reject(new Error("The browser returned no recording data. The call can still be ended.")); return; }
    resolve({ blob: new Blob(chunks, { type: mimeType }), warning: incomplete
      ? "The browser did not finish the recording. A partial backup is available; it may not play correctly."
      : warning });
  };
  const stop = () => {
    if (stopRequested || settled) return finished;
    stopRequested = true;
    timer = setTimeout(() => settle(true), timeoutMs);
    try { if (recorder.state !== "inactive") recorder.stop(); }
    catch { settle(true); }
    return finished;
  };
  recorder.addEventListener("dataavailable", event => {
    if (settled) return;
    if (event.data.size) { chunks.push(event.data); bytes += event.data.size; }
    if (bytes > maxBytes && !stopRequested) { void stop(); onLimit(); }
  });
  recorder.addEventListener("error", () => {
    warning = "The browser interrupted the recording. Check the saved backup before relying on it.";
    void stop();
  });
  recorder.addEventListener("stop", () => settle());
  return {
    finished, stop,
    dispose() { void stop(); settle(true); },
  };
}
