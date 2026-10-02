import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, setDoc, addDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { schedule } from '../lib/scheduler';
import { useKeybindings } from '../hooks/useKeybindings';
import { ReviewCard } from './ReviewCard';

export function ReviewSession() {
  const [queue, setQueue] = useState(null); // null = still loading
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const uid = auth.currentUser.uid;

    async function loadDueCards() {
      const now = Date.now();
      // A card counts as "due" once its scheduled due timestamp has passed — this is also
      // how a freshly imported card (due = import time, i.e. already in the past) ends up
      // in the first review session right away.
      const dueQuery = query(collection(db, 'users', uid, 'cards'), where('due', '<=', now));
      const dueCardsSnapshot = await getDocs(dueQuery);
      const dueCards = dueCardsSnapshot.docs.map((docSnap) => docSnap.data());

      // Pair each due card with its note so ReviewCard has front/back text to show. We load
      // *all* notes in one query and look them up from a Map, rather than fetching one note
      // document at a time per due card — with a large deck (thousands of due cards), firing
      // off thousands of individual reads would be far slower and heavier than one bulk query.
      const allNotesSnapshot = await getDocs(collection(db, 'users', uid, 'notes'));
      const noteById = new Map(allNotesSnapshot.docs.map((docSnap) => [docSnap.id, docSnap.data()]));
      const withNotes = dueCards
        .map((card) => ({ card, note: noteById.get(String(card.noteId)) }))
        .filter((pair) => pair.note);

      if (cancelled) return;
      setQueue(withNotes);
      setIndex(0);
      setShowAnswer(false);
    }

    loadDueCards();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRate(rating) {
    if (!showAnswer || !queue || index >= queue.length) return;

    const { card } = queue[index];
    const updates = schedule(card, rating);
    // Spread card first, then updates on top: keeps id/noteId/deckId/qfmt/afmt etc. as they
    // were, while interval/easeFactor/due get overwritten with the freshly scheduled values.
    const updatedCard = { ...card, ...updates };

    const uid = auth.currentUser.uid;
    // `cards` holds current state, so this overwrites the old document (fast lookups for
    // "what's due now"). `reviewEvents` is append-only history, so this always adds a new
    // document (with an auto-generated id, via addDoc) rather than overwriting anything —
    // see the invariant noted in db.js from Stage 1, which still applies here.
    await setDoc(doc(db, 'users', uid, 'cards', String(card.id)), updatedCard);
    await addDoc(collection(db, 'users', uid, 'reviewEvents'), {
      cardId: card.id,
      rating,
      reviewedAt: Date.now(),
    });

    setShowAnswer(false);
    setIndex((i) => i + 1);
  }

  if (queue === null) return <div className="session-state" role="status"><span className="loading-spinner" />Loading…</div>;
  if (queue.length === 0) return <div className="session-state is-complete"><span className="state-symbol">✓</span><p>No cards due. Nice work!</p></div>;
  if (index >= queue.length) return <div className="session-state is-complete"><span className="state-symbol">✓</span><p>Session complete!</p></div>;

  const { card, note } = queue[index];

  return (
    <ReviewSessionActive
      card={card}
      note={note}
      index={index}
      queueLength={queue.length}
      showAnswer={showAnswer}
      setShowAnswer={setShowAnswer}
      handleRate={handleRate}
    />
  );
}

// Keeps useKeybindings scoped to the active review screen only, so it isn't
// registered during loading/empty/complete states above.
function ReviewSessionActive({ card, note, index, queueLength, showAnswer, setShowAnswer, handleRate }) {
  const onShowAnswer = () => setShowAnswer(true);

  useKeybindings({
    onShowAnswer,
    onRate: handleRate,
  });

  // Passing the same onShowAnswer/handleRate used for keybindings down to ReviewCard's
  // on-screen buttons, so a click and the matching keypress trigger the exact same handler.
  return (
    <section className="review-session" aria-label="Review session">
      <div className="review-session-heading">
        <div>
          <p className="eyebrow">IN PROGRESS</p>
          <h2>Review session</h2>
        </div>
        <span className="review-progress">{String(index + 1).padStart(2, '0')} <span>/ {String(queueLength).padStart(2, '0')}</span></span>
      </div>
      <div className="progress-track" aria-hidden="true">
        <span style={{ width: `${(index / queueLength) * 100}%` }} />
      </div>
      <ReviewCard
        note={note}
        qfmt={card.qfmt}
        afmt={card.afmt}
        showAnswer={showAnswer}
        onShowAnswer={onShowAnswer}
        onRate={handleRate}
      />
    </section>
  );
}
