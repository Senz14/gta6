// Save / load through localStorage. The game autosaves after every mission
// and when the player quits to the title screen.
const KEY = 'solmar-city-save-v1';

export function saveGameData(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
    return true;
  } catch { return false; }
}

export function loadGameData() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function clearSaveData() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
