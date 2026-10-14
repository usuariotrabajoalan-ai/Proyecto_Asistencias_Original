export interface SedeConfig {
  id: string;
  name: string;
  shortName: string;
  lat: number;
  lng: number;
  radiusMeters: number;
}

export const SEDES: SedeConfig[] = [
  {
    id: 'SEDE_SOCIAL',
    name: 'Sede Social (Lambaré)',
    shortName: 'Sede Social',
    lat: -25.356318,
    lng: -57.624452,
    radiusMeters: 250, // 250m de cobertura
  },
  {
    id: 'SEDE_ADMINISTRATIVA',
    name: 'Sede Administrativa (14 de Mayo)',
    shortName: 'Sede Administrativa',
    lat: -25.286900,
    lng: -57.640900,
    radiusMeters: 250, // 250m de cobertura
  }
];

// Cálculo de distancia mediante fórmula Haversine en metros
export function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Radio de la Tierra en metros
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export interface EvaluationResult {
  inRange: boolean;
  sede: SedeConfig;
  distance: number | null;
  statusLabel: string;
  shortLabel: string;
}

// Evalúa si unas coordenadas caen en rango de alguna de las sedes oficiales
export function evaluateLocation(
  lat: number | null | undefined,
  lng: number | null | undefined
): EvaluationResult {
  if (lat == null || lng == null) {
    return {
      inRange: false,
      sede: SEDES[0],
      distance: null,
      statusLabel: 'Sin datos GPS',
      shortLabel: 'Sin GPS'
    };
  }

  let closestSede = SEDES[0];
  let minDistance = Infinity;
  let matchingSede: SedeConfig | null = null;

  for (const s of SEDES) {
    const dist = getDistanceInMeters(lat, lng, s.lat, s.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestSede = s;
    }
    if (dist <= s.radiusMeters) {
      matchingSede = s;
      break;
    }
  }

  if (matchingSede) {
    return {
      inRange: true,
      sede: matchingSede,
      distance: minDistance,
      statusLabel: `✅ En rango (${matchingSede.shortName})`,
      shortLabel: matchingSede.shortName
    };
  }

  return {
    inRange: false,
    sede: closestSede,
    distance: minDistance,
    statusLabel: `❌ Fuera (${minDistance}m de ${closestSede.shortName})`,
    shortLabel: `Fuera (${closestSede.shortName}: ${minDistance}m)`
  };
}
