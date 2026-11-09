import { useEffect } from 'react';

/** Sets the browser tab / history title so every page is identifiable ("Patients · CareBoard"). */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · CareBoard` : 'CareBoard';
  }, [title]);
}
