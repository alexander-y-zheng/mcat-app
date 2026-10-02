const DAY_MS = 24 * 60 * 60 * 1000;

// The "ease factor" is a multiplier (starts at 2.5 = 250%) that controls how fast a card's
// interval grows once it's past the first couple of reviews. Every wrong answer nudges it
// down, every "easy" nudges it up, so cards you find hard end up reviewed more often than
// cards you find easy, even if they're on the same interval right now.
//
// We floor it at 1.3 so a card that's being rated "hard" over and over can't have its growth
// multiplier shrink toward 1 (or below), which would mean it almost never gets a longer
// interval and ends up reviewed forever at nearly the same (short) spacing.
const MIN_EASE_FACTOR = 1.3;

// Standard SM-2-style scheduling: the rating drives both the next interval and how the
// ease factor drifts. 'again' is treated as a lapse — it resets progress back to a short
// interval instead of just shrinking it, same as a fresh mistake would.
export function schedule(card, rating) {
  const prevInterval = card.interval ?? 0;
  const prevEase = card.easeFactor ?? 2.5;

  if (rating === 'again') {
    // Lapse: start over at a 1-day interval. We also drop the ease factor, since forgetting
    // a card is evidence it needs more frequent review going forward, not just a one-off retry.
    const interval = 1;
    const easeFactor = Math.max(MIN_EASE_FACTOR, prevEase - 0.2);
    return { interval, easeFactor, due: Date.now() + interval * DAY_MS };
  }

  if (rating !== 'hard' && rating !== 'good' && rating !== 'easy') {
    throw new Error(`schedule: unrecognized rating "${rating}"`);
  }

  let interval;

  if (prevInterval === 0) {
    // First time this card has ever been reviewed. There's no prior interval or ease trend
    // to build on, so these are just fixed "graduation" steps: a shaky first answer (hard)
    // gets reviewed again tomorrow, a solid one (good/easy) waits a few days.
    if (rating === 'hard') interval = 1;
    else if (rating === 'good') interval = 3;
    else interval = 4; // easy
  } else if (prevInterval === 1) {
    // Second review. Still too early to trust the ease factor much, so we use slightly
    // larger fixed steps than the first review rather than multiplying by ease yet.
    if (rating === 'hard') interval = 2;
    else if (rating === 'good') interval = 3;
    else interval = 4; // easy
  } else {
    // Mature card: grow the interval using the ease factor, which is what lets cards you
    // consistently find easy stretch out much further over time than cards you find hard.
    let multiplier;
    if (rating === 'hard') multiplier = 1.2; // small, fixed growth regardless of ease
    else if (rating === 'good') multiplier = prevEase; // normal ease-driven growth
    else multiplier = prevEase * 1.3; // easy: grow faster than ease alone would give

    // Rounding can otherwise stall a card: e.g. round(2 * 1.2) rounds back down to 2, so a
    // card rated "hard" over and over would get stuck on a 2-day interval forever. Forcing
    // at least +1 day guarantees every review still moves the card forward, however slowly.
    interval = Math.max(prevInterval + 1, Math.round(prevInterval * multiplier));
  }

  // Nudge the ease factor itself: "hard" makes future growth slower, "easy" makes it
  // faster, "good" leaves it alone since that's the expected/neutral outcome.
  let easeDelta;
  if (rating === 'hard') easeDelta = -0.15;
  else if (rating === 'easy') easeDelta = 0.15;
  else easeDelta = 0; // good
  const easeFactor = Math.max(MIN_EASE_FACTOR, prevEase + easeDelta);

  const due = Date.now() + interval * DAY_MS;

  return { interval, easeFactor, due };
}
