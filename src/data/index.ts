import campaignJson from "./campaign.json";
import demographicsJson from "./demographics.json";
import districtMapJson from "./district-map.json";
import districtsJson from "./districts.json";
import federalJson from "./federal.json";
import legislatorsJson from "./legislators.json";
import metaJson from "./meta.json";
import type {
  Bill,
  BillStageEntry,
  BillStagesMap,
  CampaignData,
  CampaignProfile,
  DemographicsData,
  District,
  DistrictDemographics,
  DistrictMapData,
  DonorsData,
  DonorProfile,
  FederalData,
  FederalDistrict,
  Legislator,
  Meta,
  VotesData,
} from "../types";

export const legislators = legislatorsJson as unknown as Legislator[];
export const districts = districtsJson as unknown as District[];
export const meta = metaJson as Meta;
export const campaign = campaignJson as unknown as CampaignData;
export const demographics = demographicsJson as unknown as DemographicsData;
export const federal = federalJson as unknown as FederalData;
export const districtMap = districtMapJson as unknown as DistrictMapData;

export const demographicsByDistrict = new Map<number, DistrictDemographics>(
  demographics.districts.map((entry) => [entry.district, entry]),
);

export const districtMapByNumber = new Map(
  districtMap.districts.map((shape) => [shape.district, shape]),
);

export const federalDistrictsByNumber = new Map<number, FederalDistrict>(
  federal.districts.map((district) => [district.district, district]),
);

export const legislatorsById = new Map(
  legislators.map((legislator) => [legislator.id, legislator]),
);

export const counties = Array.from(
  new Set(districts.flatMap((district) => district.counties)),
).sort((a, b) => a.localeCompare(b, "en"));

export const campaignProfilesByKey = new Map<string, CampaignProfile>(
  campaign.profiles.map((profile) => [profile.key, profile]),
);

export const campaignProfilesByLegislator = new Map<number, CampaignProfile[]>();
for (const profile of campaign.profiles) {
  const list = campaignProfilesByLegislator.get(profile.legislatorId) ?? [];
  list.push(profile);
  campaignProfilesByLegislator.set(profile.legislatorId, list);
}

let donorCache: DonorsData | null = null;
let donorByLegislatorCache: Map<number, DonorProfile[]> | null = null;

/**
 * Carga completa del dataset ELEC (perfiles + metadatos de generación).
 */
export async function loadDonorsData(): Promise<DonorsData> {
  if (!donorCache) {
    const module = await import("./donors.json");
    donorCache = module.default as unknown as DonorsData;
  }
  return donorCache;
}

/**
 * La base de aportes de ELEC pesa varios megabytes y solo se necesita en el
 * perfil de cada legislador o en Super Tools. Se carga en un fragmento aparte.
 */
export async function loadDonorProfilesByLegislator(): Promise<
  Map<number, DonorProfile[]>
> {
  if (donorByLegislatorCache) return donorByLegislatorCache;
  const data = await loadDonorsData();
  const map = new Map<number, DonorProfile[]>();
  for (const profile of data.profiles) {
    const list = map.get(profile.legislatorId) ?? [];
    list.push(profile);
    map.set(profile.legislatorId, list);
  }
  donorByLegislatorCache = map;
  return map;
}

let billCache: Record<string, Bill> | null = null;

/**
 * Los resúmenes de los 11.000+ proyectos solo se necesitan al abrir un
 * perfil. Se cargan en un fragmento aparte para que el directorio sea ligero.
 */
export async function loadBills(): Promise<Record<string, Bill>> {
  if (billCache) return billCache;
  const module = await import("./bills.json");
  billCache = module.default as unknown as Record<string, Bill>;
  return billCache;
}

export type { BillStageEntry, BillStagesMap, VotesData };

let billStagesCache: BillStagesMap | null = null;

/**
 * Mapeo de estados legislativos de los 11.000+ proyectos (introduced, committee,
 * reported, floor, enacted). Se carga bajo demanda para mantener liviano el bundle inicial.
 */
export async function loadBillStages(): Promise<BillStagesMap> {
  if (billStagesCache) return billStagesCache;
  const module = await import("./bill-stages.json");
  billStagesCache = module.default as unknown as BillStagesMap;
  return billStagesCache;
}

let votesDataCache: VotesData | null = null;

/**
 * Registros oficiales de votaciones por lista (roll calls) y estadísticas de
 * asistencia y disciplina partidaria de los 120 legisladores. Se carga bajo demanda.
 */
export async function loadVotesData(): Promise<VotesData> {
  if (votesDataCache) return votesDataCache;
  const module = await import("./votes.json");
  votesDataCache = module.default as unknown as VotesData;
  return votesDataCache;
}

