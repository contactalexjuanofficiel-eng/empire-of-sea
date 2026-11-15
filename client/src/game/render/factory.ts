// Choisit le bon générateur 3D selon le navire : voilier historique, monstre marin ou navire moderne à moteur.
import type { SkinId } from '../../../../shared/extras';
import type { ShipDef } from '../../../../shared/ships';
import { ModernShipModel } from './ModernShipModel';
import { MonsterModel } from './MonsterModel';
import { ShipModel } from './ShipModel';

export type AnyShipModel = ShipModel | MonsterModel | ModernShipModel;

export function makeShipModel(def: ShipDef, flag?: 'royal' | 'tricolore' | 'imperial', skin?: SkinId | null): AnyShipModel {
  if (def.look.monster) return new MonsterModel(def);
  if (def.modern) return new ModernShipModel(def);
  return new ShipModel(def, flag, skin);
}
