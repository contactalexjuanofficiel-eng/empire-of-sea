import { useStore } from '../store';
import { Create } from './Create';
import { BossBar, Chat, Hints, MapBadge, MenuButtons, Minimap, Missions, Nearby, Notices, SeaPrompts, ShipStatus, TargetFrame, TopBar, Weapons } from './Hud';
import { Login } from './Login';
import { Help, Inventory, GuildPanel, Leaderboard, ProfilePanel, Settings, WorldMap } from './Panels';
import { PortPanel } from './Port';
import { BonusPanel, CaptainsPanel, MissionsPanel, ShopPanel } from './Panels2';
import { RanksPanel } from './Ranks';

export function App() {
  const screen = useStore((s) => s.screen);
  const panel = useStore((s) => s.panel);
  const docked = useStore((s) => s.docked);
  const conn = useStore((s) => s.connection);

  if (screen === 'login') return <><Login /><Notices /></>;
  if (screen === 'create') return <><Create /><Notices /></>;
  if (screen === 'loading') return <div className="loading"><div className="spinner" /><p>Les cartographes dressent la carte…</p></div>;

  return (
    <div className={`hud ${docked ? 'is-docked' : 'at-sea'}`}>
      <TopBar />
      <MenuButtons />
      <BossBar />
      {!docked && (
        <>
          <div className="right-col"><Minimap /><MapBadge /><Nearby /></div>
          <TargetFrame />
          <Missions />
          <div className="bottom-center"><ShipStatus /><Weapons /></div>
          <SeaPrompts />
          <Hints />
        </>
      )}
      <Chat />
      <Notices />
      {panel === 'port' && docked && <PortPanel />}
      {panel === 'inventaire' && <Inventory />}
      {panel === 'profil' && <ProfilePanel />}
      {panel === 'classement' && <Leaderboard />}
      {panel === 'guilde' && <GuildPanel />}
      {panel === 'carte' && <WorldMap />}
      {panel === 'parametres' && <Settings />}
      {panel === 'aide' && <Help />}
      {panel === 'missions' && <MissionsPanel />}
      {panel === 'boutique' && <ShopPanel />}
      {panel === 'capitaines' && <CaptainsPanel />}
      {panel === 'bonus' && <BonusPanel />}
      {panel === 'rangs' && <RanksPanel />}
      {conn === 'lost' && <div className="conn-lost">Connexion au serveur perdue — tentative de reconnexion…</div>}
    </div>
  );
}
