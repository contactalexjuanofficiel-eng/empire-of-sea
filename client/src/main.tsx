import '@fontsource/cinzel/500.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/roboto-condensed/700.css';
import './styles.css';
import { createRoot } from 'react-dom/client';
import { Game } from './game/Game';
import { store } from './store';
import { App } from './ui/App';
import { setGame } from './ui/common';

const game = new Game(document.getElementById('scene')!, document.getElementById('labels') as HTMLDivElement);
setGame(game);
(window as unknown as { __game: Game }).__game = game; // pratique pour le débogage et les tests automatisés

// Reconnexion automatique si une session existe déjà.
try {
  const token = localStorage.getItem('edm.token');
  if (token) {
    store.set({ connection: 'connecting' });
    game.net.connect(token);
    game.net.on((m) => {
      if (m.t === 'err' && /Session/.test(m.text)) {
        try { localStorage.removeItem('edm.token'); } catch { /* */ }
        game.net.close();
        store.set({ screen: 'login', connection: 'off' });
      }
    });
  }
} catch { /* stockage indisponible : connexion manuelle */ }

createRoot(document.getElementById('ui')!).render(<App />);
