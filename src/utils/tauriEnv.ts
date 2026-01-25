export const isTauriEnv = () => {
  if (typeof window === 'undefined') return false;
  if ((window as any).__TAURI_INTERNALS__) return true;
  if ((window as any).__TAURI__) return true;
  if (window.location.protocol === 'tauri:') return true;
  if (window.location.protocol === 'https:' && window.location.hostname === 'tauri.localhost') return true;
  return false;
};
