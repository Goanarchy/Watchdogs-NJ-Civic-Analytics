const COMMITTEE_NAMES: Record<string, string> = {
  "Aging and Human Services": "Envejecimiento y Servicios Humanos",
  "Agriculture and Natural Resources": "Agricultura y Recursos Naturales",
  Appropriations: "Asignaciones",
  Budget: "Presupuesto",
  "Budget and Appropriations": "Presupuesto y Asignaciones",
  "Children, Families and Food Security": "Niños, Familias y Seguridad Alimentaria",
  Commerce: "Comercio",
  "Commerce and Economic Development": "Comercio y Desarrollo Económico",
  "Community and Urban Affairs": "Asuntos Comunitarios y Urbanos",
  "Community Development and Women's Affairs":
    "Desarrollo Comunitario y Asuntos de la Mujer",
  "Consumer Affairs": "Asuntos del Consumidor",
  "Economic Growth": "Crecimiento Económico",
  Education: "Educación",
  "Environment and Energy": "Medio Ambiente y Energía",
  "Environment and Solid Waste": "Medio Ambiente y Residuos Sólidos",
  "Financial Institutions and Insurance": "Instituciones Financieras y Seguros",
  Health: "Salud",
  "Health Infrastructure": "Infraestructura de Salud",
  "Health, Human Services and Senior Citizens":
    "Salud, Servicios Humanos y Personas Mayores",
  "Higher Education": "Educación Superior",
  Housing: "Vivienda",
  "Joint Budget Oversight": "Supervisión Presupuestaria Conjunta",
  "Joint Committee on the Public Schools": "Comité Conjunto de Escuelas Públicas",
  Judiciary: "Justicia",
  Labor: "Trabajo",
  "Law and Public Safety": "Ley y Seguridad Pública",
  "Legislative Oversight": "Supervisión Legislativa",
  "Military and Veterans' Affairs": "Asuntos Militares y de Veteranos",
  "Oversight, Reform and Federal Relations":
    "Supervisión, Reforma y Relaciones Federales",
  "Public Safety and Preparedness": "Seguridad Pública y Preparación",
  "Regulated Professions": "Profesiones Reguladas",
  "Science, Innovation and Technology": "Ciencia, Innovación y Tecnología",
  "State and Local Government": "Gobierno Estatal y Local",
  "State Government, Wagering, Tourism & Historic Preservation":
    "Gobierno Estatal, Apuestas, Turismo y Preservación Histórica",
  "State Leasing and Space Utilization Committee":
    "Comité de Arrendamientos y Uso de Espacios Estatales",
  "Telecommunications and Utilities": "Telecomunicaciones y Servicios Públicos",
  "Tourism, Gaming and the Arts": "Turismo, Juegos y Artes",
  Transportation: "Transporte",
  "Transportation and Independent Authorities":
    "Transporte y Autoridades Independientes",
};

