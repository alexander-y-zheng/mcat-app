import { useEffect, useState } from 'react'
import './App.css'
import { ImportButton } from './components/ImportButton'
import { ReviewSession } from './components/ReviewSession'
import { dbPromise } from './lib/db'

function App() {
  const [hasDeck, setHasDeck] = useState(false)
  // Bumped every time an import finishes. ReviewSession only loads due cards once, when it
  // first mounts — so re-importing (e.g. a second deck, or the same deck again) wouldn't
  // otherwise refresh an already-mounted session. Passing this as ReviewSession's `key` forces
  // React to throw away the old instance and mount a fresh one, which re-runs its due-cards query.
  const [importVersion, setImportVersion] = useState(0)

  async function checkForDeck() {
    const db = await dbPromise
    const count = await db.count('cards')
    setHasDeck(count > 0)
  }

  function handleImported() {
    checkForDeck()
    setImportVersion((v) => v + 1)
  }

  // This duplicates checkForDeck's two lines rather than calling it directly. React's linter
  // only considers a state update "traceable" (and therefore safe) when it happens lexically
  // inside the effect itself — calling out to an external function that happens to setState
  // gets flagged as a possible cause of extra re-renders, even though it's fine here.
  useEffect(() => {
    let cancelled = false
    dbPromise
      .then((db) => db.count('cards'))
      .then((count) => {
        if (!cancelled) setHasDeck(count > 0)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="App">
      <ImportButton onImported={handleImported} />
      {hasDeck && <ReviewSession key={importVersion} />}
    </div>
  )
}

export default App
