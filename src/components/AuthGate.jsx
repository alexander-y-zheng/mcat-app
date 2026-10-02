import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
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
    <form onSubmit={handleSubmit}>
      <div>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            required
          />
        </label>
      </div>
      <div>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
            required
          />
        </label>
      </div>
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
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

  if (user === undefined) return <p>Loading…</p>;
  if (user === null) return <SignInForm />;
  return children;
}
