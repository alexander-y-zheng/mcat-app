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
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span className="brand-name">MCAT Review</span>
        </div>
        <span className="topbar-note">PERSONAL STUDY SPACE</span>
      </header>

      <main className="workspace">
        <section className="welcome-block">
          <p className="eyebrow">YOUR STUDY DESK</p>
          <h1>Make room for what you know.</h1>
          <p className="welcome-copy">A quieter place to focus on the next question.</p>
        </section>

        <section className="import-panel" aria-label="Deck library">
          <div className="import-copy">
            <p className="eyebrow">DECK LIBRARY</p>
            <h2>Bring in a deck</h2>
            <p>Keep your study material close at hand.</p>
          </div>
          <ImportButton onImported={handleImported} />
        </section>

        {hasDeck && <ReviewSession key={importVersion} />}
      </main>

      <footer className="app-footer">
        <span>MCAT REVIEW</span>
        <span className="footer-mark" aria-hidden="true">✳</span>
        <span className="tagline">Built for Tiff. Built for 528.</span>
      </footer>
    </div>
  )
}

export default App
