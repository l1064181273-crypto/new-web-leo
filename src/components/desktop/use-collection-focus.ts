import { useCallback, useLayoutEffect, useRef } from "react";

// Restore only focus lost through an explicit, currently focused action.
// Background updates and pointer clicks that did not focus a control must not
// pull the user's focus away from elsewhere in the desktop.
export function useCollectionFocus() {
  const emptyActionRef = useRef<HTMLButtonElement>(null);
  const filterRef = useRef<HTMLButtonElement>(null);
  const pending = useRef<HTMLElement | null>(null);
  const restoreFocus = useCallback(() => {
    const target = emptyActionRef.current ?? filterRef.current;
    if (target?.isConnected) target.focus({ preventScroll: true });
  }, []);
  const rememberFocus = (control: HTMLElement) => {
    pending.current = document.activeElement === control ? control : null;
  };
  useLayoutEffect(() => {
    const control = pending.current;
    pending.current = null;
    if (control && !control.isConnected && document.activeElement === document.body) restoreFocus();
  });
  return { emptyActionRef, filterRef, rememberFocus, restoreFocus };
}
