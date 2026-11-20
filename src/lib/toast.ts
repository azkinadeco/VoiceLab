export type ToastKind = 'success' | 'error' | 'info';

export interface ToastPayload {
  id: number;
  message: string;
  kind: ToastKind;
}

const EVENT = 'voicelab:toast';
let counter = 0;

/** Fire-and-forget toast, rendered by <Toaster /> mounted in the page. */
export function toast(message: string, kind: ToastKind = 'success') {
  if (typeof window === 'undefined') return;
  counter += 1;
  window.dispatchEvent(
    new CustomEvent<ToastPayload>(EVENT, { detail: { id: counter, message, kind } })
  );
}

export const TOAST_EVENT = EVENT;
