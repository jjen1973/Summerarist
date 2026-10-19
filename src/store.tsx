import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut, signInAnonymously } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from './firebase';
type Session = { uid: string; email: string | null; guest: boolean };
type Shelf = { saved: string[]; finished: string[] };
type Context = { user: Session | null; ready: boolean; subscriptionReady: boolean; premium: string | null; modal: boolean; openAuth: () => void; closeAuth: () => void; guestLogin: () => Promise<void>; logout: () => Promise<void>; shelf: Shelf; toggleSaved: (id: string) => void; finish: (id: string) => void };
const Store = createContext<Context>(null!);
const emptyShelf: Shelf = { saved: [], finished: [] };
export function Provider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Session | null>(null);
  const [ready, setReady] = useState(!auth);
  const [modal, setModal] = useState(false);
  const [premium, setPremium] = useState<string | null>(null);
  const [subscriptionUid, setSubscriptionUid] = useState<string | null>(null);
  const [shelf, setShelf] = useState<Shelf>(emptyShelf);
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
    return onSnapshot(query(collection(db, 'customers', user.uid, 'subscriptions'), where('status', 'in', ['trialing', 'active'])), snapshot => {
      const subscription = snapshot.docs[0]?.data();
      setPremium(subscription ? (subscription.role || 'premium') : null);
      setSubscriptionUid(user.uid);
    }, () => { setPremium(null); setSubscriptionUid(user.uid); });
  }, [user]);
  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem(`summarist-shelf:${user?.uid || 'signed-out'}`) || 'null');
      setShelf(data && Array.isArray(data.saved) && Array.isArray(data.finished) ? data : emptyShelf);
    } catch { setShelf(emptyShelf); }
  }, [user]);
  function updateShelf(change: (previous: Shelf) => Shelf) {
    setShelf(previous => {
      const next = change(previous);
      try { localStorage.setItem(`summarist-shelf:${user?.uid || 'signed-out'}`, JSON.stringify(next)); } catch { /* usable without persistence */ }
      return next;
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
  return <Store.Provider value={{ user, ready, subscriptionReady, premium, modal, openAuth: () => setModal(true), closeAuth: () => setModal(false), guestLogin, logout, shelf,
    toggleSaved: id => updateShelf(s => ({ ...s, saved: s.saved.includes(id) ? s.saved.filter(x => x !== id) : [...s.saved, id] })),
    finish: id => updateShelf(s => ({ ...s, finished: [...new Set([...s.finished, id])] })),
  }}>{children}</Store.Provider>;
}
export const useStore = () => useContext(Store);
