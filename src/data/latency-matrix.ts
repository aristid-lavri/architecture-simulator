/**
 * Matrice de latences inter-régions cloud (en ms, aller simple).
 * Valeurs approximatives pour AWS/Azure/GCP.
 */

export type CloudRegion =
  | 'us-east-1' | 'us-west-2' | 'eu-west-1' | 'eu-central-1'
  | 'ap-southeast-1' | 'ap-northeast-1' | 'ap-south-1'
  | 'sa-east-1' | 'ca-central-1' | 'me-south-1'
  | 'af-south-1' | 'eu-north-1' | 'ap-southeast-2'
  | 'us-east-2' | 'eu-west-2' | 'eu-west-3'
  | 'ap-northeast-2' | 'ap-northeast-3' | 'us-west-1' | 'eu-south-1';

export const regionLabels: Record<CloudRegion, string> = {
  'us-east-1': 'US East (Virginia)',
  'us-east-2': 'US East (Ohio)',
  'us-west-1': 'US West (California)',
  'us-west-2': 'US West (Oregon)',
  'ca-central-1': 'Canada (Montréal)',
  'eu-west-1': 'Europe (Irlande)',
  'eu-west-2': 'Europe (Londres)',
  'eu-west-3': 'Europe (Paris)',
  'eu-central-1': 'Europe (Francfort)',
  'eu-north-1': 'Europe (Stockholm)',
  'eu-south-1': 'Europe (Milan)',
  'ap-southeast-1': 'Asie (Singapour)',
  'ap-southeast-2': 'Asie (Sydney)',
  'ap-northeast-1': 'Asie (Tokyo)',
  'ap-northeast-2': 'Asie (Séoul)',
  'ap-northeast-3': 'Asie (Osaka)',
  'ap-south-1': 'Asie (Mumbai)',
  'sa-east-1': 'Amérique du Sud (São Paulo)',
  'me-south-1': 'Moyen-Orient (Bahreïn)',
  'af-south-1': 'Afrique (Le Cap)',
};

/**
 * Latences inter-régions en ms (aller simple).
 * Clé = "region1|region2" triées alphabétiquement.
 */
const latencyData: Record<string, number> = {
  // US intra
  'us-east-1|us-east-2': 10,
  'us-east-1|us-west-1': 62,
  'us-east-1|us-west-2': 65,
  'us-east-2|us-west-2': 50,
  'us-west-1|us-west-2': 20,
  // US ↔ Canada
  'ca-central-1|us-east-1': 15,
  'ca-central-1|us-west-2': 60,
  // US ↔ Europe
  'eu-central-1|us-east-1': 85,
  'eu-west-1|us-east-1': 75,
  'eu-west-2|us-east-1': 78,
  'eu-west-3|us-east-1': 82,
  'eu-central-1|us-west-2': 145,
  'eu-west-1|us-west-2': 135,
  // Europe intra
  'eu-central-1|eu-west-1': 20,
  'eu-central-1|eu-west-2': 15,
  'eu-central-1|eu-west-3': 12,
  'eu-central-1|eu-north-1': 25,
  'eu-central-1|eu-south-1': 18,
  'eu-north-1|eu-west-1': 30,
  'eu-west-1|eu-west-2': 10,
  'eu-west-1|eu-west-3': 12,
  'eu-west-2|eu-west-3': 8,
  // Europe ↔ Asia
  'ap-northeast-1|eu-central-1': 220,
  'ap-southeast-1|eu-central-1': 160,
  'ap-south-1|eu-central-1': 120,
  // US ↔ Asia
  'ap-northeast-1|us-west-2': 105,
  'ap-northeast-2|us-west-2': 120,
  'ap-southeast-1|us-west-2': 170,
  'ap-south-1|us-east-1': 190,
  'ap-southeast-2|us-west-2': 140,
  // Asia intra
  'ap-northeast-1|ap-northeast-2': 30,
  'ap-northeast-1|ap-northeast-3': 8,
  'ap-northeast-1|ap-southeast-1': 70,
  'ap-northeast-1|ap-south-1': 110,
  'ap-southeast-1|ap-southeast-2': 90,
  'ap-south-1|ap-southeast-1': 55,
  // South America
  'sa-east-1|us-east-1': 120,
  'eu-west-1|sa-east-1': 185,
  // Middle East
  'ap-south-1|me-south-1': 35,
  'eu-central-1|me-south-1': 90,
  'me-south-1|us-east-1': 170,
  // Africa
  'af-south-1|eu-west-1': 145,
  'af-south-1|us-east-1': 210,
  'af-south-1|me-south-1': 110,
};

/**
 * Retourne la latence inter-régions en ms.
 * @returns Latence en ms, ou null si les régions sont identiques ou inconnues.
 */
export function getInterRegionLatency(regionA: string, regionB: string): number | null {
  if (regionA === regionB) return 0;

  const [a, b] = [regionA, regionB].sort();
  const key = `${a}|${b}`;
  return latencyData[key] ?? null;
}

/**
 * Retourne toutes les régions disponibles.
 */
export function getAllRegions(): CloudRegion[] {
  return Object.keys(regionLabels) as CloudRegion[];
}
