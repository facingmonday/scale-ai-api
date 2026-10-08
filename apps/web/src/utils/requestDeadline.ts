export const REQUEST_DEADLINE_MS = 30_000;

export class RequestTimeoutError extends Error {
  constructor() {
    super("The request timed out. Check your connection and try again.");
    this.name = "RequestTimeoutError";
  }
}

// Includes token acquisition, which does not itself accept an AbortSignal.
// Racing the promise releases the UI; checking the signal prevents late writes.
export function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException("Cancelled", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

export async function withRequestDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  parentSignal?: AbortSignal,
  timeoutMs = REQUEST_DEADLINE_MS,
): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort(parentSignal?.reason);
  parentSignal?.addEventListener("abort", cancel, { once: true });
  if (parentSignal?.aborted) cancel();
  const timer = setTimeout(() => controller.abort(new RequestTimeoutError()), timeoutMs);
  try {
    controller.signal.throwIfAborted();
    return await abortable(operation(controller.signal), controller.signal);
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", cancel);
  }
}
