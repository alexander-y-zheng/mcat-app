import { useEffect, useState } from 'react';
import { dbPromise } from '../lib/db';
import { schedule } from '../lib/scheduler';
import { useKeybindings } from '../hooks/useKeybindings';
import { ReviewCard } from './ReviewCard';

export function ReviewSession() {
  const [queue, setQueue] = useState(null); // null = still loading
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDueCards() {
      const db = await dbPromise;
      const allCards = await db.getAll('cards');
      const now = Date.now();
      // A card counts as "due" once its scheduled due timestamp has passed — this is also
      // how a freshly imported card (due = import time, i.e. already in the past) ends up
      // in the first review session right away.
      const dueCards = allCards.filter((card) => card.due <= now);

      // Pair each due card with its note so ReviewCard has front/back text to show. We load
      // *all* notes in one go and look them up from a Map, rather than calling db.get() once
      // per due card — each db.get() opens its own separate IndexedDB transaction, and with a
      // large deck (thousands of due cards), that was creating thousands of tiny transactions
      // that were slow to flush and ended up delaying the next rating's own transaction.
      const allNotes = await db.getAll('notes');
      const noteById = new Map(allNotes.map((note) => [note.id, note]));
      const withNotes = dueCards
        .map((card) => ({ card, note: noteById.get(card.noteId) }))
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

    const db = await dbPromise;
    const tx = db.transaction(['cards', 'reviewEvents'], 'readwrite');
    // `cards` holds current state, so this overwrites the old record (fast lookups for "what's
    // due now"). `reviewEvents` is append-only history, so this always adds a new row rather
    // than overwriting — see the invariant noted in db.js.
    tx.objectStore('cards').put(updatedCard);
    tx.objectStore('reviewEvents').add({
      cardId: card.id,
      rating,
      reviewedAt: Date.now(),
    });
    await tx.done;

    setShowAnswer(false);
    setIndex((i) => i + 1);
  }

  if (queue === null) return <p>Loading…</p>;
  if (queue.length === 0) return <p>No cards due. Nice work!</p>;
  if (index >= queue.length) return <p>Session complete!</p>;

  const { card, note } = queue[index];

  return (
    <ReviewSessionActive
      card={card}
      note={note}
      showAnswer={showAnswer}
      setShowAnswer={setShowAnswer}
      handleRate={handleRate}
    />
  );
}

// Keeps useKeybindings scoped to the active review screen only, so it isn't
// registered during loading/empty/complete states above.
function ReviewSessionActive({ card, note, showAnswer, setShowAnswer, handleRate }) {
  useKeybindings({
    onShowAnswer: () => setShowAnswer(true),
    onRate: handleRate,
  });

  return <ReviewCard note={note} qfmt={card.qfmt} afmt={card.afmt} showAnswer={showAnswer} />;
}
