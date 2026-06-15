/**
 * Toast helper for portals. Employee routes stay quiet; admin/super-admin show Sonner toasts.
 */
import { toast as sonnerToast } from 'sonner';

function isAdminPortal(): boolean {
  if (typeof window === 'undefined') return true;
  return /^\/(admin|super-admin)(\/|$)/.test(window.location.pathname);
}

// Infer actual return types from sonner toast methods
type SuccessFn = typeof sonnerToast.success;
type ErrorFn = typeof sonnerToast.error;
type InfoFn = typeof sonnerToast.info;
type WarningFn = typeof sonnerToast.warning;
type MessageFn = typeof sonnerToast.message;
type LoadingFn = typeof sonnerToast.loading;
type PromiseFn = typeof sonnerToast.promise;
type DismissFn = typeof sonnerToast.dismiss;
type CustomFn = typeof sonnerToast.custom;

// Wrapper that preserves actual return types
function adminOnly<T extends (...args: any[]) => any>(fn: T): T {
  return ((...args: Parameters<T>) => (isAdminPortal() ? fn(...args) : undefined)) as T;
}

export const toast = Object.assign(
  (...args: unknown[]) => (isAdminPortal() ? sonnerToast(...(args as Parameters<typeof sonnerToast>)) : undefined),
  {
    success: adminOnly(sonnerToast.success.bind(sonnerToast) as SuccessFn),
    error: adminOnly(sonnerToast.error.bind(sonnerToast) as ErrorFn),
    info: adminOnly(sonnerToast.info.bind(sonnerToast) as InfoFn),
    warning: adminOnly(sonnerToast.warning.bind(sonnerToast) as WarningFn),
    message: adminOnly(sonnerToast.message.bind(sonnerToast) as MessageFn),
    loading: adminOnly(sonnerToast.loading.bind(sonnerToast) as LoadingFn),
    promise: adminOnly(sonnerToast.promise.bind(sonnerToast) as PromiseFn),
    dismiss: adminOnly(sonnerToast.dismiss.bind(sonnerToast) as DismissFn),
    custom: adminOnly(sonnerToast.custom.bind(sonnerToast) as CustomFn),
  }
);
