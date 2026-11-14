import type {
  CommitteeAlignment,
  DonorProfile,
  DonorSectorKey,
  Legislator,
  LegislatorInfluenceSummary,
  SectorDefinition,
  SectorTotal,
} from "../types";

export type {
  CommitteeAlignment,
  DonorSectorKey,
  LegislatorInfluenceSummary,
  SectorDefinition,
  SectorTotal,
};

export const SECTOR_DEFINITIONS: SectorDefinition[] = [
  {
    key: "real_estate",
    color: "#ea580c",
    committeeCodes: ["AHO", "SCU", "ACE", "SEG"],
  },
  {
    key: "healthcare_pharma",
    color: "#10b981",
    committeeCodes: ["AHE", "AHN", "SHH"],
  },
  {
    key: "energy_utilities",
    color: "#f59e0b",
    committeeCodes: ["AEN", "SEN", "ATU"],
  },
  {
    key: "finance_insurance",
    color: "#2563eb",
    committeeCodes: ["AFI", "AAP", "ABU", "SBA", "SCM"],
  },
  {
    key: "labor_unions",
    color: "#8b5cf6",
    committeeCodes: ["ALA", "SLA"],
  },
  {
    key: "law_lobbying",
    color: "#ec4899",
    committeeCodes: ["AJU", "SJU", "SLP", "APS"],
  },
  {
    key: "tech_telecom",
    color: "#06b6d4",
    committeeCodes: ["AST", "ATU"],
  },
  {
    key: "civic_grassroots",
    color: "#0d9488",
    committeeCodes: [],
  },
];

export const SECTOR_BY_KEY = new Map<DonorSectorKey, SectorDefinition>(
  SECTOR_DEFINITIONS.map((sector) => [sector.key, sector]),
);

export type DonorClassifierInput = {
  name?: string | null;
  isIndividual?: boolean | null;
  contributorType?: string | null;
  amount?: number | null;
  employer?: string | null;
  occupation?: string | null;
};