const LEADERSHIP_TITLES: Record<string, string> = {
  "Senate President": "Presidente del Senado",
  "Senate President Pro Tempore": "Presidente Pro Tempore del Senado",
  "Senate Majority Leader": "Líder de la Mayoría del Senado",
  "Assembly Speaker": "Presidente de la Asamblea",
  "Speaker Pro Tempore": "Presidente Pro Tempore",
  "Majority Leader": "Líder de la Mayoría",
  "Minority Leader": "Líder de la Minoría",
  "Republican Leader": "Líder Republicano",
  "Deputy Speaker": "Vicepresidente",
  "Deputy Majority Leader": "Vicelíder de la Mayoría",
  "Deputy Minority Leader": "Vicelíder de la Minoría",
  "Deputy Republican Leader": "Vicelíder Republicano",
  "Assistant Majority Leader": "Asistente del Líder de la Mayoría",
  "Assistant Minority Leader": "Asistente del Líder de la Minoría",
  "Majority Whip": "Coordinador de Bancada de la Mayoría",
  "Minority Whip": "Coordinador de Bancada de la Minoría",
  "Republican Whip": "Coordinador de Bancada Republicano",
  "Deputy Whip": "Subcoordinador de Bancada",
  "Deputy Majority Whip": "Subcoordinador de Bancada de la Mayoría",
  "Deputy Minority Whip": "Subcoordinador de Bancada de la Minoría",
  "Assistant Minority Whip": "Asistente del Coordinador de Bancada de la Minoría",
  "Majority Conference Leader": "Líder de la Conferencia de la Mayoría",
  "Minority Conference Leader": "Líder de la Conferencia de la Minoría",
  "Conference Leader": "Líder de la Conferencia",
  "Deputy Conference Leader": "Vicelíder de la Conferencia",
  "Deputy Parliamentarian": "Viceparlamentario",
  "Minority Parliamentarian": "Parlamentario de la Minoría",
  "Majority Caucus Chair": "Presidente del Caucus de la Mayoría",
  "Assembly Budget Chair": "Presidente del Comité de Presupuesto de la Asamblea",
  "Assembly Appropriations Chair":
    "Presidente del Comité de Asignaciones de la Asamblea",
  "Minority Budget Officer": "Responsable de Presupuesto de la Minoría",
  "Republican Budget Officer": "Responsable de Presupuesto Republicano",
  "Policy Chair/Deputy Speaker": "Presidente de Política / Vicepresidente",
  "Minority Policy Chair": "Presidente de Política de la Minoría",
  "Constituent Outreach Chair": "Presidente de Enlace con Constituyentes",
  "Deputy Speaker/Deputy Whip": "Vicepresidente / Subcoordinador de Bancada",
  "Deputy Speaker/Parliamentarian": "Vicepresidente / Parlamentario",
  "Deputy Majority Leader/Deputy Conference Leader":
    "Vicelíder de la Mayoría / Vicelíder de la Conferencia",
  "Ranking Member Judiciary Committee":
    "Miembro de Mayor Rango, Comité de Justicia",
};

import type { Lang } from "./i18n";

export function partyLabel(party: string, lang: Lang = "en"): string {
  if (party === "D") return lang === "es" ? "Demócrata" : "Democrat";
  if (party === "R") return lang === "es" ? "Republicano" : "Republican";
  if (party === "G") return lang === "es" ? "Verde" : "Green";
  if (party === "SW") return lang === "es" ? "Trabajadores Socialistas" : "Socialist Workers";
  return lang === "es" ? "Independiente" : "Independent";
}

export function partyClass(party: string): string {
  if (party === "D") return "party-d";
  if (party === "R") return "party-r";
  if (party === "G") return "party-g";
  if (party === "SW") return "party-sw";
  return "party-i";
}

export function partyShortLabel(party: string, lang: Lang = "en"): string {
  if (party === "D") return lang === "es" ? "Demócrata" : "Democratic";
  if (party === "R") return lang === "es" ? "Republicano" : "Republican";
  if (party === "G") return lang === "es" ? "Verde" : "Green";
  if (party === "SW") return lang === "es" ? "Trabajadores Socialistas" : "Socialist Workers";
  return lang === "es" ? "Independiente" : "Independent";
}

export function chamberLabel(chamber: string, lang: Lang = "en"): string {
  if (chamber === "Senate") return lang === "es" ? "Senado" : "Senate";
  return lang === "es" ? "Asamblea General" : "General Assembly";
}

export function roleLabel(chamber: string, lang: Lang = "en"): string {
  if (chamber === "Senate") return lang === "es" ? "Senador" : "Senator";
  return lang === "es" ? "Asambleísta" : "Assemblymember";
}

export function translateLeadership(title: string, lang: Lang = "en"): string {
  return lang === "es" ? LEADERSHIP_TITLES[title] ?? title : title;
}

export function translateCommittee(name: string, lang: Lang = "en"): string {
  return lang === "es" ? COMMITTEE_NAMES[name] ?? name : name;
}

