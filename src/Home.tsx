import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiBookOpen, FiHeadphones, FiZap, FiCheck, FiMenu, FiX } from 'react-icons/fi';
import { Logo } from './components';
import { useStore } from './store';
export function Home() {
  const { openAuth, user } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const dismiss = (event: PointerEvent) => { if (!header.current?.contains(event.target as Node)) setMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus(); } };
    const desktop = window.matchMedia('(min-width: 601px)');
    const resized = () => { if (desktop.matches) setMenuOpen(false); };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    desktop.addEventListener('change', resized);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); desktop.removeEventListener('change', resized); };
  }, [menuOpen]);
  return <><header className="home-nav" ref={header}><Logo/><button ref={menuButton} className="home-menu-toggle icon-button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="home-navigation" onClick={() => setMenuOpen(value => !value)}>{menuOpen ? <FiX/> : <FiMenu/>}</button><nav id="home-navigation" aria-label="Homepage navigation" className={`home-links ${menuOpen ? 'is-open' : ''}`} onClick={() => setMenuOpen(false)}>{user ? <Link to="/settings">Account</Link> : <button onClick={openAuth}>Login</button>}<a href="#about">About</a><Link to="/choose-plan">Pricing</Link><a href="#about">Help</a></nav></header><main><section className="hero-backdrop"><div className="hero page-width"><div><span className="eyebrow">BIG IDEAS. SMALL TIME COMMITMENT.</span><h1>Gain more knowledge<br/><span>in less time.</span></h1><p>Great summaries for busy people,<br/>individuals who barely have time to read,<br/>and even people who don’t like to read.</p><button className="btn hero-cta" onClick={openAuth}>Start learning</button><Link className="browse-link" to="/for-you">Explore the library &rarr;</Link><p className="hero-note"><FiCheck/> Read or listen. Make every minute count.</p></div><img className="hero-image" src="/assets/landing.png" alt="A person reading beside a stack of books"/></div></section><section className="features page-width" id="about"><h2>Understand books in a few minutes</h2><div className="feature-grid">{[[FiBookOpen, 'Read or listen', 'Save time by getting the core ideas from the best books.', '/library'],[FiZap, 'Find your next read', 'Explore book lists and discover a new perspective.', '/for-you'],[FiHeadphones, 'Learn on the go', 'Turn your commute or daily walk into time well spent.', '/library']].map(([Icon,title,text,destination]) => { const Glyph = Icon as typeof FiBookOpen; return <Link className="feature-link" key={String(title)} to={String(destination)}><article><Glyph/><h3>{String(title)}</h3><p>{String(text)}</p></article></Link>; })}</div></section><section className="growth"><div className="page-width growth-grid"><div><span className="eyebrow">A LITTLE EVERY DAY</span><h2>Small habits.<br/>Extraordinary possibilities.</h2><p>Expand your knowledge. Build better habits.<br/>Find ideas that move you forward.</p><Link className="btn" to="/for-you">Find your next idea</Link></div><div className="growth-list">{['Enhance your knowledge','Achieve greater success','Improve your wellbeing','Increase your happiness','Be the best version of yourself'].map(x => <p key={x}><FiCheck/>{x}</p>)}</div></div></section><section className="home-final page-width"><h2>Your next chapter starts here.</h2><p>One book. A few minutes. A whole new perspective.</p><button className="btn" onClick={openAuth}>Start growing with Summarist</button></section></main><footer className="home-footer page-width"><Logo/><p>A touch of Whimsical Synergy to brighten your day.</p><Link to="/choose-plan">Explore plans</Link></footer></>;
}
