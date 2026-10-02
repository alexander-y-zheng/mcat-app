import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

// Firebase's own sign-in form, not a custom one: this is a single-friend app, so there's no
// sign-up flow — her account is created manually in the Firebase console (see CLAUDE.md), and
// this form only ever needs to sign an already-existing user in.
function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // No need to update any state on success: the onAuthStateChanged listener in AuthGate
      // will fire on its own once Firebase confirms the sign-in, and swap this form out.
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="brand auth-brand">
        <span className="brand-mark" aria-hidden="true">M</span>
        <span className="brand-name">MCAT Review</span>
      </div>
      <section className="auth-panel">
        <p className="eyebrow">WELCOME BACK</p>
        <h1>Your study desk<br />is ready.</h1>
        <p className="auth-copy">Sign in to pick up where you left off.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            required
          />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
            required
          />
        </label>
        <button className="auth-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
        <span aria-hidden="true">→</span>
        </button>
        {error && <p className="form-error" role="alert">{error}</p>}
        </form>
      </section>
      <p className="auth-footnote tagline">Built for Tiff. Built for 528.</p>
    </main>
  );
}

export function AuthGate({ children }) {
  // undefined = Firebase hasn't told us yet whether someone's signed in (checking its own
  // persisted session on startup); null = checked, nobody's signed in; an object = signed in.
  // Keeping "still checking" distinct from "signed out" avoids a flash of the sign-in form
  // for a split second every time the page loads while an already-signed-in session restores.
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return unsubscribe;
  }, []);

  if (user === undefined) return <main className="auth-page auth-loading"><span className="loading-spinner" /><p>Loading…</p></main>;
  if (user === null) return <SignInForm />;
  return (
    <>
      <button
        type="button"
        onClick={() => signOut(auth)}
        style={{ position: 'fixed', top: 8, right: 8, zIndex: 1000 }}
      >
        Sign out
      </button>
      {children}
    </>
  );
}
