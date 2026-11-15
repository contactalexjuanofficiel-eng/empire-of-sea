import { useStore } from '../store';
import { BossBar, Chat, Hints, Notices, SeaPrompts } from './Hud';
import { BottomDock, Journal, MapBlock, Rulers, SideTabs, TargetCard, TopNav, TutorialBox } from './Hud2';
import { Login } from './Login';
import { ConfirmBox } from './common';
import { Help, Inventory, GuildPanel, Leaderboard, ProfilePanel, Settings, WorldMap } from './Panels';
import { PortPanel } from './Port';
import { BonusPanel, CaptainsPanel, EventPanel, MissionsPanel, ShopPanel } from './Panels2';
import { RanksPanel } from './Ranks';
import { FleetPanel } from './Fleet';

export function App() {
  const screen = useStore((s) => s.screen);
  const panel = useStore((s) => s.panel);
  const docked = useStore((s) => s.docked);
  const conn = useStore((s) => s.connection);
  const chatOpen = useStore((s) => s.chatOpen);

  if (screen === 'login') return <><Login /><Notices /></>;
  if (screen === 'loading') return <div className="loading"><div className="spinner" /><p>Les cartographes dressent la carte…</p></div>;

  return (
    <div className={`hud ${docked ? 'is-docked' : 'at-sea'}`}>
      <TopNav />
      <BossBar />
      <TutorialBox />
      {!docked && (
        <>
          <Rulers />
          <div className="leftcol"><Journal /></div>
          <div className="right-col2"><MapBlock /><TargetCard /><SideTabs /></div>
          <BottomDock />
          <SeaPrompts />
          <Hints />
        </>
      )}
      {chatOpen && <Chat />}
      <Notices />
      <ConfirmBox />
      {panel === 'port' && <PortPanel />}
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
      {panel === 'flotte' && <FleetPanel />}
      {panel === 'evenement' && <EventPanel />}
      {conn === 'lost' && <div className="conn-lost">Connexion au serveur perdue — tentative de reconnexion…</div>}
    </div>
  );
}
