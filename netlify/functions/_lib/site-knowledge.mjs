// ===== Site Adapter (FrameMind) — backend knowledge =====
// Jediný autoritativní zdroj faktů o tomto webu pro hybridního agenta.
// Engine (chat.mjs) sahá výhradně sem — nikdy nehardcoduje fakta o majiteli.
// Drop na jiný web = přepiš hodnoty tady, engine se nemění.
// Zrcadlí frontend CHATBOT_SITE_MANIFEST v src/js/chatbot.js.

const LATEST_GALLERY = {
  title: "Přerov vs Velká Bystřice 2.5.2026",
  projectId: "sport-12",
  url: "/galerie/prerov-vs-velka-bystrice/",
  photos: 23,
};

const PUBLIC_KNOWLEDGE = {
  owner: {
    name: "Lukáš Drštička",
    location: "Přerov",
    email: "lukas.drsticka@gmail.com",
    roles: ["fotograf", "AI builder", "webový vývojář", "automatizace"],
  },
  services: [
    "sportovní fotografie (zápasy, utkání, sportovní akce)",
    "portrétní fotografie",
    "AI chatboti",
    "AI agenti",
    "automatizace webu a firemních procesů",
    "jednoduché webové stránky",
  ],
  projects: [
    {
      name: "Fotograf AI",
      type: "AI projekt",
      description: "AI editor pro fotografy zaměřený na zrychlení úprav a zachování kontroly nad výsledkem.",
    },
    {
      name: "Zábavní chatbot",
      type: "AI projekt",
      description: "Chatbot pro doporučování filmů, seriálů, her a knih podle dotazu uživatele.",
    },
    {
      name: "Hybridní agent / Lukáš AI",
      type: "webový AI agent",
      description: "Veřejný agent na osobním webu, který umí odpovídat textem i hlasem a navigovat uživatele po webu.",
    },
  ],
  collaborations: [
    {
      name: "1.FC Viktorie Přerov",
      type: "fotbalový klub / vizuální a sportovní obsah",
      description: "Tvorba sportovního a klubového vizuálního obsahu.",
    },
  ],
  portfolioHighlights: [
    "Sigma Olomouc vs Mainz",
    "Přerov vs Brodek 14.3.2026",
    "Přerov vs Postřelmov 28.3.2026",
    "Přerov vs Mohelnice 18.4.2026",
    "SK Sigma Olomouc vs 1.FC Slovácko 19.4.2026",
    "Přerov vs Velká Bystřice 2.5.2026",
    "portrétní galerie",
    "sportovní fotografie",
    "AI projekty",
  ],
  latestGallery: LATEST_GALLERY,
};

export { LATEST_GALLERY, PUBLIC_KNOWLEDGE };
