/** Floor plan pictures. Table markers use the tables' pos_x / pos_y / width / height as pixels of this picture. */
export type FloorPlan = { src: string; width: number; height: number };

export const FLOOR_PLANS: Record<string, FloorPlan> = {
  "roi-chak-sam": { src: "/floorplans/roi-chak-sam.webp", width: 1448, height: 1086 },
};

export const floorPlanFor = (slug: string | null | undefined): FloorPlan | null => (slug ? (FLOOR_PLANS[slug] ?? null) : null);
