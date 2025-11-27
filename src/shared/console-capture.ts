/**
 * Console capture utility for streaming output
 * Intercepts console.log/info/warn/error and forwards to callback
 */

export type ConsoleLineType = "info" | "success" | "error" | "warning" | "default";

export type ConsoleCaptureCallback = (content: string, type: ConsoleLineType) => void;

export class ConsoleCapture {
  private originalLog: typeof console.log;
  private originalInfo: typeof console.info;
  private originalWarn: typeof console.warn;
  private originalError: typeof console.error;
  private callback: ConsoleCaptureCallback;
  private isCapturing = false;

  constructor(callback: ConsoleCaptureCallback) {
    this.callback = callback;
    this.originalLog = console.log;
    this.originalInfo = console.info;
    this.originalWarn = console.warn;
    this.originalError = console.error;
  }

  start() {
    if (this.isCapturing) return;
    this.isCapturing = true;

    const self = this;

    console.log = (...args: any[]) => {
      const message = args.join(" ");

      // Detect type from message content
      let type: ConsoleLineType = "default";
      if (message.includes("✓") || message.toLowerCase().includes("success")) {
        type = "success";
      } else if (message.includes("✗") || message.toLowerCase().includes("error") || message.toLowerCase().includes("failed")) {
        type = "error";
      } else if (message.includes("⚠") || message.toLowerCase().includes("warning") || message.toLowerCase().includes("warn")) {
        type = "warning";
      } else if (message.startsWith("[") || message.includes("...")) {
        type = "info";
      }

      self.callback(message, type);
      // Also output to original console (optional, can be removed)
      // self.originalLog(...args);
    };

    console.info = (...args: any[]) => {
      self.callback(args.join(" "), "info");
    };

    console.warn = (...args: any[]) => {
      self.callback(args.join(" "), "warning");
    };

    console.error = (...args: any[]) => {
      self.callback(args.join(" "), "error");
    };
  }

  stop() {
    if (!this.isCapturing) return;
    this.isCapturing = false;

    console.log = this.originalLog;
    console.info = this.originalInfo;
    console.warn = this.originalWarn;
    console.error = this.originalError;
  }

  isActive() {
    return this.isCapturing;
  }
}

/**
 * Helper to run a function with console capture
 */
export async function withConsoleCapture<T>(
  fn: () => Promise<T>,
  onLine: ConsoleCaptureCallback
): Promise<T> {
  const capture = new ConsoleCapture(onLine);

  try {
    capture.start();
    const result = await fn();
    return result;
  } finally {
    capture.stop();
  }
}
