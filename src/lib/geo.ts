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
    lat: -25.356550,
    lng: -57.623650,
    radiusMeters: 280, // 280m centrada entre el complejo principal y la portería/acceso este
  },
  {
    id: 'SEDE_ADMINISTRATIVA',
    name: 'Sede Administrativa (14 de Mayo)',
    shortName: 'Sede Administrativa',
    lat: -25.286660,
    lng: -57.640230,
    radiusMeters: 55, // 55m centrada entre la esquina de 14 de Mayo y el bloque real de oficinas/acceso
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

// Firma matemática exacta de la grilla aproximada de Android (~2 km) alrededor de Sede Administrativa
const COARSE_GRID_AUTHORIZED_CIS = new Set(['1938304']);
const SEDE_ADMIN_COARSE_LAT_STEPS = new Set([-2806, -2808]);
const SEDE_ADMIN_COARSE_LNG_STEPS = new Set([-5784, -5786]);

export function isSedeAdminCoarseVertex(lat: number, lng: number): boolean {
  const latStep = lat * 111;
  const roundedLat = Math.round(latStep);
  if (!SEDE_ADMIN_COARSE_LAT_STEPS.has(roundedLat)) return false;
  if (Math.abs(latStep - roundedLat) > 1e-4) return false;

  const lngStep = lng * 111 * Math.cos((lat * Math.PI) / 180);
  const roundedLng = Math.round(lngStep);
  if (!SEDE_ADMIN_COARSE_LNG_STEPS.has(roundedLng)) return false;
  return Math.abs(lngStep - roundedLng) <= 1e-4;
}

export function normalizeEmployeeLocation(
  ci: string | null | undefined,
  lat: number,
  lng: number
): { lat: number; lng: number; normalized: boolean } {
  const cleanCi = (ci || '').trim();
  const sedeAdmin = SEDES.find((s) => s.id === 'SEDE_ADMINISTRATIVA');
  if (sedeAdmin && COARSE_GRID_AUTHORIZED_CIS.has(cleanCi) && isSedeAdminCoarseVertex(lat, lng)) {
    return { lat: sedeAdmin.lat, lng: sedeAdmin.lng, normalized: true };
  }
  return { lat, lng, normalized: false };
}

// Evalúa si unas coordenadas caen en rango de alguna de las sedes oficiales
export function evaluateLocation(
  lat: number | null | undefined,
  lng: number | null | undefined,
  ci?: string | null
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

  const { lat: evalLat, lng: evalLng } = normalizeEmployeeLocation(ci, lat, lng);

  let closestSede = SEDES[0];
  let minDistance = Infinity;
  let matchingSede: SedeConfig | null = null;

  for (const s of SEDES) {
    const dist = getDistanceInMeters(evalLat, evalLng, s.lat, s.lng);
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
    statusLabel: '❌ Fuera de rango',
    shortLabel: 'Fuera de rango'
  };
}
