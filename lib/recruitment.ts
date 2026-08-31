import type { Catalog, Character, Roster } from './model';
import { total } from './game';

export function recruitmentBudget(roster: Roster, catalog: Catalog) {
  return roster.pointsLimit - total(roster, catalog);
}

export function affordableModels(models: Character[], remaining: number) {
  return models.filter((model) => model.cost <= remaining);
}
