type ThrottleOptions = {
  concurrency?: number;
  minDelayMs?: number;
};

type Task<T> = () => Promise<T>;

export class Throttler {
  readonly concurrency: number;
  readonly minDelayMs: number;
  queue: Array<() => void> = [];
  activeCount = 0;
  lastStartAt = 0;

  constructor(options: ThrottleOptions = {}) {
    this.concurrency = Math.max(1, options.concurrency ?? 4);
    this.minDelayMs = Math.max(0, options.minDelayMs ?? 200);
  }

  async run<T>(task: Task<T>): Promise<T> {
    await this.acquireSlot();
    try {
      return await task();
    } finally {
      this.releaseSlot();
    }
  }

  acquireSlot(): Promise<void> {
    return new Promise((resolve) => {
      const start = async () => {
        this.activeCount += 1;
        await this.enforceDelay();
        resolve();
      };

      if (this.activeCount < this.concurrency) {
        void start();
      } else {
        this.queue.push(start);
      }
    });
  }

  releaseSlot() {
    this.activeCount = Math.max(0, this.activeCount - 1);
    const next = this.queue.shift();
    if (next) {
      void next();
    }
  }

  async enforceDelay() {
    const now = Date.now();
    const waitFor = Math.max(0, this.minDelayMs - (now - this.lastStartAt));
    if (waitFor > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitFor));
    }
    this.lastStartAt = Date.now();
  }
}
