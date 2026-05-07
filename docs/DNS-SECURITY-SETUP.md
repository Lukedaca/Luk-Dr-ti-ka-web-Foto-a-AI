# DNS bezpečnostní záznamy — lukasdrsticka-ai-and-foto.com

Doplnit v DNS panelu (Wedos, Cloudflare nebo kde je doména spravována).
Doména: `lukasdrsticka-ai-and-foto.com`.

---

## 1. SPF (Sender Policy Framework) — kritické

Říká přijímacím serverům, kdo smí posílat e-maily z domény.

**TXT záznam pro `@` (root domény):**

```
v=spf1 include:_spf.google.com ~all
```

> Pokud posílám e-maily z jiné služby (Brevo, SendGrid, Mailgun), přidat příslušný `include:`.
> `~all` = soft-fail (doporučeno start). Po ověření změnit na `-all` (hard-fail).

**Ověření:** https://mxtoolbox.com/spf.aspx → zadej `lukasdrsticka-ai-and-foto.com`

---

## 2. DMARC — kritické

Politika, co dělat s e-maily, které neprojdou SPF/DKIM.

**TXT záznam pro `_dmarc`:**

Start (jen monitorování, žádný dopad):
```
v=DMARC1; p=none; rua=mailto:lukas.drsticka@gmail.com; ruf=mailto:lukas.drsticka@gmail.com; fo=1; adkim=r; aspf=r; pct=100
```

Po 2–4 týdnech monitoringu zpřísnit na:
```
v=DMARC1; p=quarantine; rua=mailto:lukas.drsticka@gmail.com; pct=100
```

A nakonec:
```
v=DMARC1; p=reject; rua=mailto:lukas.drsticka@gmail.com; pct=100
```

**Ověření:** https://mxtoolbox.com/dmarc.aspx

---

## 3. DKIM — střední priorita (Gmail / Workspace)

Pokud používám Google (Gmail/Workspace) k odesílání:
- Přihlásit se do Google Admin Console (nebo Gmail nastavení)
- **Apps > Google Workspace > Gmail > Authenticate email**
- Vygenerovat 2048-bit DKIM klíč pro doménu
- Google ukáže TXT záznam typu `google._domainkey` → vložit do DNS
- Po propagaci (do 1h) v Admin Console kliknout **Start Authentication**

Pokud posílám přes Formspree, zkontrolovat jejich DKIM nastavení v dashboardu.

---

## 4. CAA záznam — nízká priorita

Říká, která CA (Certificate Authority) smí vystavit certifikát pro doménu.

**CAA záznamy pro `@` (root):**
```
0 issue "letsencrypt.org"
0 issuewild ";"
0 iodef "mailto:lukas.drsticka@gmail.com"
```

> Netlify používá Let's Encrypt → `issue "letsencrypt.org"`.
> `issuewild ";"` = zakázat wildcard certifikáty (pokud nepotřebuji).
> Pokud bych v budoucnu chtěl jiného providera, přidám další `issue`.

---

## 5. DNSSEC — vysoká priorita

Kryptografické podepsání DNS zón. Chrání před cache poisoning a DNS hijackingem.

**Postup pro Wedos:**
1. Wedos KAS → DNS → Spravovat doménu
2. **Aktivovat DNSSEC** (klikací akce, Wedos zařídí klíče sám)
3. Pokud doména není u Wedos: zapnout u registrátora podle jejich postupu

**Postup pro Cloudflare:**
1. Cloudflare dashboard → DNS → Settings → DNSSEC → **Enable**
2. Cloudflare ukáže DS záznam → vložit u registrátora

**Ověření:** https://dnssec-analyzer.verisignlabs.com/lukasdrsticka-ai-and-foto.com

---

## Pořadí a časování

1. **Hned:** SPF + DMARC `p=none` + CAA — minimální riziko
2. **Stejný den:** DNSSEC (klikací akce u Wedos)
3. **Do týdne:** DKIM (vygenerování v Google Workspace, vložení záznamu)
4. **Za 2–4 týdny:** zpřísnit DMARC na `p=quarantine`, později `p=reject`

## Ověřovací checklist

- [ ] `dig +short TXT lukasdrsticka-ai-and-foto.com` → vrátí SPF
- [ ] `dig +short TXT _dmarc.lukasdrsticka-ai-and-foto.com` → vrátí DMARC
- [ ] `dig +short CAA lukasdrsticka-ai-and-foto.com` → vrátí CAA
- [ ] `dig +short DS lukasdrsticka-ai-and-foto.com` → vrátí DS (DNSSEC)
- [ ] https://www.checktls.com/TestReceiver → ověř MX + TLS
- [ ] https://hardenize.com/report/lukasdrsticka-ai-and-foto.com — celkový přehled
