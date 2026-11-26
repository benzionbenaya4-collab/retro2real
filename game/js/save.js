// שמירה ב-localStorage – כל גישה עטופה ב-try/catch (מצב פרטי / חסימה)
const KEY = 'retro2real.save.v1';
const DEF = { world: 1, sound: true, best: 0, coins: [], tapes: [], toolLvl: 0 };
export function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return { ...DEF, ...(s || {}) }; } catch { return { ...DEF }; }
}
export function save(patch) {
  const s = { ...load(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* אין אחסון – ממשיכים בלי */ }
  return s;
}
export function reset() { try { localStorage.removeItem(KEY); } catch { /* */ } }
