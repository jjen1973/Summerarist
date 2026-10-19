import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Provider } from './store';
import { AuthModal, Layout } from './components';
import { Home } from './Home';
import { ForYou, BookPage, Library, Settings, ChoosePlan } from './pages';
import { Player } from './Player';
import './styles.css';
function App() {
  const location = useLocation();
  useEffect(() => { window.scrollTo(0, 0); document.title = `Summarist · ${location.pathname === '/' ? 'Big ideas, less time' : location.pathname.startsWith('/player') ? 'Read & listen' : location.pathname.startsWith('/book') ? 'Book details' : location.pathname === '/for-you' ? 'For you' : location.pathname === '/library' ? 'My Library' : location.pathname === '/settings' ? 'Settings' : 'Choose your plan'}`; }, [location.pathname]);
  return <><Routes><Route path="/" element={<Home/>}/><Route path="/choose-plan" element={<ChoosePlan/>}/><Route element={<Layout/>}><Route path="/for-you" element={<ForYou/>}/><Route path="/book/:id" element={<BookPage/>}/><Route path="/player/:id" element={<Player/>}/><Route path="/library" element={<Library/>}/><Route path="/settings" element={<Settings/>}/><Route path="*" element={<div className="signed-out"><h1>Page not found</h1><Link className="btn" to="/for-you">Back to your books</Link></div>}/></Route></Routes><AuthModal/></>;
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><Provider><App/></Provider></BrowserRouter></React.StrictMode>);
