/** Per-device voice preferences (favorites + recently used), kept in localStorage. */
const FAV_KEY = 'voicelab_fav_voices';
const RECENT_KEY = 'voicelab_recent_voices';
const EVENT = 'voicelab:voice-prefs';
const MAX_RECENT = 6;

function read(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function write(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export const getFavoriteVoiceIds = () => read(FAV_KEY);
export const getRecentVoiceIds = () => read(RECENT_KEY);

export function toggleFavoriteVoice(id: string): boolean {
  const favs = read(FAV_KEY);
  const isFav = favs.includes(id);
  write(FAV_KEY, isFav ? favs.filter((x) => x !== id) : [id, ...favs]);
  return !isFav;
}

export function pushRecentVoice(id: string) {
  const recent = read(RECENT_KEY).filter((x) => x !== id);
  write(RECENT_KEY, [id, ...recent].slice(0, MAX_RECENT));
}

export function onVoicePrefsChange(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}
