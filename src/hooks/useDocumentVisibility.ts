import { useEffect, useState } from 'react';

export function useDocumentVisibility() {
  const [isHidden, setIsHidden] = useState<boolean>(() =>
    typeof document !== 'undefined' ? document.hidden : false
  );

  useEffect(() => {
    const onChange = () => setIsHidden(document.hidden);
    document.addEventListener('visibilitychange', onChange);
    onChange();

    return () => {
      document.removeEventListener('visibilitychange', onChange);
    };
  }, []);

  return { isHidden };
}
