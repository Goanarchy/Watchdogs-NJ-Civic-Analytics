import type { Lang } from "./i18n";

export type TopicSlug =
  | "taxes-budget"
  | "housing"
  | "health"
  | "education"
  | "environment-energy"
  | "safety-justice"
  | "economy-labor"
  | "transportation"
  | "immigration-rights"
  | "elections"
  | "families-social"
  | "government-ethics"
  | "agriculture-food"
  | "veterans"
  | "technology-privacy"
  | "insurance-consumer"
  | "arts-culture"
  | "cannabis"
  | "other";

export interface TopicDefinition {
  slug: TopicSlug;
  label: Record<Lang, string>;
  tagline: Record<Lang, string>;
  description: Record<Lang, string>;
  color: string;
}

export const TOPICS: TopicDefinition[] = [
  {
    slug: "taxes-budget",
    label: { en: "Taxes & Budget", es: "Impuestos y presupuesto" },
    tagline: {
      en: "Revenue, spending, credits and fiscal policy",
      es: "Ingresos, gasto, créditos y política fiscal",
    },
    description: {
      en: "Bills that set, change or study taxes, tax credits and exemptions, state appropriations, budgets, borrowing and other fiscal tools. It also includes measures that direct how public money is raised or spent.",
      es: "Proyectos que fijan, modifican o estudian impuestos, créditos y exenciones fiscales, asignaciones estatales, presupuestos, endeudamiento y otras herramientas fiscales. También incluye medidas que dirigen cómo se recauda o se gasta el dinero público.",
    },
    color: "#a9854c",
  },
  {
    slug: "housing",
    label: { en: "Housing & Rent", es: "Vivienda y alquiler" },
    tagline: {
      en: "Affordability, tenants, zoning and homelessness",
      es: "Asequibilidad, inquilinos, zonificación y desamparo",
    },
    description: {
      en: "Bills on affordable housing, rent and eviction, landlord–tenant rules, mortgages and foreclosure, zoning, condominiums, redevelopment and homelessness. It brings together the rules that shape where and how New Jersey residents live.",
      es: "Proyectos sobre vivienda asequible, alquiler y desalojo, reglas entre propietarios e inquilinos, hipotecas y ejecuciones, zonificación, condominios, reurbanización y desamparo. Reúne las reglas que determinan dónde y cómo viven los residentes de Nueva Jersey.",
    },
    color: "#8c6d5a",
  },
  {
    slug: "health",
    label: { en: "Health Care", es: "Salud" },
    tagline: {
      en: "Access, coverage, hospitals and public health",
      es: "Acceso, cobertura, hospitales y salud pública",
    },
    description: {
      en: "Bills on health coverage and Medicaid, hospitals and clinics, prescription drugs, mental and behavioral health, nursing, reproductive health, vaccines and disease response. It also covers professional licensing and public-health preparedness.",
      es: "Proyectos sobre cobertura de salud y Medicaid, hospitales y clínicas, medicamentos recetados, salud mental y conductual, enfermería, salud reproductiva, vacunas y respuesta a enfermedades. También cubre licencias profesionales y preparación en salud pública.",
    },
    color: "#4f7f6e",
  },
  {
    slug: "education",
    label: { en: "Education & Schools", es: "Educación y escuelas" },
    tagline: {
      en: "Schools, students, teachers and higher education",
      es: "Escuelas, estudiantes, docentes y educación superior",
    },
    description: {
      en: "Bills on public schools and school districts, students and teachers, curriculum and school safety, special education, libraries, colleges, universities, tuition and student aid. It captures the rules that govern learning from early childhood through higher education.",
      es: "Proyectos sobre escuelas públicas y distritos escolares, estudiantes y docentes, currículo y seguridad escolar, educación especial, bibliotecas, colegios, universidades, matrícula y ayuda estudiantil. Recoge las reglas que rigen el aprendizaje desde la primera infancia hasta la educación superior.",
    },
    color: "#2c5d86",
  },
  {
    slug: "environment-energy",
    label: { en: "Environment & Energy", es: "Medio ambiente y energía" },
    tagline: {
      en: "Climate, water, waste, utilities and conservation",
      es: "Clima, agua, residuos, servicios públicos y conservación",
    },
    description: {
      en: "Bills on climate and emissions, renewable and conventional energy, drinking water and pollution, wetlands and flooding, waste and recycling, open space, wildlife, parks and coastal protection. It also includes utility regulation and environmental permitting.",
      es: "Proyectos sobre clima y emisiones, energía renovable y convencional, agua potable y contaminación, humedales e inundaciones, residuos y reciclaje, espacios abiertos, vida silvestre, parques y protección costera. También incluye regulación de servicios públicos y permisos ambientales.",
    },
    color: "#5f7d4f",
  },
  {
    slug: "safety-justice",
    label: { en: "Public Safety & Justice", es: "Seguridad pública y justicia" },
    tagline: {
      en: "Crime, policing, courts and corrections",
      es: "Crimen, policía, tribunales y correccionales",
    },
    description: {
      en: "Bills on criminal offenses and penalties, policing and law enforcement, firearms, courts and sentencing, prisons and parole, domestic violence, human trafficking and support for victims. It also covers juvenile justice and expungement.",
      es: "Proyectos sobre delitos y penas, policía y aplicación de la ley, armas de fuego, tribunales y sentencias, prisiones y libertad condicional, violencia doméstica, trata de personas y apoyo a víctimas. También cubre justicia juvenil y eliminación de antecedentes.",
    },
    color: "#8f4036",
  },
  {
    slug: "economy-labor",
    label: { en: "Jobs, Labor & Economy", es: "Empleo, trabajo y economía" },
    tagline: {
      en: "Wages, workers, business and economic growth",
      es: "Salarios, trabajadores, empresas y crecimiento económico",
    },
    description: {
      en: "Bills on wages and overtime, paid leave, workplace protections, unions and collective bargaining, unemployment, workforce training, small business, industry and economic development. It also includes pensions, banking and financial services.",
      es: "Proyectos sobre salarios y horas extra, licencias pagadas, protecciones laborales, sindicatos y negociación colectiva, desempleo, capacitación laboral, pequeñas empresas, industria y desarrollo económico. También incluye pensiones, banca y servicios financieros.",
    },
    color: "#b07a3c",
  },
  {
    slug: "transportation",
    label: { en: "Transportation & Infrastructure", es: "Transporte e infraestructura" },
    tagline: {
      en: "Transit, roads, vehicles and public works",
      es: "Tránsito, carreteras, vehículos y obras públicas",
    },
    description: {
      en: "Bills on NJ Transit and public transit, roads and highways, bridges and tunnels, traffic and pedestrian safety, motor vehicles and licensing, airports and ports, tolls and parking. It also covers broad infrastructure and public-works rules.",
      es: "Proyectos sobre NJ Transit y transporte público, carreteras y autopistas, puentes y túneles, tráfico y seguridad peatonal, vehículos motorizados y licencias, aeropuertos y puertos, peajes y estacionamiento. También cubre infraestructura general y reglas de obras públicas.",
    },
    color: "#5b6f8a",
  },
  {
    slug: "immigration-rights",
    label: { en: "Immigration & Civil Rights", es: "Inmigración y derechos civiles" },
    tagline: {
      en: "Immigration status, equality and discrimination",
      es: "Estatus migratorio, igualdad y discriminación",
    },
    description: {
      en: "Bills on immigration status and services, asylum and refugees, citizenship, deportation, language access, discrimination and bias, lgbtq+ rights, gender and racial equity, religious freedom, disability rights and harassment. It covers both immigration policy and civil-rights protections.",
      es: "Proyectos sobre estatus migratorio y servicios, asilo y refugiados, ciudadanía, deportación, acceso lingüístico, discriminación y sesgos, derechos lgbtq+, equidad de género y racial, libertad religiosa, derechos de personas con discapacidad y acoso. Cubre tanto política migratoria como protecciones de derechos civiles.",
    },
    color: "#7a5c86",
  },
  {
    slug: "elections",
    label: { en: "Elections & Democracy", es: "Elecciones y democracia" },
    tagline: {
      en: "Voting, campaigns, ballots and redistricting",
      es: "Voto, campañas, boletas y redistribución",
    },
    description: {
      en: "Bills on voter registration and voting, ballots and polling places, campaign finance, candidates and political parties, redistricting, petitions, recalls and referendums. It also includes measures on civic participation and election administration.",
      es: "Proyectos sobre registro de votantes y voto, boletas y centros de votación, financiamiento de campañas, candidatos y partidos políticos, redistribución de distritos, peticiones, revocatorios y referendos. También incluye medidas sobre participación cívica y administración electoral.",
    },
    color: "#3f6f78",
  },
  {
    slug: "families-social",
    label: { en: "Families & Social Services", es: "Familias y servicios sociales" },
    tagline: {
      en: "Children, seniors, care and economic security",
      es: "Niñez, personas mayores, cuidado y seguridad económica",
    },
    description: {
      en: "Bills on child care and early childhood, foster care and adoption, family leave, seniors and caregivers, food security, poverty, social assistance, maternal and infant health, and youth programs. It focuses on the support systems around households and vulnerable communities.",
      es: "Proyectos sobre cuidado infantil y primera infancia, cuidado de crianza y adopción, licencias familiares, personas mayores y cuidadores, seguridad alimentaria, pobreza, asistencia social, salud materna e infantil y programas juveniles. Se centra en los sistemas de apoyo a los hogares y comunidades vulnerables.",
    },
    color: "#b06a6a",
  },
  {
    slug: "government-ethics",
    label: { en: "Government & Ethics", es: "Gobierno y ética" },
    tagline: {
      en: "Transparency, oversight, procurement and local government",
      es: "Transparencia, supervisión, compras y gobierno local",
    },
    description: {
      en: "Bills on ethics and conflicts of interest, public records and transparency, lobbying, audits and oversight, procurement and contracts, civil service, state agencies, municipalities and counties. It also includes administrative rulemaking and public appointments.",
      es: "Proyectos sobre ética y conflictos de interés, registros públicos y transparencia, cabildeo, auditorías y supervisión, compras y contratos, servicio civil, agencias estatales, municipios y condados. También incluye reglamentación administrativa y nombramientos públicos.",
    },
    color: "#6c6f78",
  },
  {
    slug: "agriculture-food",
    label: { en: "Agriculture & Food", es: "Agricultura y alimentación" },
    tagline: {
      en: "Farms, food systems, animals and fishing",
      es: "Fincas, sistemas alimentarios, animales y pesca",
    },
    description: {
      en: "Bills on farms and farmland, crops and livestock, soil and pesticides, food safety and restaurants, groceries, wineries and breweries, fishing and hunting, animal welfare and veterinary rules. It covers the state's food system from production to consumption.",
      es: "Proyectos sobre fincas y tierras agrícolas, cultivos y ganado, suelo y pesticidas, seguridad alimentaria y restaurantes, supermercados, viñedos y cervecerías, pesca y caza, bienestar animal y reglas veterinarias. Cubre el sistema alimentario estatal desde la producción hasta el consumo.",
    },
    color: "#7c8a4a",
  },
  {
    slug: "veterans",
    label: { en: "Veterans & Military", es: "Veteranos y asuntos militares" },
    tagline: {
      en: "Service members, veterans and the National Guard",
      es: "Miembros del servicio, veteranos y Guardia Nacional",
    },
    description: {
      en: "Bills on veterans' benefits and services, military personnel and families, the National Guard, deployment, recognition and transition to civilian life. It also includes matters affecting the Coast Guard and armed-forces members.",
      es: "Proyectos sobre beneficios y servicios para veteranos, personal militar y sus familias, Guardia Nacional, despliegue, reconocimiento y transición a la vida civil. También incluye asuntos que afectan a la Guardia Costera y a miembros de las fuerzas armadas.",
    },
    color: "#6b5b4b",
  },
  {
    slug: "technology-privacy",
    label: { en: "Technology & Privacy", es: "Tecnología y privacidad" },
    tagline: {
      en: "Data, broadband, AI and cybersecurity",
      es: "Datos, banda ancha, IA y ciberseguridad",
    },
    description: {
      en: "Bills on data privacy and cybersecurity, artificial intelligence and algorithms, broadband and internet access, social media, digital government, surveillance, drones, biometrics and emerging technologies. It focuses on how technology is regulated and how personal information is protected.",
      es: "Proyectos sobre privacidad de datos y ciberseguridad, inteligencia artificial y algoritmos, banda ancha y acceso a internet, redes sociales, gobierno digital, vigilancia, drones, biometría y tecnologías emergentes. Se centra en cómo se regula la tecnología y cómo se protege la información personal.",
    },
    color: "#436a7c",
  },
  {
    slug: "insurance-consumer",
    label: { en: "Insurance & Consumers", es: "Seguros y consumidores" },
    tagline: {
      en: "Coverage, premiums, claims and consumer protection",
      es: "Cobertura, primas, reclamos y protección al consumidor",
    },
    description: {
      en: "Bills on insurance coverage and premiums, health, auto and flood insurance, claims and deductibles, warranties, consumer protection and fair marketplace rules. It covers the financial products that protect households and the rules that govern them.",
      es: "Proyectos sobre cobertura y primas de seguros, seguros de salud, automóvil e inundación, reclamos y deducibles, garantías, protección al consumidor y reglas justas de mercado. Cubre los productos financieros que protegen a los hogares y las reglas que los rigen.",
    },
    color: "#9a6b45",
  },
  {
    slug: "arts-culture",
    label: { en: "Arts, Culture & Gaming", es: "Artes, cultura y juegos" },
    tagline: {
      en: "Heritage, tourism, film, sports and wagering",
      es: "Patrimonio, turismo, cine, deportes y apuestas",
    },
    description: {
      en: "Bills on arts and culture, museums and historic preservation, libraries, film and music production, tourism, festivals, sports, casinos, lottery and sports wagering. It also includes commemorative designations and heritage programs.",
      es: "Proyectos sobre artes y cultura, museos y preservación histórica, bibliotecas, producción de cine y música, turismo, festivales, deportes, casinos, lotería y apuestas deportivas. También incluye designaciones conmemorativas y programas de patrimonio.",
    },
    color: "#9a5f7a",
  },
  {
    slug: "cannabis",
    label: { en: "Cannabis", es: "Cannabis" },
    tagline: {
      en: "Legal market, licensing and regulation",
      es: "Mercado legal, licencias y regulación",
    },
    description: {
      en: "Bills on cannabis and marijuana policy, dispensaries and licensing, the legal market, taxation and regulation, and related criminal-justice adjustments. It groups the measures that shape New Jersey's cannabis framework.",
      es: "Proyectos sobre política de cannabis y marihuana, dispensarios y licencias, el mercado legal, impuestos y regulación, y ajustes relacionados con la justicia penal. Agrupa las medidas que dan forma al marco del cannabis en Nueva Jersey.",
    },
    color: "#5f7a5a",
  },
  {
    slug: "other",
    label: { en: "Other & Cross-cutting", es: "Otros y transversales" },
    tagline: {
      en: "Bills without a dominant policy area",
      es: "Proyectos sin un área de política dominante",
    },
    description: {
      en: "Bills whose official summaries do not contain a strong signal for one of the other policy areas. They may be ceremonial, technical, administrative or genuinely cross-cutting. The dashboard keeps them separate rather than forcing a misleading classification.",
      es: "Proyectos cuyos resúmenes oficiales no contienen una señal fuerte para alguna de las otras áreas de política. Pueden ser ceremoniales, técnicos, administrativos o genuinamente transversales. El dashboard los mantiene separados para no forzar una clasificación engañosa.",
    },
    color: "#9a958a",
  },
];

