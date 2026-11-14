import fs from "node:fs";

const bills = JSON.parse(fs.readFileSync("./src/data/bills.json", "utf8"));

const topics = {
  "taxes-budget": [
    [4, /\b(property tax|income tax|sales tax|tax credit|tax break|tax abatement|tax exemption|tax rate|taxpayer|taxation|taxes?)\b/],
    [3, /\b(budget|appropriation|fiscal|revenue|surplus|deficit|bond|borrowing|debt service|treasury)\b/],
    [2, /\b(fee|fees|surcharge|levy|mill rate|valuation|assessment)\b/],
  ],
  housing: [
    [4, /\b(affordable housing|rent control|rental|renters?|landlord|tenant|eviction|foreclosure|mortgage|zoning|condominium|homeowners?|homeless)\b/],
    [2, /\b(housing|residential|apartment|dwelling|development|construction)\b/],
  ],
  health: [
    [4, /\b(health care|healthcare|medicaid|medicare|hospital|prescription|pharmaceutical|opioid|addiction|mental health|behavioral health|nursing home|patient|physician|nurse|dental|pregnancy|abortion|vaccine|vaccination|disease|telehealth|cancer|autism|disability services)\b/],
    [2, /\b(health|medical|medicine|insurance coverage|treatment|therapy|clinic|drug|pharmacy)\b/],
  ],
  education: [
    [4, /\b(public school|school district|schools?|students?|teachers?|curriculum|classroom|tuition|college|university|higher education|scholarship|literacy|special education|charter school|school board)\b/],
    [2, /\b(education|academic|learning|library|libraries|training program)\b/],
  ],
  "environment-energy": [
    [4, /\b(climate change|greenhouse gas|emissions?|carbon|solar|wind energy|offshore wind|renewable|fossil fuel|pollution|contaminat|wastewater|drinking water|wetlands?|flood|shore|beach|offshore|pipeline|lead paint|pfas|pesticide|endangered species|wildlife|open space|recycling|landfill|air quality)\b/],
    [2, /\b(environment|environmental|energy|electric|utility|utilities|water|air|waste|conservation|parks?|forest|fish|gas|oil|power plant)\b/],
  ],
  "safety-justice": [
    [4, /\b(crime|criminal|police|law enforcement|firearm|gun|weapon|prison|inmate|jail|court|judge|prosecutor|bail|parole|probation|domestic violence|human trafficking|assault|theft|burglary|robbery|homicide|juvenile|expungement|victim|sexual assault|kidnapping|arson)\b/],
    [2, /\b(public safety|emergency|fire|investigation|enforcement|offense|penalty|sentencing)\b/],
  ],
  "economy-labor": [
    [4, /\b(minimum wage|wage|worker|workers|employee|employer|employment|unemployment|labor|union|collective bargaining|overtime|paid leave|sick leave|workplace|job|jobs|workforce|small business|business|economic development|contractor|gig worker|internship|apprentice)\b/],
    [2, /\b(economy|economic|industry|manufacturing|commerce|trade|entrepreneur|startup|tourism|film production)\b/],
  ],
  transportation: [
    [4, /\b(transportation|nj transit|transit|bus|rail|train|railroad|highway|road|bridge|tunnel|traffic|vehicle|driver|pedestrian|bicycle|airport|port authority|toll|mvc|motor vehicle|autonomous|rideshare|sidewalk|street)\b/],
    [2, /\b(infrastructure|parking|freight|commut)\b/],
  ],
  "immigration-rights": [
    [4, /\b(immigrant|immigration|migrant|asylum|refugee|citizenship|visa|deportation|undocumented|civil rights|discrimination|bias|human rights|lgbtq|gender identity|sexual orientation|racial|race|religious|harassment|equal pay|equality|language access|hate crime)\b/],
    [2, /\b(diversity|inclusion|equity|minority|women|disabled|disability)\b/],
  ],
  elections: [
    [4, /\b(election|voter|voting|ballot|campaign|candidate|redistricting|polling place|primary election|electoral|petition|recall|political party|voter registration|campaign finance)\b/],
    [2, /\b(democracy|civic|wards?|districts?)\b/],
  ],
  "families-social": [
    [4, /\b(child care|childcare|children|child|family|families|parent|foster care|adoption|daycare|senior citizens?|elderly|food security|snap|hunger|poverty|welfare|social services|maternal|infant|domestic workers?|youth)\b/],
    [2, /\b(caregiver|assistance|benefits|community|nonprofit)\b/],
  ],
  "government-ethics": [
    [4, /\b(ethics|corruption|transparency|public records|opra|lobbying|conflict of interest|inspector general|procurement|government contract|municipal|county government|local government|civil service|state agency|oversight|audit|accountability|open government)\b/],
    [2, /\b(government|state|commission|authority|board|appointment|public official)\b/],
  ],
  "agriculture-food": [
    [4, /\b(farm|farmer|agriculture|agricultural|crop|livestock|dairy|soil|pesticide|fertilizer|food|restaurant|grocery|winery|brewery|fishing|hunting|animal|veterinary)\b/],
  ],
  veterans: [
    [4, /\b(veteran|veterans|military|armed forces|national guard|service member|deployment|gi bill)\b/],
  ],
  "technology-privacy": [
    [4, /\b(artificial intelligence|cybersecurity|data privacy|personal data|internet|broadband|social media|digital|algorithm|surveillance|drone|blockchain|cryptocurrency|online|smartphone|biometric|privacy)\b/],
    [2, /\b(technology|computer|software|electronic|telecommunications?)\b/],
  ],
  "insurance-consumer": [
    [4, /\b(insurance|insurer|premium|deductible|claim|consumer protection|warranty|home warranty|health insurance|auto insurance|flood insurance|coverage)\b/],
  ],
  "arts-culture": [
    [4, /\b(arts?|culture|cultural|museum|historic|history|heritage|film|music|theater|theatre|festival|tourism)\b/],
  ],
  cannabis: [
    [4, /\b(cannabis|marijuana|thc|dispensary|cannabis industry)\b/],
  ],
  "sports-gaming": [
    [4, /\b(sports betting|gambling|casino|lottery|fantasy sports|wagering|horse racing)\b/],
  ],
};

const stats = {};
const samples = {};
let other = 0;

for (const [code, bill] of Object.entries(bills)) {
  const text = bill.synopsis.toLowerCase();
  let best = "other";
  let bestScore = 0;
  for (const [slug, rules] of Object.entries(topics)) {
    let score = 0;
    for (const [weight, re] of rules) {
      if (re.test(text)) score += weight;
    }
    if (score > bestScore) {
      bestScore = score;
      best = slug;
    }
  }
  stats[best] = (stats[best] ?? 0) + 1;
  (samples[best] ??= []).push(`${code}: ${bill.synopsis}`);
  if (best === "other") other++;
}

console.log("total", Object.keys(bills).length, "other", other);
for (const [slug, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
  console.log(String(count).padStart(5), slug);
}
console.log("\n--- samples top 5 ---");
for (const [slug] of Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
  console.log(`\n### ${slug}`);
  for (const s of samples[slug].slice(0, 8)) console.log(" -", s.slice(0, 180));
}
console.log("\n--- other samples ---");
for (const s of (samples.other ?? []).slice(0, 25)) console.log(" -", s.slice(0, 180));
