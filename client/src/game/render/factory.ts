// Choisit le bon générateur 3D selon le navire : voilier historique, monstre marin, navire régional ou moderne.
import type { SkinId } from '../../../../shared/extras';
import type { ShipDef } from '../../../../shared/ships';
import { ModernShipModel } from './ModernShipModel';
import { MonsterModel } from './MonsterModel';
import { RegionalShipModel } from './RegionalShipModel';
import { ShipModel } from './ShipModel';

export type AnyShipModel = ShipModel | MonsterModel | ModernShipModel | RegionalShipModel;

export function makeShipModel(def: ShipDef, flag?: 'royal' | 'tricolore' | 'imperial', skin?: SkinId | null): AnyShipModel {
  if (def.look.monster) return new MonsterModel(def);
  if (def.modern) return new ModernShipModel(def);
  if (def.regional) return new RegionalShipModel(def);
  return new ShipModel(def, flag, skin);
}
