/**
 * errorHandler.ts
 *
 * Centralises error handling so that:
 *  - Full error details are always logged to the console for developer debugging.
 *  - Users only ever see a safe, generic message — never raw DB errors, stack
 *    traces, file paths, or Supabase internals.
 */

/**
 * Log the full error with a descriptive context label.
 * Call this inside every catch block.
 *
 * @param context  Short description of the operation that failed, e.g. "save ledger entry"
 * @param error    The caught error (any type)
 */
export function logError(context: string, error: unknown): void {
  // Always log the full detail — visible only in the browser DevTools console.
  console.error(`[ERROR] ${context}:`, error);
}

/**
 * Return a safe, user-friendly message for a failed action.
 * Never includes stack traces, file paths, or database internals.
 *
 * @param action  Short verb phrase describing what failed, e.g. "save entry"
 * @returns       A polite sentence the user can safely see.
 */
export function toUserMessage(action: string): string {
  return `Unable to ${action}. Please try again or contact your administrator if the problem persists.`;
}
