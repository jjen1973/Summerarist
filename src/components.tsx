import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FiHome, FiBookOpen, FiEdit3, FiSearch, FiSettings, FiHelpCircle, FiLogOut, FiLogIn, FiMenu, FiX, FiClock, FiStar } from 'react-icons/fi';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from './firebase';
import { useStore } from './store';
import { searchBooks, type Book, formatTime } from './api';
export const Logo = () => <Link to="/" aria-label="Summarist home"><img className="logo" src="/assets/logo.png" alt="Summarist" /></Link>;
export function Skeleton() { return <div role="status" aria-label="Loading books" className="skeleton-grid">{[0,1,2,3,4].map(x => <div key={x}><div className="skeleton cover-skeleton"/><div className="skeleton line"/><div className="skeleton line short"/></div>)}</div>; }
export function ErrorNotice({ children, retry }: { children: ReactNode; retry?: () => void }) { return <div className="notice" role="alert">{children}{retry && <button className="text-button" onClick={retry}>Try again</button>}</div>; }
export function Duration({ book }: { book: Book }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const audio = new Audio(); audio.preload = 'metadata';
    audio.onloadedmetadata = () => setSeconds(audio.duration); audio.src = book.audioLink;
    return () => { audio.onloadedmetadata = null; audio.removeAttribute('src'); audio.load(); };
  }, [book.audioLink]);
  return <span><FiClock /> {seconds ? formatTime(seconds) : 'Audio'}</span>;
}
export function BookCard({ book }: { book: Book }) { return <Link className="book-card" to={`/book/${book.id}`}><div className="cover-wrap"><img src={book.imageLink} alt={`${book.title} cover`} loading="lazy"/>{book.subscriptionRequired && <span className="pill">Premium</span>}</div><h3>{book.title}</h3><p className="muted">{book.author}</p><p className="subtitle">{book.subTitle}</p><div className="book-meta"><Duration book={book}/><span><FiStar/> {book.averageRating}</span></div></Link>; }
export function BookRow({ title, subtitle, books }: { title: string; subtitle?: string; books: Book[] }) { return <section className="book-section"><h2>{title}</h2>{subtitle && <p className="muted section-description">{subtitle}</p>}<div className="book-row">{books.map(b => <BookCard book={b} key={b.id}/>)}</div></section>; }
function Search({ inputRef }: { inputRef: RefObject<HTMLInputElement | null> }) {
  const [value, setValue] = useState(''); const [results, setResults] = useState<Book[]>([]);
  const [state, setState] = useState(''); const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null); const location = useLocation();
  useEffect(() => { setOpen(false); setValue(''); }, [location.pathname]);
  useEffect(() => { const handler = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler); }, []);
  useEffect(() => {
    if (!value.trim()) { setResults([]); setState(''); return; }
    const controller = new AbortController(); setState('loading');
    const timer = setTimeout(() => { searchBooks(value.trim(), controller.signal).then(data => { if (!controller.signal.aborted) { setResults(data); setState(data.length ? 'done' : 'empty'); } }).catch(() => { if (!controller.signal.aborted) setState('error'); }); }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [value]);
  return <div className="search" ref={root}><FiSearch/><input ref={inputRef} aria-label="Search for books" placeholder="Search for books" value={value} onFocus={() => setOpen(true)} onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }} onChange={e => { setValue(e.target.value); setOpen(true); }}/>{value && <button aria-label="Clear search" onClick={() => setValue('')}><FiX/></button>}{open && value.trim() && <div className="search-results" aria-live="polite">{state === 'loading' ? <p>Searching…</p> : state === 'error' ? <p>Search unavailable. Try again.</p> : state === 'empty' ? <p>No books found. Try another title or author.</p> : results.map(book => <Link to={`/book/${book.id}`} key={book.id}><img src={book.imageLink} alt=""/><span><strong>{book.title}</strong><small>{book.author}</small></span></Link>)}</div>}</div>;
}
export function Layout() {
  const { user, logout, openAuth } = useStore(); const [menu, setMenu] = useState(false); const location = useLocation();
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => { setMenu(false); }, [location.pathname]);
  return <div className="app-shell"><a className="skip-link" href="#main">Skip to content</a>{menu && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMenu(false)}/>}
    <aside className={`sidebar ${menu ? 'is-open' : ''}`}><Logo/><nav aria-label="Main navigation"><NavLink to="/for-you"><FiHome/>For you</NavLink><NavLink to="/library"><FiBookOpen/>My Library</NavLink><button disabled><FiEdit3/>Highlights</button><button onClick={() => { setMenu(false); searchInput.current?.focus(); }}><FiSearch/>Search</button><div className="nav-spacer"/><NavLink to="/settings"><FiSettings/>Settings</NavLink><button disabled><FiHelpCircle/>Help & Support</button><button onClick={() => user ? void logout() : openAuth()}>{user ? <FiLogOut/> : <FiLogIn/>}{user ? 'Logout' : 'Login'}</button></nav><div className="sidebar-note">A little learning.<br/>A big difference.</div></aside>
    <div className="app-body"><header className="app-header"><button className="mobile-menu icon-button" aria-label="Open navigation" aria-expanded={menu} onClick={() => setMenu(!menu)}><FiMenu/></button><Search inputRef={searchInput}/></header><main id="main" className="app-main"><Outlet/></main></div></div>;
}
function friendlyError(error: unknown) {
  const code = (error as { code?: string }).code;
  const messages: Record<string,string> = { 'auth/unauthorized-domain': 'This address needs to be added to Firebase Authentication authorized domains.', 'auth/network-request-failed': 'Could not reach Firebase. Check your connection and try again.', 'auth/invalid-api-key': 'The Firebase connection needs to be checked.', 'auth/invalid-credential': 'Email or password is incorrect.', 'auth/user-not-found': 'No account was found with this email.', 'auth/wrong-password': 'Email or password is incorrect.', 'auth/email-already-in-use': 'An account already uses this email.', 'auth/weak-password': 'Use a password with at least 6 characters.', 'auth/invalid-email': 'Enter a valid email address.', 'auth/popup-closed-by-user': 'Google sign-in was closed. Please try again.', 'auth/operation-not-allowed': 'This sign-in method needs to be enabled in Firebase.', 'auth/too-many-requests': 'Too many attempts. Please try again later.' };
  return messages[code || ''] || (error instanceof Error && !code ? error.message : 'Sign-in could not be completed. Please try again.');
}
export function AuthModal() {
  const { modal, closeAuth, guestLogin } = useStore(); const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login'); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (modal) { setError(''); setMessage(''); dialog.current?.showModal(); } else dialog.current?.close(); }, [modal]);
  async function action(task: () => Promise<unknown>, redirect = true) { setBusy(true); setError(''); setMessage(''); try { await task(); if (redirect) { closeAuth(); navigate('/for-you'); } else setMessage('If an account exists, a reset link has been sent.'); } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); } }
  function requireAuth() { if (!auth) throw new Error('Email accounts need Firebase configuration. You can explore with guest login now.'); return auth; }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const email = String(form.get('email')); const password = String(form.get('password')); void action(() => mode === 'reset' ? sendPasswordResetEmail(requireAuth(), email) : mode === 'register' ? createUserWithEmailAndPassword(requireAuth(), email, password) : signInWithEmailAndPassword(requireAuth(), email, password), mode !== 'reset'); }
  function change(next: typeof mode) { setMode(next); setError(''); setMessage(''); }
  return <dialog ref={dialog} className="auth-modal" onCancel={closeAuth} onClick={e => { if (e.target === e.currentTarget && !busy) closeAuth(); }}><div className="modal-content"><button className="modal-close icon-button" aria-label="Close login" onClick={closeAuth}><FiX/></button><h2>{mode === 'login' ? 'Log in to Summarist' : mode === 'register' ? 'Create your account' : 'Reset your password'}</h2><p className="muted">Your next great idea is a few minutes away.</p>{mode !== 'reset' && <><button className="btn guest-btn" disabled={busy} onClick={() => void action(guestLogin)}>Login as a Guest</button><div className="divider">or</div><button className="btn google-btn" disabled={busy} onClick={() => void action(() => signInWithPopup(requireAuth(), new GoogleAuthProvider()))}><img src="/assets/google.png" alt=""/>Continue with Google</button><div className="divider">or</div></>}<form onSubmit={submit}><label>Email<input name="email" type="email" autoComplete="email" required placeholder="you@example.com"/></label>{mode !== 'reset' && <label>Password<input name="password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 6 : undefined} required placeholder="Your password"/></label>}{error && <p role="alert" className="form-error">{error}</p>}{message && <p role="status">{message}</p>}<button className="btn" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Login' : mode === 'register' ? 'Create account' : 'Send reset link'}</button></form>{mode === 'login' && <button className="text-button" onClick={() => change('reset')}>Forgot your password?</button>}<button className="modal-switch" onClick={() => change(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Login'}</button></div></dialog>;
}
