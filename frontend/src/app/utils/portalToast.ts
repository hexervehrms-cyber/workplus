/**
 * No-op toast for employee/admin portals — suppresses Sonner popups while
 * keeping existing call sites intact.
 */
type ToastArgs = unknown[];

const noop = (..._args: ToastArgs) => undefined;

export const toast = Object.assign(noop, {
  success: noop,
  error: noop,
  info: noop,
  warning: noop,
  message: noop,
  loading: () => '',
  promise: <T>(promise: Promise<T>) => promise,
  dismiss: noop,
  custom: noop,
});
