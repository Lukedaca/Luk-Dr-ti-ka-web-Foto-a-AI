# Lokální učení agentů pomocí příkladů

Solution 1.5.0 umí změnit rozpoznání konkrétního dotazu podle příkladu, který
schválí provozovatel. Agent pak použije existující pravidlo odpovědi a jeho zdroj.
Opravy příklady neupravují váhy jazykového modelu a negeneralizují opravu na
libovolné parafráze. Podobné formulace patří mezi samostatné testovací případy.
Od verze 1.5.0 se zároveň používají obecná pravidla rozpoznávání: samostatné
pozdravy nepřebíjejí věcnou část dotazu a poslední zmínka produktu či týmu
rozhoduje o příslušném slotu. Slovník a pravidla odpovědí zůstávají u agenta.

Rozsah této změny je trénování lokálního rozpoznávání a úprava odpovědí. Stávající
chatové cesty, režimy osobního webu, navigace, souhlasy a nastavení Gemini
zálohy zůstávají zachované. Jediným připojením k běhu agenta je načtení jeho
vlastního trénovacího souboru před vytvořením existujícího enginu.

## Kde učit

| Agent | Soubor ve vlastním repozitáři | Identifikátor |
| --- | --- | --- |
| FrameMind.cz | `knowledge/intent-training.json` | `framemind` |
| Viktorka | `knowledge/intent-training.json` | `viktorka-prerov` |
| Osobní web | `knowledge/intent-training.json` | `lukas-portfolio` |
| Obchodní šablona | `knowledge/intent-training.json` | `business-template` |
| Sportovní šablona | `intent-training.json` | `sport-club` |

Každý soubor obsahuje `schemaVersion: 1`, vlastní `tenantId`, kladné celé číslo
`revision` a pole `examples`. Prázdné pole je vhodný výchozí stav nové šablony.
Příklady klientů mezi sebou nekopírujte. Při převzetí šablony změňte společně
identifikátor v souboru a ve volání `withIntentTraining`.

```json
{
  "schemaVersion": 1,
  "tenantId": "viktorka-prerov",
  "revision": 2,
  "examples": [
    { "text": "Co má mít dítě na první trénink?", "intentId": "beginner_equipment" }
  ]
}
```

`intentId` musí už existovat v konfiguraci agenta a mít pravidlo odpovědi. Pokud
je špatný samotný údaj nebo text odpovědi, upravte jeho znalostní záznam či
pravidlo v daném projektu. Trénovací příklad takovou opravu nenahrazuje.
Konkrétní termín zápasu či tréninku nadále vyžaduje čerstvá živá data.

## Postup

1. Napište vlastní příklad bez osobních údajů návštěvníka a přiřaďte správný záměr.
2. Přidejte jej do souboru příslušného agenta a zvyšte `revision`.
3. Doplňte nezávislé kontrolní formulace i delší rozhovor do evaluace.
4. Z kořene `framemind-solution` spusťte `npm run training:evaluate`. Výsledek
   porovná stejné případy bez přesných oprav a s nimi; v obou variantách používá
   současná obecná pravidla. Podrobné odpovědi uloží do reportu.
5. Spusťte testy a build dotčeného projektu. Změny se do živého webu promítnou
   až sestavením a nasazením jeho klientského i serverového kódu.

Evaluace je lokální nástroj pro tento pracovní prostor. Používá skutečné továrny
agentů, serverové továrny FrameMind a obchodní šablony a již instalovaný
TypeScript loader z Viktorky; nic nestahuje. Síťové
volání při evaluaci vyvolá chybu. Každý scénář má nový engine; tahy v rámci
scénáře sdílejí kontext. Datum jednotlivých kontrol je pevné a není důkazem
aktuálnosti ostrých klubových dat. Skript neposílá dotazy do produkce ani netestuje
Gemini, celý widget nebo doručení kontaktu.

Opravy se shodují s celou normalizovanou zprávou (bez rozdílů v diakritice,
velikosti písmen a interpunkci). Nerozšiřují automaticky akce ani oprávnění.
Konfliktní cíle stejného příkladu, cizí identifikátor a neznámé záměry se odmítají.
Soubor se načítá při sestavení/importu; editace není okamžité přeučení otevřeného
widgetu. `revision` je označení obsahu, nikoliv zámek proti souběžným editacím.
