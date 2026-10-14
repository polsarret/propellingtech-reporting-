// Sociedades del grupo (campo `market` de f_pnl): SL = España (Holded), LLC = USA (QuickBooks), CORP = matriz.
// Módulo sin dependencias de servidor: lo importan tanto bigquery.ts como los componentes cliente.
export const ENTITIES = ["sl", "llc", "corp"] as const;
export type Entity = (typeof ENTITIES)[number];