export function classifyDonorSector(donor: DonorClassifierInput = {}): DonorSectorKey {
  const name = donor.name ?? "";
  const emp = donor.employer ?? "";
  const occ = donor.occupation ?? "";
  const ctype = donor.contributorType ?? "";
  const text = [name, emp, occ, ctype].join(" ").toLowerCase();

  // 1. Keyword match on lowercased donor data in strict priority order
  // Labor/Unions
  const laborKeywords = [
    "union",
    "ibew",
    "njea",
    "pba",
    "fop",
    "afl-cio",
    "afl cio",
    "teamsters",
    "laborers",
    "firefighters",
    "pipefitters",
    "afscme",
    "cwa",
    "seiu",
    "carpenters",
    "cope",
  ];
  if (
    laborKeywords.some((k) => text.includes(k)) ||
    /\blocal[\s\-#\d]/i.test(text)
  ) {
    return "labor_unions";
  }

  // Healthcare/Pharma
  const healthKeywords = [
    "health",
    "hospital",
    "pharma",
    "doctor",
    "physician",
    "hackensack",
    "rwj",
    "barnabas",
    "merck",
    "pfizer",
    "j&j",
    "johnson & johnson",
    "horizon",
    "dental",
    "optom",
    "chiro",
  ];
  if (
    healthKeywords.some((k) => text.includes(k)) ||
    /\bmed\b|\bmedic|\bnurs/i.test(text)
  ) {
    return "healthcare_pharma";
  }

  // Real Estate/Construction
  const realEstateKeywords = [
    "realtor",
    "real estate",
    "builder",
    "housing",
    "property",
    "mortgage",
    "apartment",
    "landlord",
    "associated builders",
  ];
  if (
    realEstateKeywords.some((k) => text.includes(k)) ||
    /\bdevelop|\bconstruct/i.test(text)
  ) {
    return "real_estate";
  }

  // Energy/Utilities
  const energyKeywords = [
    "pseg",
    "energy",
    "electric",
    "power",
    "solar",
    "utility",
    "utilities",
    "water",
    "gas",
    "nuclear",
    "clean water",
    "exelon",
    "orsted",
    "con ed",
  ];
  if (energyKeywords.some((k) => text.includes(k))) {
    return "energy_utilities";
  }

  // Finance/Insurance
  const financeKeywords = [
    "bank",
    "capital",
    "credit",
    "prudential",
    "chubb",
    "securities",
    "cpa",
    "accounting",
    "pac for insurance",
  ];
  if (
    financeKeywords.some((k) => text.includes(k)) ||
    /\binsur|\bfinanc|\binvest/i.test(text)
  ) {
    return "finance_insurance";
  }

  // Tech/Telecom
  const techKeywords = [
    "telecom",
    "verizon",
    "at&t",
    "comcast",
    "cable",
    "software",
    "digital",
    "wireless",
    "google",
    "amazon",
    "meta",
  ];
  if (techKeywords.some((k) => text.includes(k)) || /\btech|\bai\b/i.test(text)) {
    return "tech_telecom";
  }

  // Law/Lobbying
  const lawKeywords = [
    "attorney",
    "esq",
    "justice",
    "lobby",
    "government relations",
    "public affairs",
    "gibbons",
    "lowenstein",
  ];
  if (
    lawKeywords.some((k) => text.includes(k)) ||
    /\blaw\b|\bllp\b|\blegal\b/i.test(text)
  ) {
    return "law_lobbying";
  }

  // 2. Fallback by individual status / institutional contributorType
  if (donor.isIndividual || ctype === "INDIVIDUAL") {
    return "civic_grassroots";
  }

  const ctUpper = ctype.toUpperCase();
  if (
    ctUpper.includes("PROFESSIONAL PAC") ||
    ctUpper.includes("LOBBY") ||
    ctUpper.includes("LEGAL") ||
    ctUpper.includes("ATTORNEY")
  ) {
    return "law_lobbying";
  }
  if (ctUpper.includes("UNION") || ctUpper.includes("LABOR")) {
    return "labor_unions";
  }
  if (
    ctUpper.includes("BUSINESS") ||
    ctUpper.includes("CORP") ||
    ctUpper.includes("TRADE") ||
    ctUpper.includes("MANAGEMENT") ||
    ctUpper.includes("EXECUTIVE")
  ) {
    return "finance_insurance";
  }

  return "civic_grassroots";
}

function emptySectorTotals(): Record<DonorSectorKey, number> {
  return {
    real_estate: 0,
    healthcare_pharma: 0,
    energy_utilities: 0,
    finance_insurance: 0,
    labor_unions: 0,
    law_lobbying: 0,
    tech_telecom: 0,
    civic_grassroots: 0,
  };
}

export function computeLegislatorInfluence(
  legislator: Legislator,
  donorProfiles?: DonorProfile[] | DonorProfile | null,
): LegislatorInfluenceSummary {
  const sectorTotals = emptySectorTotals();
  let totalRaised = 0;
  let grassrootsAmount = 0;
  let institutionalAmount = 0;

  const profiles: DonorProfile[] = Array.isArray(donorProfiles)
    ? donorProfiles
    : donorProfiles
      ? [donorProfiles]
      : [];

  for (const profile of profiles) {
    for (const donor of profile.donors ?? []) {
      const amount = typeof donor.amount === "number" ? donor.amount : 0;
      totalRaised += amount;

      const sector = classifyDonorSector(donor);
      sectorTotals[sector] += amount;

      if (donor.isIndividual === true || donor.contributorType === "INDIVIDUAL") {
        grassrootsAmount += amount;
      } else {
        institutionalAmount += amount;
      }
    }
  }

  totalRaised = Math.round(totalRaised * 100) / 100;
  grassrootsAmount = Math.round(grassrootsAmount * 100) / 100;
  institutionalAmount = Math.round(institutionalAmount * 100) / 100;

  for (const key of Object.keys(sectorTotals) as DonorSectorKey[]) {
    sectorTotals[key] = Math.round(sectorTotals[key] * 100) / 100;
  }

  const grassrootsPct =
    totalRaised > 0 ? Math.round((grassrootsAmount / totalRaised) * 100) : 0;
  const institutionalPct =
    totalRaised > 0 ? 100 - grassrootsPct : 0;

  const sortedSectors: SectorTotal[] = (
    Object.entries(sectorTotals) as [DonorSectorKey, number][]
  )
    .filter(([, amount]) => amount > 0)
    .map(([sector, amount]) => ({
      sector,
      amount,
      pct: totalRaised > 0 ? Math.round((amount / totalRaised) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const top3Sectors = sortedSectors.slice(0, 3);
  const committeeAlignments: CommitteeAlignment[] = [];

  for (const committee of legislator.committees ?? []) {
    for (const topSec of top3Sectors) {
      const def = SECTOR_BY_KEY.get(topSec.sector);
      if (def && def.committeeCodes.includes(committee.code)) {
        committeeAlignments.push({
          committeeCode: committee.code,
          committeeName: committee.name,
          sector: topSec.sector,
          sectorAmount: topSec.amount,
        });
      }
    }
  }

  committeeAlignments.sort((a, b) => b.sectorAmount - a.sectorAmount);

  return {
    legislatorId: legislator.id,
    totalRaised,
    grassrootsAmount,
    institutionalAmount,
    grassrootsPct,
    institutionalPct,
    sectorTotals,
    topSectors: sortedSectors,
    committeeAlignments,
  };
}
