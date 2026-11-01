/** Coalesce edits while a write is in flight; older writes can never finish last. */
export class SerialSave {
  private latest: string;
  private saved: string;
  private running: Promise<void> | null = null;

  constructor(initial: string, private write: (value: string) => Promise<void>) {
    this.latest = this.saved = initial;
  }
  update(value: string) { this.latest = value; }
  get dirty() { return this.latest !== this.saved; }
  get saving() { return this.running !== null; }
  flush(): Promise<void> {
    if (this.running) return this.running;
    const run = async () => {
      while (this.dirty) {
        const value = this.latest;
        await this.write(value);
        this.saved = value;
      }
    };
    this.running = run().finally(() => { this.running = null; });
    return this.running;
  }
}
