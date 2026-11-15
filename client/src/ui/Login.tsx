import { useState } from 'react';
import { authRequest } from '../net/Connection';
import { store } from '../store';
import { game, Icon } from './common';

export function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    game().audio.unlock();
    setBusy(true);
    setErr(null);
    const r = await authRequest(mode, name, pass);
    setBusy(false);
    if (!r.ok || !r.token) { setErr(r.msg ?? 'Erreur inconnue.'); return; }
    try { localStorage.setItem('edm.token', r.token); } catch { /* facultatif */ }
    store.set({ name: r.name ?? name, connection: 'connecting' });
    game().net.connect(r.token);
  }

  return (
    <div className="screen-login">
      <div className="title-block">
        <div className="crest"><Icon name="ancre" size={46} /></div>
        <h1>EMPIRE DES MERS</h1>
        <p className="subtitle">De mousse à Grand Amiral de France · 1676 – 1805</p>
      </div>
      <form className="login-card" onSubmit={submit}>
        <div className="tabs">
          <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>Connexion</button>
          <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>Nouveau capitaine</button>
        </div>
        <label>Nom de capitaine
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={16} autoComplete="username" placeholder="ex. Surcouf" required />
        </label>
        <label>Mot de passe
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
        </label>
        {err && <p className="form-err">{err}</p>}
        <button className="btn-gold big" disabled={busy}>{busy ? 'Hissez les voiles…' : mode === 'login' ? 'Prendre la mer' : 'Créer mon compte'}</button>
        <p className="fine">Prototype jouable en ligne. Les autres navires que vous croiserez sont soit de vrais joueurs connectés, soit des PNJ clairement identifiés « (PNJ) ».</p>
      </form>
    </div>
  );
}
