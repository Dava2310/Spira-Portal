/**
 * Turns an API error into one thrown `Error` carrying a message worth showing.
 *
 * The API returns `{ message, error, statusCode }`, and `message` is a **string or
 * an array of strings** — the ValidationPipe runs with `forbidNonWhitelisted`, so a
 * rejected body comes back as a list like `["property foo should not exist"]`.
 * Joining them is the difference between a readable message and "[object Object]".
 * @param error Whatever axios rejected with.
 * @param defaultMessage Shown when the response carries nothing usable.
 */
export function throwError(error: unknown, defaultMessage?: string): never {
  throw new Error(extractMessage(error, defaultMessage));
}

/**
 * Pulls the most specific message available out of an API error.
 * @param error Whatever axios rejected with.
 * @param defaultMessage Fallback when the response carries nothing usable.
 * @returns A message suitable for display.
 */
export function extractMessage(
  error: unknown,
  defaultMessage?: string,
): string {
  const fallback = defaultMessage ?? 'An unexpected error occurred.';

  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const response = (error as { response?: { data?: unknown } }).response;
  const data = response?.data as { message?: unknown } | undefined;
  const message = data?.message;

  if (typeof message === 'string' && message.length > 0) {
    return message;
  }

  if (Array.isArray(message) && message.length > 0) {
    return message.filter((part) => typeof part === 'string').join('. ');
  }

  // No response body at all usually means the request never arrived: the API is
  // asleep (Render cold start), or the network is down. Say so rather than
  // reporting a generic failure.
  if (!response) {
    const axiosMessage = (error as { message?: string }).message;

    return axiosMessage
      ? `Could not reach the server. ${axiosMessage}`
      : 'Could not reach the server.';
  }

  return fallback;
}

/**
 * Reads the HTTP status off an API error, for callers that branch on it —
 * notably the 409 a claim returns when a lot was taken first.
 * @param error Whatever axios rejected with.
 * @returns The status code, or undefined when the request never got a response.
 */
export function statusOf(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  return (error as { response?: { status?: number } }).response?.status;
}
