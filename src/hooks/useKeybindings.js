import { useEffect } from 'react';

export function useKeybindings({ onShowAnswer, onRate }) {
  useEffect(() => {
    function handler(e) {
      if (e.code === 'Space' || e.code === 'Enter') onShowAnswer();
      if (e.key === '1') onRate('again');
      if (e.key === '2') onRate('hard');
      if (e.key === '3') onRate('good');
      if (e.key === '4') onRate('easy');
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onShowAnswer, onRate]);
}