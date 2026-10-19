import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { FiPlay, FiPause, FiRotateCcw, FiRotateCw, FiVolume2, FiBookOpen } from 'react-icons/fi';
import { getBook, formatTime, type Book } from './api';
import { useLoad } from './pages';
import { useStore } from './store';
import { ErrorNotice, Skeleton } from './components';
export function Player() {
  const { id = '' } = useParams(); const { data: book, error, retry } = useLoad(() => getBook(id), [id]);
  const { user, ready, subscriptionReady, premium, openAuth } = useStore();
  if (!ready || !subscriptionReady || (!book && !error)) return <Skeleton/>;
  if (error) return <ErrorNotice retry={retry}>{error}</ErrorNotice>;
  if (!user) return <div className="signed-out"><img src="/assets/login.png" alt=""/><h1>Your next idea is waiting</h1><p>Log in to read or listen to this summary.</p><button className="btn" onClick={openAuth}>Login</button></div>;
  if (book!.subscriptionRequired && !premium) return <Navigate to="/choose-plan" replace/>;
  return <Reader key={id} book={book!}/>;
}
function Reader({ book }: { book: Book }) {
  const audio = useRef<HTMLAudioElement>(null); const [params] = useSearchParams();
  const [playing, setPlaying] = useState(false); const [duration, setDuration] = useState(0); const [time, setTime] = useState(0); const [volume, setVolume] = useState(1); const [speed, setSpeed] = useState(1); const [font, setFont] = useState(18); const [error, setError] = useState('');
  const { finish } = useStore();
  useEffect(() => { if (params.has('listen')) audio.current?.play().catch(() => setError('Press play to start listening.')); }, []);
  async function toggle() { const player = audio.current; if (!player) return; setError(''); if (player.paused) { try { await player.play(); } catch { setError('Audio could not start. Check your connection and try again.'); } } else player.pause(); }
  function seek(value: number) { if (audio.current && duration) { audio.current.currentTime = Math.max(0, Math.min(duration, value)); setTime(audio.current.currentTime); } }
  return <><article className="reader"><Link className="back-link" to={`/book/${book.id}`}>&larr; Book details</Link><div className="reader-tools"><span><FiBookOpen/> TEXT SUMMARY</span><div><button aria-label="Decrease text size" disabled={font <= 16} onClick={() => setFont(x => x - 2)}>A-</button><button aria-label="Increase text size" disabled={font >= 26} onClick={() => setFont(x => x + 2)}>A+</button></div></div><h1>{book.title}</h1><p className="muted">{book.author}</p><div className="summary" style={{ fontSize: font }}>{book.summary}</div></article><section className="audio-player" aria-label="Book audio player"><audio ref={audio} src={book.audioLink} preload="metadata" onLoadedMetadata={e => setDuration(e.currentTarget.duration)} onTimeUpdate={e => setTime(e.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); finish(book.id); }} onError={() => setError('Audio is unavailable. Please try again later.')}/><div className="now-playing"><img src={book.imageLink} alt=""/><div><strong>{book.title}</strong><small>{book.author}</small></div></div><div className="playback"><div className="playback-buttons"><button aria-label="Skip back 10 seconds" onClick={() => seek(time - 10)}><FiRotateCcw/><small>10</small></button><button className="play-button" aria-label={playing ? 'Pause' : 'Play'} onClick={() => void toggle()}>{playing ? <FiPause/> : <FiPlay/>}</button><button aria-label="Skip forward 10 seconds" onClick={() => seek(time + 10)}><FiRotateCw/><small>10</small></button></div><div className="timeline"><span>{formatTime(time)}</span><input type="range" aria-label="Audio position" min="0" max={duration || 1} step="0.1" value={Math.min(time, duration || 1)} disabled={!duration} onChange={e => seek(Number(e.target.value))}/><span>{formatTime(duration)}</span></div>{error && <p className="audio-error" role="status">{error}</p>}</div><div className="audio-options"><label><span className="sr-only">Playback speed</span><select aria-label="Playback speed" value={speed} onChange={e => { const rate = Number(e.target.value); setSpeed(rate); if (audio.current) audio.current.playbackRate = rate; }}>{[0.75,1,1.25,1.5,2].map(x => <option key={x} value={x}>{x}×</option>)}</select></label><FiVolume2/><input aria-label="Volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={e => { const level = Number(e.target.value); setVolume(level); if (audio.current) audio.current.volume = level; }}/></div></section></>;
}
