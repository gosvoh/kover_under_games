export interface GameOption {
  value: string;
  label: string;
  modsCount: number;
}
export interface ModInfo {
  name?: string;
  historySaved?: false;
  mod_id: number;
  category_id?: number;
  contains_adult_content: boolean;
  status: string;
  available: boolean;
}

export interface HistoryEntry {
  id: number;
  game: string;
  modId: number;
  name: string;
  adult: boolean;
  createdAt: string;
}
export interface GameInfo {
  categories: { category_id: number; name: string }[];
}