export function translateCommitteePosition(
  position: string,
  lang: Lang = "en",
): string {
  if (lang !== "es") return position;
  const map: Record<string, string> = {
    Chair: "Presidente",
    "Vice-Chair": "Vicepresidente",
    "Co-Chair": "Copresidente",
  };
  return map[position] ?? position;
}

export function formatDate(iso: string, lang: Lang = "en"): string {
  return new Intl.DateTimeFormat(lang === "es" ? "es-US" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function billTypeLabel(type: "P" | "C", lang: Lang = "en"): string {
  if (lang === "es") return type === "P" ? "Primario" : "Copatrocinador";
  return type === "P" ? "Primary" : "Cosponsor";
}

export function padDistrict(district: number): string {
  return String(district).padStart(2, "0");
}

export function billUrl(bill: string, session: number): string {
  return `https://www.njleg.state.nj.us/bill-search/${session}/${encodeURIComponent(
    bill,
  )}`;
}

export function translateAddressType(type: string, lang: Lang = "en"): string {
  if (!type) return lang === "es" ? "Oficina" : "Office";
  if (lang !== "es") return type;
  const map: Record<string, string> = {
    "District Office": "Oficina de distrito",
    "Main Office": "Oficina principal",
    "Legislative Office": "Oficina legislativa",
    Other: "Otra oficina",
  };
  return map[type] ?? type;
}

export function translateSourceName(name: string, lang: Lang = "en"): string {
  if (lang !== "es") return name;
  if (name === "New Jersey Legislature") return "Legislatura de Nueva Jersey";
  return name;
}

export function translateSourceLabel(label: string, lang: Lang = "en"): string {
  if (lang !== "es") return label;
  return label
    .replace("NJ Decides 2025 voter guide", "Guía electoral NJ Decides 2025")
    .replace("NJ Decides 2023 voter guide", "Guía electoral NJ Decides 2023")
    .replace("voter guides", "guías electorales");
}

export function translatePromiseQuestion(
  question: string | undefined,
  lang: Lang = "en",
): string | undefined {
  if (!question || lang !== "es") return question;
  const q = question.toLowerCase();
  if (q.includes("top issue")) {
    return "¿Cuál es su tema principal en esta elección y cómo planea abordarlo?";
  }
  if (q.includes("key election issue")) {
    return "¿Cuál es el tema clave de campaña en su distrito?";
  }
  if (q.includes("specific proposals") && q.includes("affordable")) {
    return "¿Qué propuestas concretas impulsaría para hacer más asequible vivir en Nueva Jersey?";
  }
  if (q.includes("housing affordability") && q.includes("property taxes")) {
    return "¿Cómo abordaría la asequibilidad de la vivienda y los impuestos a la propiedad?";
  }
  if (q.includes("affordable housing")) {
    return "¿Apoyaría reformas sobre vivienda asequible en Nueva Jersey?";
  }
  if (q.includes("funding cuts")) {
    return "¿Cómo respondería ante recortes de fondos federales o estatales en su distrito?";
  }
  return question;
}

export function translateBillAction(action: string, lang: Lang = "en"): string {
  if (!action || lang !== "es") return action;
  return action
    .replace(/^Introduced,\s*Referred to\s*/i, "Presentado, remitido al comité de ")
    .replace(/^Introduced$/i, "Presentado")
    .replace(/^Approved P\.L\./i, "Aprobado Ley Pública P.L.")
    .replace(/^Passed Assembly/i, "Aprobado por la Asamblea")
    .replace(/^Passed Senate/i, "Aprobado por el Senado")
    .replace(/^Received in the Senate/i, "Recibido en el Senado")
    .replace(/^Received in the Assembly/i, "Recibido en la Asamblea")
    .replace(/Reported from Committee/i, "Dictaminado en comité")
    .replace(/2nd Reading/i, "2.ª lectura")
    .replace(/Committee/i, "Comité");
}
