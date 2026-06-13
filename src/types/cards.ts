export type CardStatus = "active" | "deferred" | "skipped" | "mastered";

export interface CardItem {
  id: string;
  name: string;
  slug: string;
  summary: string;
  status: CardStatus;
  deferCount: number;
}
