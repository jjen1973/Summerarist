import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut, signInAnonymously } from 'firebase/auth';
import { arrayRemove, arrayUnion, collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { auth, db, localStripeEnabled, getLocalSubscription, getSubscription } from './firebase';
type Session = { uid: string; email: string | null; guest: boolean };
type Shelf = { saved: string[]; finished: string[] };
type Context = { user: Session | null; ready: boolean; subscriptionReady: boolean; premium: string | null; modal: boolean; openAuth: () => void; closeAuth: () => void; guestLogin: () => Promise<void>; logout: () => Promise<void>; shelf: Shelf; libraryStatus: string; libraryError: string; retryLibrary: () => void; toggleSaved: (id: string) => void; finish: (id: string) => void };
const Store = createContext<Context>(null!);
const emptyShelf: Shelf = { saved: [], finished: [] };
function readShelf(value: unknown): Shelf {
  const data = value as Partial<Shelf> | null;
  return { saved: Array.isArray(data?.saved) ? data.saved.filter((id): id is string => typeof id === 'string') : [], finished: Array.isArray(data?.finished) ? data.finished.filter((id): id is string => typeof id === 'string') : [] };
}
function cacheShelf(key: string, value: Shelf) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* usable without browser storage */ }
}
export function Provider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Session | null>(null);
  const [ready, setReady] = useState(!auth);
  const [modal, setModal] = useState(false);
  const [premium, setPremium] = useState<string | null>(null);
  const [subscriptionUid, setSubscriptionUid] = useState<string | null>(null);
  const [shelf, setShelf] = useState<Shelf>(emptyShelf);
  const shelfRef = useRef<Shelf>(emptyShelf);
  const shelfOwner = useRef<string | null>(null);
  const [libraryStatus, setLibraryStatus] = useState('local');
  const [libraryError, setLibraryError] = useState('');
  const [libraryAttempt, setLibraryAttempt] = useState(0);
  const pendingChanges = useRef(new Map<string, { field: 'saved' | 'finished'; id: string; included: boolean }>());
  useEffect(() => {
    if (!auth) {
      try { if (sessionStorage.getItem('summarist-guest')) setUser({ uid: 'local-guest', email: null, guest: true }); } catch { /* storage unavailable */ }
      return;
    }
    return onAuthStateChanged(auth, account => {
      setUser(account ? { uid: account.uid, email: account.email, guest: account.isAnonymous } : null);
      setReady(true);
    });
  }, []);
  useEffect(() => {
    setPremium(null);
    setSubscriptionUid(null);
    if (!user || !db || user.guest) return;
    if (localStripeEnabled) {
      let active = true;
      const refresh = () => { void getLocalSubscription().then(value => { if (active) setPremium(value.premium); }).catch(() => { if (active) setPremium(null); }).finally(() => { if (active) setSubscriptionUid(user.uid); }); };
      refresh();
      window.addEventListener('focus', refresh);
      return () => { active = false; window.removeEventListener('focus', refresh); };
    }
    const refresh = () => { void getSubscription().catch(() => { /* Firestore remains the last verified state. */ }); };
    refresh();
    window.addEventListener('focus', refresh);
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = onSnapshot(query(collection(db, 'customers', user.uid, 'subscriptions'), where('status', 'in', ['trialing', 'active'])), snapshot => {
      clearTimeout(expiryTimer);
      const subscription = snapshot.docs.map(doc => doc.data()).find(value => value.environment === 'test' && ['premium','premium-plus'].includes(value.role) && value.entitlementUntil * 1000 > Date.now());
      setPremium(subscription?.role || null);
      if (subscription) {
        const checkExpiry = () => {
          const remaining = subscription.entitlementUntil * 1000 - Date.now();
          if (remaining <= 0) { setPremium(null); refresh(); }
          else expiryTimer = setTimeout(checkExpiry, Math.min(remaining, 2147483647));
        };
        checkExpiry();
      }
      setSubscriptionUid(user.uid);
    }, () => { setPremium(null); setSubscriptionUid(user.uid); });
    return () => { unsubscribe(); clearTimeout(expiryTimer); window.removeEventListener('focus', refresh); };
  }, [user]);
  useEffect(() => {
    const uid = user?.uid || null;
    const key = `summarist-shelf:${uid || 'signed-out'}`;
    const pendingKey = `summarist-shelf-pending:${uid || 'signed-out'}`;
    shelfOwner.current = uid;
    let cached = emptyShelf;
    try {
      cached = readShelf(JSON.parse(localStorage.getItem(key) || 'null'));
    } catch { /* start with an empty library */ }
    try {
      const pending = JSON.parse(localStorage.getItem(pendingKey) || '[]');
      if (Array.isArray(pending)) for (const change of pending) {
        if ((change.field === 'saved' || change.field === 'finished') && typeof change.id === 'string' && typeof change.included === 'boolean') {
          const changeKey = `${uid}:${change.field}:${change.id}`;
          if (!pendingChanges.current.has(changeKey)) pendingChanges.current.set(changeKey, change);
        }
      }
    } catch { /* ignore invalid browser cache */ }
    shelfRef.current = cached; setShelf(cached);
    setLibraryError('');
    if (!user || user.guest || !db) { setLibraryStatus('local'); return; }
    let active = true;
    let initialized = false;
    setLibraryStatus('syncing');
    const library = doc(db, 'users', user.uid, 'library', 'shelf');
    function persistPending() {
      try { localStorage.setItem(pendingKey, JSON.stringify([...pendingChanges.current].filter(([key]) => key.startsWith(`${uid}:`)).map(([, change]) => change))); } catch { /* storage unavailable */ }
      if (active && ![...pendingChanges.current.keys()].some(key => key.startsWith(`${uid}:`))) { setLibraryStatus('synced'); setLibraryError(''); }
    }
    function failed() {
      if (active) { setLibraryStatus('error'); setLibraryError('Your library could not sync with Firebase. Your books are kept in this browser. Check your connection and Firestore permissions, then retry.'); }
    }
    void setDoc(doc(db, 'users', user.uid), { email: user.email, updatedAt: serverTimestamp() }, { merge: true }).catch(failed);
    const unsubscribe = onSnapshot(library, { includeMetadataChanges: true }, snapshot => {
      if (!active) return;
      // Wait for the server before deciding whether to migrate an existing browser library.
      if (!initialized && snapshot.metadata.fromCache) return;
      if (!initialized) {
        initialized = true;
        if (!snapshot.exists()) {
          const migrating = [...pendingChanges.current].filter(([key]) => key.startsWith(`${uid}:`));
          // Merge IDs atomically so a save made during initial sync cannot be overwritten.
          void setDoc(library, { saved: arrayUnion(...cached.saved), finished: arrayUnion(...cached.finished) }, { merge: true }).then(() => {
            for (const [key, change] of migrating) if (pendingChanges.current.get(key) === change) pendingChanges.current.delete(key);
            persistPending();
          }).catch(failed);
          return;
        }
        // Retry only this browser's unsent edits; never overwrite another device's library.
        for (const [changeKey, change] of pendingChanges.current) {
          if (!changeKey.startsWith(`${uid}:`)) continue;
          void setDoc(library, { [change.field]: change.included ? arrayUnion(change.id) : arrayRemove(change.id) }, { merge: true }).then(() => {
            if (pendingChanges.current.get(changeKey) === change) pendingChanges.current.delete(changeKey);
            persistPending();
          }).catch(failed);
        }
      }
      const next = readShelf(snapshot.data());
      for (const [changeKey, change] of pendingChanges.current) {
        if (!changeKey.startsWith(`${uid}:`)) continue;
        next[change.field] = change.included ? [...new Set([...next[change.field], change.id])] : next[change.field].filter(id => id !== change.id);
      }
      shelfRef.current = next; setShelf(next); cacheShelf(key, next);
      if (!snapshot.metadata.hasPendingWrites && !snapshot.metadata.fromCache && ![...pendingChanges.current.keys()].some(key => key.startsWith(`${uid}:`))) {
        setLibraryStatus('synced'); setLibraryError('');
      } else setLibraryStatus('syncing');
    }, failed);
    return () => { active = false; unsubscribe(); };
  }, [user, libraryAttempt]);
  function updateShelf(field: 'saved' | 'finished', id: string, included: boolean) {
    if (shelfOwner.current !== (user?.uid || null)) return;
    const previous = shelfRef.current;
    const next = { ...previous, [field]: included ? [...new Set([...previous[field], id])] : previous[field].filter(value => value !== id) };
    shelfRef.current = next; setShelf(next);
    cacheShelf(`summarist-shelf:${user?.uid || 'signed-out'}`, next);
    if (!user || user.guest || !db) return;
    const uid = user.uid;
    const changeKey = `${uid}:${field}:${id}`;
    const change = { field, id, included };
    pendingChanges.current.set(changeKey, change);
    const persistPending = () => {
      try { localStorage.setItem(`summarist-shelf-pending:${uid}`, JSON.stringify([...pendingChanges.current].filter(([key]) => key.startsWith(`${uid}:`)).map(([, value]) => value))); } catch { /* storage unavailable */ }
    };
    persistPending();
    setLibraryStatus('syncing');
    void setDoc(doc(db, 'users', uid, 'library', 'shelf'), { [field]: included ? arrayUnion(id) : arrayRemove(id) }, { merge: true }).then(() => {
      if (pendingChanges.current.get(changeKey) === change) pendingChanges.current.delete(changeKey);
      persistPending();
      if (shelfOwner.current === uid && ![...pendingChanges.current.keys()].some(key => key.startsWith(`${uid}:`))) { setLibraryStatus('synced'); setLibraryError(''); }
    }).catch(() => {
      if (shelfOwner.current === uid) { setLibraryStatus('error'); setLibraryError('Your library could not sync with Firebase. Your books are kept in this browser. Check your connection and Firestore permissions, then retry.'); }
    });
  }
  async function guestLogin() {
    if (auth) await signInAnonymously(auth);
    else { try { sessionStorage.setItem('summarist-guest', 'true'); } catch { /* session only */ } setUser({ uid: 'local-guest', email: null, guest: true }); }
    setModal(false);
  }
  async function logout() {
    if (auth) await signOut(auth);
    try { sessionStorage.removeItem('summarist-guest'); } catch { /* storage unavailable */ }
    setUser(null); setPremium(null);
  }
  const subscriptionReady = !user || user.guest || !db || subscriptionUid === user.uid;
  return <Store.Provider value={{ user, ready, subscriptionReady, premium, modal, openAuth: () => setModal(true), closeAuth: () => setModal(false), guestLogin, logout, shelf, libraryStatus, libraryError, retryLibrary: () => setLibraryAttempt(value => value + 1),
    toggleSaved: id => updateShelf('saved', id, !shelfRef.current.saved.includes(id)),
    finish: id => updateShelf('finished', id, true),
  }}>{children}</Store.Provider>;
}
export const useStore = () => useContext(Store);
