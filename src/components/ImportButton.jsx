import { useState } from 'react';
import { importApkg } from '../lib/apkgImport';

export function ImportButton({ onImported }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    try {
      await importApkg(file);
      onImported?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      e.target.value = ''; // allow re-selecting the same file later
    }
  }

  return (
    <div>
      {/* Native file inputs can't be styled directly, so the common trick is to hide the
          input itself and let a <label> (which text/clicks forward to its input) act as
          the visible button instead. */}
      <label>
        {isLoading ? 'Importing…' : 'Import .apkg'}
        <input
          type="file"
          accept=".apkg"
          onChange={handleChange}
          disabled={isLoading}
          style={{ display: 'none' }}
        />
      </label>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
