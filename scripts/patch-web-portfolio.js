const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');

if (!fs.existsSync(indexPath)) {
  throw new Error('index.html nebyl nalezen.');
}

let html = fs.readFileSync(indexPath, 'utf8');

const websSection = `

        <!-- Weby Section -->
        <section id="weby" class="py-24 reveal portfolio-webs-section">
            <style>
                .portfolio-webs-section {
                    position: relative;
                    overflow: hidden;
                }

                .portfolio-webs-section::before {
                    content: "";
                    position: absolute;
                    inset: 10% auto auto 50%;
                    width: min(680px, 80vw);
                    height: min(680px, 80vw);
                    transform: translateX(-50%);
                    border-radius: 999px;
                    background: radial-gradient(circle, rgba(59, 130, 246, 0.16), rgba(139, 92, 246, 0.08) 42%, transparent 68%);
                    pointer-events: none;
                    filter: blur(12px);
                }

                .webs-table-wrap {
                    position: relative;
                    max-width: 980px;
                    margin: 0 auto;
                    border: 1px solid rgba(255, 255, 255, 0.16);
                    border-radius: 28px;
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.105), rgba(255, 255, 255, 0.045));
                    box-shadow: 0 28px 90px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.12);
                    backdrop-filter: blur(22px) saturate(150%);
                    -webkit-backdrop-filter: blur(22px) saturate(150%);
                    overflow: hidden;
                }

                .webs-table-head,
                .webs-table-row {
                    display: grid;
                    grid-template-columns: 1.1fr 1fr 0.75fr 0.35fr;
                    gap: 18px;
                    align-items: center;
                    padding: 20px 24px;
                }

                .webs-table-head {
                    color: rgba(255, 255, 255, 0.58);
                    font-size: 0.78rem;
                    font-weight: 700;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    background: rgba(255, 255, 255, 0.04);
                }

                .webs-table-row {
                    width: 100%;
                    border: 0;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                    background: transparent;
                    color: inherit;
                    text-align: left;
                    cursor: pointer;
                    transition: background 180ms ease, transform 180ms ease;
                }

                .webs-table-row:hover,
                .webs-table-row[aria-expanded="true"] {
                    background: rgba(255, 255, 255, 0.075);
                }

                .webs-table-row:hover {
                    transform: translateY(-1px);
                }

                .webs-client {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    min-width: 0;
                }

                .webs-client-badge {
                    width: 42px;
                    height: 42px;
                    border-radius: 14px;
                    display: grid;
                    place-items: center;
                    flex: 0 0 auto;
                    background: linear-gradient(135deg, #60a5fa, #a78bfa);
                    color: #fff;
                    font-weight: 800;
                    box-shadow: 0 14px 34px rgba(96, 165, 250, 0.28);
                }

                .webs-client strong,
                .webs-table-row strong {
                    display: block;
                    color: #fff;
                    font-weight: 800;
                }

                .webs-client span,
                .webs-table-row span {
                    display: block;
                    color: rgba(255, 255, 255, 0.64);
                    font-size: 0.92rem;
                }

                .webs-status {
                    display: inline-flex;
                    width: fit-content;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 12px;
                    border-radius: 999px;
                    border: 1px solid rgba(34, 197, 94, 0.28);
                    background: rgba(34, 197, 94, 0.11);
                    color: #86efac;
                    font-size: 0.82rem;
                    font-weight: 800;
                }

                .webs-chevron {
                    justify-self: end;
                    width: 38px;
                    height: 38px;
                    border-radius: 999px;
                    display: grid;
                    place-items: center;
                    background: rgba(255, 255, 255, 0.08);
                    color: rgba(255, 255, 255, 0.82);
                    transition: transform 180ms ease, background 180ms ease;
                }

                .webs-table-row[aria-expanded="true"] .webs-chevron {
                    transform: rotate(180deg);
                    background: rgba(96, 165, 250, 0.22);
                }

                .webs-detail {
                    display: none;
                    padding: 0 24px 24px;
                    background: rgba(255, 255, 255, 0.035);
                }

                .webs-detail.is-open {
                    display: block;
                }

                .webs-detail-card {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    gap: 20px;
                    align-items: center;
                    padding: 22px;
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    border-radius: 22px;
                    background: rgba(10, 14, 39, 0.4);
                }

                .webs-detail-card p {
                    margin: 0;
                    color: rgba(255, 255, 255, 0.72);
                }

                .webs-open-link {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 46px;
                    padding: 0 20px;
                    border-radius: 999px;
                    background: linear-gradient(135deg, #2563eb, #7c3aed);
                    color: #fff;
                    font-weight: 800;
                    text-decoration: none;
                    white-space: nowrap;
                    box-shadow: 0 16px 36px rgba(37, 99, 235, 0.28);
                    transition: transform 180ms ease, opacity 180ms ease;
                }

                .webs-open-link:hover {
                    transform: translateY(-2px);
                    opacity: 0.95;
                }

                @media (max-width: 780px) {
                    .webs-table-head {
                        display: none;
                    }

                    .webs-table-row {
                        grid-template-columns: 1fr auto;
                        gap: 14px;
                    }

                    .webs-table-row > div:nth-child(2),
                    .webs-table-row > div:nth-child(3) {
                        grid-column: 1 / -1;
                    }

                    .webs-chevron {
                        grid-column: 2;
                        grid-row: 1;
                    }

                    .webs-detail-card {
                        grid-template-columns: 1fr;
                    }

                    .webs-open-link {
                        width: 100%;
                    }
                }
            </style>

            <div class="container mx-auto px-6 section-wrap">
                <p class="text-center uppercase tracking-[0.35em] text-blue-300/80 text-sm mb-4">Portfolio realizací</p>
                <h2 class="text-4xl font-bold mb-4 text-center gradient-text section-title">Weby</h2>
                <p class="text-gray-400 text-center mb-12 max-w-2xl mx-auto">Vybrané webové projekty pro klienty — moderní prezentace, čistý design a praktické řešení podle konkrétního zadání.</p>

                <div class="webs-table-wrap" role="region" aria-label="Portfolio webových projektů">
                    <div class="webs-table-head" aria-hidden="true">
                        <div>Klient</div>
                        <div>Realizace</div>
                        <div>Typ</div>
                        <div></div>
                    </div>

                    <button class="webs-table-row" type="button" aria-expanded="false" aria-controls="web-dominika-detail" data-web-row>
                        <div class="webs-client">
                            <span class="webs-client-badge" aria-hidden="true">DK</span>
                            <div>
                                <strong>Klientka masáže Dominika Kolková</strong>
                                <span>Olomouc · osobní služby</span>
                            </div>
                        </div>
                        <div>
                            <strong>Prezentační web pro masáže</strong>
                            <span>Jemná vizuální identita, nabídka služeb a jednoduché objednání</span>
                        </div>
                        <div><span class="webs-status">Web online</span></div>
                        <div class="webs-chevron" aria-hidden="true">⌄</div>
                    </button>

                    <div id="web-dominika-detail" class="webs-detail" data-web-detail>
                        <div class="webs-detail-card">
                            <p>Realizace webu pro klientku z oblasti masáží. Cílem bylo vytvořit elegantní, klidnou a důvěryhodnou prezentaci, která návštěvníka rychle dovede k výběru služby a kontaktu.</p>
                            <a class="webs-open-link" href="https://masaze-dominika.org/" target="_blank" rel="noopener noreferrer">Otevřít web Dominiky</a>
                        </div>
                    </div>
                </div>
            </div>

            <script>
                (function () {
                    var rows = document.querySelectorAll('[data-web-row]');
                    rows.forEach(function (row) {
                        row.addEventListener('click', function () {
                            var detail = document.getElementById(row.getAttribute('aria-controls'));
                            var isOpen = row.getAttribute('aria-expanded') === 'true';
                            row.setAttribute('aria-expanded', String(!isOpen));
                            if (detail) detail.classList.toggle('is-open', !isOpen);
                        });
                    });
                })();
            </script>
        </section>
`;