export const topicBySlug = new Map<TopicSlug, TopicDefinition>(
  TOPICS.map((topic) => [topic.slug, topic]),
);

const RULES: Record<Exclude<TopicSlug, "other">, Array<[number, RegExp]>> = {
  "taxes-budget": [
    [
      4,
      /\b(property tax|income tax|sales tax|tax credit|tax break|tax abatement|tax exemption|tax rate|taxpayer|taxation|taxes?|appropriat|appropriation|fiscal year|state budget|budget message|revenue|surplus|deficit|bond|borrowing|debt service|treasury)\b/,
    ],
    [
      2,
      /\b(funding|grant|subsidy|financial assistance|fee|fees|surcharge|levy|mill rate|valuation|assessment|state aid|school aid|cost-sharing)\b/,
    ],
  ],
  housing: [
    [
      4,
      /\b(affordable housing|rent control|rental|renters?|landlord|tenant|eviction|foreclosure|mortgage|zoning|condominium|homeowners?|homeless|real property|real estate|land bank|redevelopment)\b/,
    ],
    [
      2,
      /\b(housing|residential|apartment|dwelling|development|construction|deed|lease|property owner)\b/,
    ],
  ],
  health: [
    [
      4,
      /\b(health care|healthcare|medicaid|medicare|hospital|prescription|pharmaceutical|opioid|addiction|mental health|behavioral health|nursing home|patient|physician|nurse|dental|pregnancy|abortion|vaccine|vaccination|disease|telehealth|cancer|autism|substance use|recovery|suicide|cardiomyopathy|dialysis|reproductive)\b/,
    ],
    [
      2,
      /\b(health|medical|medicine|treatment|therapy|clinic|drug|pharmacy|injury|wellness|screening|practitioner|caregiver|long-term care)\b/,
    ],
  ],
  education: [
    [
      4,
      /\b(public school|school district|schools?|students?|teachers?|pupil|educator|curriculum|classroom|tuition|college|university|higher education|scholarship|literacy|special education|charter school|school board|superintendent|principal|student loan|academic)\b/,
    ],
    [
      2,
      /\b(education|learning|library|libraries|training program|vocational|apprentice|degree|enrollment|school aid)\b/,
    ],
  ],
  "environment-energy": [
    [
      4,
      /\b(climate change|greenhouse gas|emissions?|carbon|solar|wind energy|offshore wind|renewable|fossil fuel|pollution|contaminat|wastewater|drinking water|wetlands?|flood|shore|beach|offshore|pipeline|lead paint|pfas|perfluoro|pesticide|endangered species|wildlife|open space|recycling|landfill|air quality|stormwater|coastal|reservoir|nuclear|bpu|dep)\b/,
    ],
    [
      2,
      /\b(environment|environmental|energy|electric|utility|utilities|water|air|waste|conservation|parks?|forest|fish|gas|oil|power plant|dam|sewer|tree|marine|species)\b/,
    ],
  ],
  "safety-justice": [
    [
      4,
      /\b(crime|criminal|police|law enforcement|firearm|gun|weapon|prison|inmate|jail|correction|court|judge|prosecutor|bail|parole|probation|domestic violence|human trafficking|assault|theft|burglary|robbery|homicide|juvenile|expungement|victim|sexual assault|kidnapping|arson|sheriff|restraining order|stalking)\b/,
    ],
    [
      2,
      /\b(public safety|emergency|fire|investigation|enforcement|offense|penalty|sentencing|abuse|fraud|crime|forensic|body camera)\b/,
    ],
  ],
  "economy-labor": [
    [
      4,
      /\b(minimum wage|wage|worker|workers|employee|employer|employment|unemployment|labor|union|collective bargaining|overtime|paid leave|sick leave|workplace|job|jobs|workforce|small business|business|economic development|contractor|gig worker|internship|apprentice|prevailing wage|pension|retirement)\b/,
    ],
    [
      2,
      /\b(economy|economic|industry|manufacturing|commerce|trade|entrepreneur|startup|financial|bank|credit|loan|alcoholic beverage|liquor license|business license)\b/,
    ],
  ],
  transportation: [
    [
      4,
      /\b(transportation|nj transit|transit|bus|rail|train|railroad|highway|road|bridge|tunnel|traffic|vehicle|driver|pedestrian|bicycle|airport|port authority|toll|mvc|motor vehicle|autonomous|rideshare|sidewalk|street|parking|ferry|freight|turnpike|parkway|license plate)\b/,
    ],
    [2, /\b(infrastructure|commut|public works|pothole)\b/],
  ],
  "immigration-rights": [
    [
      4,
      /\b(immigrant|immigration|migrant|asylum|refugee|citizenship|visa|deportation|undocumented|civil rights|discrimination|bias|human rights|lgbtq|gender identity|sexual orientation|racial|race|religious|harassment|equal pay|equality|language access|hate crime|disability rights)\b/,
    ],
    [
      2,
      /\b(diversity|inclusion|equity|minority|women|disab|immigration status|consular)\b/,
    ],
  ],
  elections: [
    [
      4,
      /\b(election|voter|voting|ballot|campaign|candidate|redistricting|polling place|primary election|electoral|petition|recall|political party|voter registration|campaign finance|referendum)\b/,
    ],
    [2, /\b(democracy|civic|electoral college|initiative)\b/],
  ],
  "families-social": [
    [
      4,
      /\b(child care|childcare|children|child|family|families|parent|foster care|adoption|daycare|senior citizens?|elderly|food security|snap|hunger|poverty|welfare|social services|maternal|infant|domestic workers?|youth|caregiver)\b/,
    ],
    [2, /\b(assistance|benefits|nonprofit|nutrition|home care|vulnerable)\b/],
  ],
  "government-ethics": [
    [
      4,
      /\b(ethics|corruption|transparency|public records|opra|lobbying|conflict of interest|inspector general|procurement|government contract|civil service|administrative procedure|state agency|oversight|audit|accountability|open government|rulemaking|comptroller|attorney general)\b/,
    ],
    [
      2,
      /\b(government|municipal|county|local government|commission|authority|board|appointment|public official|license|permit|regulation|state|treasur)\b/,
    ],
  ],
  "agriculture-food": [
    [
      4,
      /\b(farm|farmer|agriculture|agricultural|crop|livestock|dairy|soil|pesticide|fertilizer|food|restaurant|grocery|winery|brewery|fishing|hunting|animal|veterinary|aquaculture|jersey fresh|shellfish|nursery)\b/,
    ],
  ],
  veterans: [
    [
      4,
      /\b(veteran|veterans|military|armed forces|national guard|service member|deployment|gi bill|coast guard)\b/,
    ],
  ],
  "technology-privacy": [
    [
      4,
      /\b(artificial intelligence|cybersecurity|data privacy|personal data|internet|broadband|social media|digital|algorithm|surveillance|drone|blockchain|cryptocurrency|online|smartphone|biometric|privacy|telecommunications?|automated|robot)\b/,
    ],
    [2, /\b(technology|computer|software|electronic|cable|cellular|data center|platform)\b/],
  ],
  "insurance-consumer": [
    [
      4,
      /\b(insurance|insurer|premium|deductible|claim|consumer protection|warranty|coverage|policyholder|actuarial|health insurance|auto insurance|flood insurance)\b/,
    ],
  ],
  "arts-culture": [
    [
      4,
      /\b(arts?|culture|cultural|museum|historic|history|heritage|film|music|theater|theatre|festival|tourism|sports betting|gambling|casino|lottery|fantasy sports|wagering|horse racing)\b/,
    ],
    [2, /\b(anniversary|commemorat|designat|month of|day of|recognize|honor)\b/],
  ],
  cannabis: [
    [4, /\b(cannabis|marijuana|thc|dispensary|cannabis industry)\b/],
  ],
};

const fallback: TopicDefinition = topicBySlug.get("other")!;

/**
 * Classifies a bill from its official English synopsis. The strongest
 * keyword match wins; ties keep the order defined above.
 */
export function classifyTopic(synopsis: string): TopicSlug {
  const text = synopsis.toLowerCase();
  let best: TopicSlug = "other";
  let bestScore = 0;

  for (const [slug, rules] of Object.entries(RULES) as Array<
    [Exclude<TopicSlug, "other">, Array<[number, RegExp]>]
  >) {
    let score = 0;
    for (const [weight, pattern] of rules) {
      if (pattern.test(text)) score += weight;
    }
    if (score > bestScore) {
      bestScore = score;
      best = slug;
    }
  }

  return best;
}

export function getTopic(slug: string | undefined): TopicDefinition {
  return (slug && topicBySlug.get(slug as TopicSlug)) || fallback;
}

export function topicLabel(slug: TopicSlug, lang: Lang): string {
  return topicBySlug.get(slug)?.label[lang] ?? slug;
}
