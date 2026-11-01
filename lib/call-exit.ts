/** Begin independent shutdown work without making media disconnection await it. */
export function beginCallExit(stopRecording: () => Promise<void>, disconnect: () => void,
  closeRoom: () => Promise<void>) {
  let stopping: Promise<void>;
  try { stopping = stopRecording(); } catch (error) { stopping = Promise.reject(error); }
  const recording = stopping.then(() => null, error => error as Error);
  disconnect();
  const closing = Promise.resolve().then(closeRoom).then(() => null, error => error as Error);
  return { recording, closing };
}
