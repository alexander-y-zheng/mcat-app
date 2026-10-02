import { useEffect, useState } from 'react'
import './App.css'
import { collection, query, limit, getDocs } from 'firebase/firestore'
import { ImportButton } from './components/ImportButton'
import { ReviewSession } from './components/ReviewSession'
import { db, auth } from './lib/firebase'

function App() {
  const [hasDeck, setHasDeck] = useState(false)
  // Bumped every time an import finishes. ReviewSession only loads due cards once, when it
  // first mounts — so re-importing (e.g. a second deck, or the same deck again) wouldn't
  // otherwise refresh an already-mounted session. Passing this as ReviewSession's `key` forces
  // React to throw away the old instance and mount a fresh one, which re-runs its due-cards query.
  const [importVersion, setImportVersion] = useState(0)

  async function checkForDeck() {
    const uid = auth.currentUser.uid
    // We only need to know whether *any* card exists, not how many — limit(1) keeps this
    // cheap (one document read) regardless of how large the deck ends up being.
    const cardsQuery = query(collection(db, 'users', uid, 'cards'), limit(1))
    const snapshot = await getDocs(cardsQuery)
    setHasDeck(!snapshot.empty)
  }

  function handleImported() {
    checkForDeck()
    setImportVersion((v) => v + 1)
  }

  // This duplicates checkForDeck's logic rather than calling it directly. React's linter
  // only considers a state update "traceable" (and therefore safe) when it happens lexically
  // inside the effect itself — calling out to an external function that happens to setState
  // gets flagged as a possible cause of extra re-renders, even though it's fine here.
  useEffect(() => {
    let cancelled = false
    const uid = auth.currentUser.uid
    const cardsQuery = query(collection(db, 'users', uid, 'cards'), limit(1))
    getDocs(cardsQuery).then((snapshot) => {
      if (!cancelled) setHasDeck(!snapshot.empty)
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
