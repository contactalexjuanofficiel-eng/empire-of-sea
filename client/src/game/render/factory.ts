// Choisit le bon générateur 3D selon le navire : voilier historique, monstre marin, navire régional ou moderne.
import type { SkinId } from '../../../../shared/extras';
import type { ShipDef } from '../../../../shared/ships';
import { ModernShipModel } from './ModernShipModel';
import { MonsterModel } from './MonsterModel';
import { GltfShipModel, shipAsset } from './GltfShipModel';
import { RegionalShipModel } from './RegionalShipModel';
import { SpriteShipModel } from './SpriteShipModel';
import { ShipModel } from './ShipModel';

export type AnyShipModel = ShipModel | MonsterModel | ModernShipModel | RegionalShipModel | GltfShipModel | SpriteShipModel;

export function makeShipModel(def: ShipDef, flag?: 'royal' | 'tricolore' | 'imperial', skin?: SkinId | null, elite = 0): AnyShipModel {
  if (def.look.monster) return new MonsterModel(def);
  // Navire pré-rendu en images (rendu des jeux navals classiques).
  // {e} dans le nom de fichier : une planche par niveau élite (1 à 15).
  if (def.sprites) return new SpriteShipModel(def, { ...def.sprites, file: def.sprites.file.replace('{e}', String(Math.max(1, Math.min(15, elite || 1)))) });
  // Vrai modèle 3D (GLB) quand il est chargé ; sinon navire provisoire, remplacé dès l'arrivée du fichier.
  if (def.asset) { const sc = shipAsset(def.asset); if (sc) return new GltfShipModel(def, sc); }
  if (def.modern) return new ModernShipModel(def);
  if (def.regional) return new RegionalShipModel(def);
  return new ShipModel(def, flag, skin, elite);
}