html = html.replace(/\n\s*<!-- Weby Section -->[\s\S]*?<\/section>\s*(?=\n\s*<section id="skills")/, `\n${websSection}\n`);

if (!html.includes('id="weby"')) {
  if (html.includes('<section id="skills"')) {
    html = html.replace('<section id="skills"', `${websSection}\n        <section id="skills"`);
  } else if (html.includes('</main>')) {
    html = html.replace('</main>', `${websSection}\n    </main>`);
  } else {
    html += websSection;
  }
}

if (!html.includes('href="#weby"')) {
  html = html.replaceAll(
    '<a href="#portfolio" class="nav-link hover:text-blue-400 transition">Portfolio</a>',
    '<a href="#portfolio" class="nav-link hover:text-blue-400 transition">Portfolio</a>\n                <a href="#weby" class="nav-link hover:text-blue-400 transition">Weby</a>'
  );
  html = html.replaceAll(
    '<a href="#portfolio" class="mobile-menu-link hover:text-blue-400 transition">Portfolio</a>',
    '<a href="#portfolio" class="mobile-menu-link hover:text-blue-400 transition">Portfolio</a>\n            <a href="#weby" class="mobile-menu-link hover:text-blue-400 transition">Weby</a>'
  );
}

fs.writeFileSync(indexPath, html, 'utf8');
console.log('Sekce Weby byla vložena do portfolia.');
