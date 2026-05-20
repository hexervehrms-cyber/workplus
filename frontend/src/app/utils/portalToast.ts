/**
 * Toast helper for portals. Employee routes stay quiet; admin/super-admin show Sonner toasts.
 */
import { toast as sonnerToast } from 'sonner';

type ToastFn = (...args: unknown[]) => unknown;

function isAdminPortal(): boolean {
  if (typeof window === 'undefined') return true;
  return /^\/(admin|super-admin)(\/|$)/.test(window.location.pathname);
}

const noop: ToastFn = () => undefined;

function adminOnly<T extends ToastFn>(fn: T): T {
  return ((...args: unknown[]) => (isAdminPortal() ? fn(...args) : undefined)) as T;
}

export const toast = Object.assign(adminOnly(noop), {
  success: adminOnly(sonnerToast.success.bind(sonnerToast)),
  error: adminOnly(sonnerToast.error.bind(sonnerToast)),
  info: adminOnly(sonnerToast.info.bind(sonnerToast)),
  warning: adminOnly(sonnerToast.warning.bind(sonnerToast)),
  message: adminOnly(sonnerToast.message.bind(sonnerToast)),
  loading: (...args: unknown[]) => (isAdminPortal() ? sonnerToast.loading(...(args as Parameters<typeof sonnerToast.loading>)) : ''),
  promise: <T>(promise: Promise<T>, ...args: unknown[]) =>
    isAdminPortal()
      ? sonnerToast.promise(promise, ...(args as Parameters<typeof sonnerToast.promise> extends [Promise<T>, ...infer R] ? R : never))
      : promise,
  dismiss: adminOnly(sonnerToast.dismiss.bind(sonnerToast)),
  custom: adminOnly(sonnerToast.custom.bind(sonnerToast)),
});
