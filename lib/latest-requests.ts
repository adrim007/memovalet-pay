/** Own the lifetime of requests whose older results must never replace newer UI. */
export class LatestRequests {
  private jobs = new Map<string, { controller: AbortController; timer: ReturnType<typeof setTimeout> }>();

  begin(key: string, timeoutMs = 15000) {
    this.cancel(key);
    const controller = new AbortController();
    const job = { controller, timer: setTimeout(() => controller.abort(), timeoutMs) };
    this.jobs.set(key, job);
    return {
      signal: controller.signal,
      isCurrent: () => this.jobs.get(key) === job,
      finish: () => {
        clearTimeout(job.timer);
        if (this.jobs.get(key) === job) this.jobs.delete(key);
      },
    };
  }

  cancel(key: string) {
    const job = this.jobs.get(key);
    if (!job) return;
    this.jobs.delete(key);
    clearTimeout(job.timer);
    job.controller.abort();
  }

  cancelAll() {
    for (const key of this.jobs.keys()) this.cancel(key);
  }
}
