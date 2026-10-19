export interface Book {
  id: string; title: string; author: string; subTitle: string; imageLink: string;
  audioLink: string; totalRating: number; averageRating: number; keyIdeas: number;
  type: string; status: string; subscriptionRequired: boolean; summary: string;
  tags: string[]; bookDescription: string; authorDescription: string;
}
const BASE = 'https://us-central1-summaristt.cloudfunctions.net';
const cache = new Map<string, Book[]>();
async function request(path: string, signal?: AbortSignal): Promise<Book[]> {
  const response = await fetch(`${BASE}/${path}`, { signal: signal ?? AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Books could not be loaded. Please try again.');
  const data = await response.json();
  const books = Array.isArray(data) ? data : [data];
  return books.filter((b: Book) => b && typeof b.id === 'string');
}
export async function getBooks(status: string) {
  const key = `status:${status}`;
  if (!cache.has(key)) cache.set(key, await request(`getBooks?status=${encodeURIComponent(status)}`));
  return cache.get(key)!;
}
export async function getBook(id: string) {
  for (const books of cache.values()) { const book = books.find(b => b.id === id); if (book) return book; }
  const books = await request(`getBook?id=${encodeURIComponent(id)}`);
  if (!books[0]) throw new Error('This book was not found.');
  cache.set(`book:${id}`, books);
  return books[0];
}
export const searchBooks = (value: string, signal: AbortSignal) => request(`getBooksByAuthorOrTitle?search=${encodeURIComponent(value)}`, signal);
export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
