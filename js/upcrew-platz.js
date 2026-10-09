/*
 * upcrew-platz.js — der PLATZ: jede sichtbare Grafik ist ein benannter, austauschbarer Platz (zu
 * css\upcrew-platz.css). Gemeinsamer Baustein: in die Apps KOPIEREN, nie abwandeln.
 *
 * Nutzer, 03.10.2026: „alle disings die du erstellt hats muss man später manuell mal nach bauen oder ich gebe dir
 * passende dateien damit nur das gerüst … von ki gebaut ist“. Darum: Kein Baustein vergräbt eine Grafik im Code.
 * Er fragt hier nach dem Platz — Name, Maß — und bekommt ein Element. Steht für den Namen eine Datei in der Liste
 * der gelieferten Plätze (heute leer), zeigt der Platz die Datei; sonst einen schlichten Platzhalter.
 *
 *     UPCREW_PLATZ.bauen("symbol/muenze", "24x24", { inhalt: element })   → <span class="up-platz" …>
 *         inhalt   wahlfrei: was der Platzhalter zeigt (ein Element — z. B. das heutige gezeichnete Zeichen)
 *         html     wahlfrei: dasselbe als HTML-Text DES SPIELS (z. B. Blunderlucks kleine Brett-Bilder)
 *         text     wahlfrei: Wort, aus dem das Kürzel wird (sonst der letzte Teil des Namens)
 *         klasse   wahlfrei: Zusatzklasse
 *     UPCREW_PLATZ.stueck(stueck, { modus, html, klasse })                → der Platz eines Katalog-Stücks
 *         Farbwelt zeigt ihren Farbton, Schrift „Ag“, Knöpfe einen Mini-Knopf (aus den Bausteinen, keine Datei
 *         nötig); alles andere das Kürzel seines Namens.
 *     UPCREW_PLATZ.html(name, mass, opt) / .stueckHtml(stueck, opt)       → dasselbe als HTML-Text
 *     UPCREW_PLATZ.liefern({ "symbol/muenze": "muenze.svg" })             → Dateien anmelden (relativ zu `pfad`)
 *     UPCREW_PLATZ.pfad = "bilder/plaetze/"                               → wo die Dateien liegen
 *     UPCREW_PLATZ.plaetze()                                              → [{ name, mass, wo, anzahl }]
 *     UPCREW_PLATZ.tabelle()                                              → PLAETZE.md als Text
 *     UPCREW_PLATZ.SPIEL_PLAETZE                                          → feste Plätze der Spiele (nur Liste)
 *
 * Jeder Platz trägt `data-platz` (Name) und `data-mass` (Liefer-Maß in px bei 1x, Breite x Höhe). Wie groß er
 * im Bild steht, sagt die Stelle, an der er sitzt (CSS: Breite; die Höhe folgt dem Seitenverhältnis des Maßes).
 * „Plätze zeigen“: Klasse `up-platz-zeigen` an einem Vorfahren — jeder Platz zeigt dann Namen und Maß.
 */
(function () {
    "use strict";

    /* Die gelieferten Plätze: Name → Datei. HEUTE LEER — bis eine Datei da ist, steht der Platzhalter. */
    const GELIEFERT = {};
    let pfad = "bilder/plaetze/";

    /* Feste Plätze der Bausteine (alles außer den Stück-Bildern des Katalogs). */
    const FEST = [
        { name: "symbol/muenze", mass: "24x24", wo: "Shop: Guthaben und Preise (Platzhalter: heutige Münze)" },
        { name: "symbol/wuerfel", mass: "24x24", wo: "Sammlung: Würfel-Knopf (Platzhalter: heutiger Würfel)" },
        { name: "symbol/schloss", mass: "16x16", wo: "Sammlung: Hinweis „nicht im Besitz“ über der Vorschau" },
        { name: "kategorie/sets", mass: "96x96", wo: "Sammlung: Kachel „Sets“ (solange kein Set gemerkt ist)" },
        { name: "kategorie/abzeichen", mass: "96x96", wo: "Sammlung: Kachel „Abzeichen“" },
        { name: "kategorie/<kennung>", mass: "96x96",
            wo: "Sammlung: je eigenem Abschnitt eines Spiels (Typoluck: modi · Blunderluck: faehigkeiten, brettformen)" },
        { name: "stueck/<regal>/<wert>", mass: "96x96",
            wo: "Sammlung: Stücke eigener Regale eines Spiels außerhalb des Katalogs (Blunderluck: brett, figurart)" },
        { name: "vorrat/<spiel>/leben", mass: "48x48", wo: "Shop, Reiter des Spiels (Platzhalter: heutiges Zeichen)",
            anzahl: 2 },
        { name: "vorrat/<spiel>/tipp", mass: "48x48", wo: "Shop, Reiter des Spiels (Platzhalter: heutiges Zeichen)",
            anzahl: 2 },
        { name: "symbol/offline", mass: "16x16",
            wo: "Offline-Hinweis: Zeichen am Profilbild und im Spiel-Kopf, beide Spiele (Platzhalter: Wolke mit Strich)" },
        { name: "symbol/hochgeladen", mass: "16x16", wo: "Offline-Hinweis: kurzer Haken nach dem Hochladen, beide Spiele" }
    ];

    /* Feste Plätze, die ein SPIEL selbst zeichnet (nicht Sammlung/Shop) — nur für die Liste PLAETZE.md, gelesen aus
       den Spielen (04.10.2026). Blunderluck ruft außerhalb der Bausteine heute keinen Platz auf. Ein neuer Platz im
       Spiel wird hier nachgetragen, dann `tabelle()` nach PLAETZE.md schreiben (der Test vergleicht beide). */
    const SPIEL_PLAETZE = [
        { spiel: "typoluck", name: "start/art-bibliothek", mass: "26x26", wo: "Start: Zeichen der Art „Bibliothek“ (js\\bildschirm-start.js)" },
        { spiel: "typoluck", name: "start/art-ueben", mass: "26x26", wo: "Start: Zeichen der Art „Üben“ (js\\bildschirm-start.js)" },
        { spiel: "typoluck", name: "start/art-duell", mass: "26x26", wo: "Start: Zeichen der Art „Duell“, sobald das Duell eingeschaltet ist (js\\bildschirm-start.js)" },
        { spiel: "typoluck", name: "bibliothek/kapitel-weg", mass: "366x520", wo: "Bibliothek: Grund der Karte (dehnbar — füllt die ganze Karte; js\\start-bibliothek.js)" },
        { spiel: "typoluck", name: "bibliothek/station-wort", mass: "48x48", wo: "Bibliothek: Station Wort (Platzhalter: Initiale)" },
        { spiel: "typoluck", name: "bibliothek/station-elite", mass: "48x48", wo: "Bibliothek: Station Elite" },
        { spiel: "typoluck", name: "bibliothek/station-truhe", mass: "48x48", wo: "Bibliothek: Station Truhe" },
        { spiel: "typoluck", name: "bibliothek/station-haendler", mass: "48x48", wo: "Bibliothek: Station Händler" },
        { spiel: "typoluck", name: "bibliothek/station-rast", mass: "48x48", wo: "Bibliothek: Station Rast" },
        { spiel: "typoluck", name: "bibliothek/station-fund", mass: "48x48", wo: "Bibliothek: Station Fund" },
        { spiel: "typoluck", name: "bibliothek/station-boss", mass: "48x48", wo: "Bibliothek: Station Boss" },
        { spiel: "typoluck", name: "bibliothek/eingang", mass: "24x24", wo: "Bibliothek: Eingang des Kapitel-Wegs" },
        { spiel: "typoluck", name: "bibliothek/ausgang", mass: "24x24", wo: "Bibliothek: Ausgang des Kapitel-Wegs" },
        { spiel: "typoluck", name: "bibliothek/buch-lexikon", mass: "48x64", wo: "Bibliothek, Verlauf: Buch „Das Bilderlexikon“" },
        { spiel: "typoluck", name: "bibliothek/buch-tagebuch", mass: "48x64", wo: "Bibliothek, Verlauf: Buch „Das Tagebuch“" },
        { spiel: "typoluck", name: "bibliothek/buch-kochbuch", mass: "48x64", wo: "Bibliothek, Verlauf: Buch „Das Kochbuch“" },
        { spiel: "typoluck", name: "bibliothek/buch-reise", mass: "48x64", wo: "Bibliothek, Verlauf: Buch „Der Reiseführer“" },
        { spiel: "typoluck", name: "bibliothek/buch-krimi", mass: "48x64", wo: "Bibliothek, Verlauf: Buch „Der Krimi“" },
        { spiel: "typoluck", name: "bibliothek/buch-woerterbuch", mass: "48x64", wo: "Bibliothek, Verlauf: Buch „Das Wörterbuch“" },
        { spiel: "typoluck", name: "duell/vs-bild", mass: "390x300", wo: "Duell: Bild „gegen“ (Karte auf dem Start, Duell-Seite mit und ohne Duell; js\\bildschirm-duell.js)" },
        { spiel: "typoluck", name: "duell/wort-geholt", mass: "120x120", wo: "Duell: du holst ein Wort" },
        { spiel: "typoluck", name: "duell/sieg", mass: "160x160", wo: "Duell: Ende, gewonnen" },
        { spiel: "typoluck", name: "duell/niederlage", mass: "160x160", wo: "Duell: Ende, verloren" }
    ];

    function kuerzel(name) {
        const worte = String(name || "").replace(/[^A-Za-zÄÖÜäöüß0-9 -]/g, "").split(/[ -]+/).filter(Boolean);
        if (worte.length === 0) {
            return "";
        }
        return (worte.length > 1 ? worte[0][0] + worte[1][0] : worte[0].slice(0, 2)).toUpperCase();
    }

    function bauen(name, mass, opt) {
        const o = opt || {};
        const el = document.createElement("span");
        el.className = "up-platz" + (o.klasse ? " " + o.klasse : "");
        el.dataset.platz = String(name);
        el.dataset.mass = String(mass);
        el.setAttribute("aria-hidden", "true");
        const teile = /^(\d+)x(\d+)$/.exec(String(mass));
        if (teile) {
            el.style.setProperty("--up-pl-verhaeltnis", teile[1] + " / " + teile[2]);
        }
        const datei = GELIEFERT[name];
        if (typeof datei === "string" && datei) {
            const bild = document.createElement("img");
            bild.className = "up-platz-bild";
            bild.alt = "";
            bild.decoding = "async";
            bild.src = pfad + datei;
            el.classList.add("up-platz-geliefert");
            el.appendChild(bild);
            return el;
        }
        if (o.inhalt && typeof o.inhalt === "object" && o.inhalt.nodeType === 1) {
            el.classList.add("up-platz-eigen");
            el.appendChild(o.inhalt);
        } else if (typeof o.html === "string" && o.html) {
            el.classList.add("up-platz-eigen");
            el.innerHTML = o.html;
        } else {
            el.classList.add("up-platz-leer");
            el.textContent = kuerzel(o.text || String(name).split("/").pop());
        }
        return el;
    }

    /* Hell oder dunkel — für den Farbton einer Farbwelt. */
    function modusJetzt() {
        const A = (typeof window !== "undefined") ? window.UPCREW_AUSSEHEN : null;
        return (A && typeof A.modus === "function") ? A.modus() : "dunkel";
    }

    /* Die Grundfarben einer Farbwelt: aus UPCREW_INTRO.WELTEN, sonst die Vorschau-Farben des Katalogs. */
    function weltFarben(wert, modus) {
        const W = (typeof window !== "undefined" && window.UPCREW_INTRO) ? window.UPCREW_INTRO.WELTEN : null;
        if (W && W[wert]) {
            return W[wert][modus];
        }
        const K = globalThis.UPCREW_KATALOG;
        const s = K ? K.stueck("farbwelt", wert) : null;
        return (s && s.vorschau) ? s.vorschau[modus] : null;
    }

    function el(tag, klasse, text) {
        const e = document.createElement(tag);
        if (klasse) {
            e.className = klasse;
        }
        if (text !== undefined && text !== null) {
            e.textContent = String(text);
        }
        return e;
    }

    /* Der Platz eines Katalog-Stücks. */
    function stueck(s, opt) {
        const o = opt || {};
        const K = globalThis.UPCREW_KATALOG;
        const art = K ? K.art(s.art) : null;
        const mass = art ? art.mass : "96x96";
        const name = s.platz || ("stueck/" + s.art + "/" + s.wert);
        const zusatz = { klasse: "up-platz-stueck" + (o.klasse ? " " + o.klasse : ""), text: s.name };
        if (GELIEFERT[name]) {
            return bauen(name, mass, zusatz);
        }
        if (s.art === "farbwelt" || s.art === "paket") {
            const f = weltFarben(s.wert, o.modus === "hell" || o.modus === "dunkel" ? o.modus : modusJetzt());
            if (f) {
                const muster = el("span", "up-platz-muster");
                for (const farbe of [f.bg, f.fl, f.ak]) {
                    const streifen = el("i");
                    streifen.style.background = farbe;
                    muster.appendChild(streifen);
                }
                zusatz.inhalt = muster;
            }
        } else if (s.art === "schrift") {
            const A = (typeof window !== "undefined") ? window.UPCREW_AUSSEHEN : null;
            if (A && typeof A.schriftLaden === "function") {
                A.schriftLaden(s.wert);
            }
            const aa = el("span", "up-platz-aa", "Ag");
            aa.style.fontFamily = "'Crew " + s.wert + "'";
            zusatz.inhalt = aa;
        } else if (s.art === "knoepfe") {
            const mini = el("span", "up-platz-mini");
            mini.dataset.knoepfe = s.wert;
            const knopf = el("span", "up-kn up-haupt");
            knopf.appendChild(el("i", "up-led"));
            knopf.appendChild(document.createTextNode("Los"));
            mini.appendChild(knopf);
            zusatz.inhalt = mini;
        } else if (typeof o.html === "string" && o.html) {
            zusatz.html = o.html;
        } else if (o.inhalt) {
            zusatz.inhalt = o.inhalt;
        }
        return bauen(name, mass, zusatz);
    }

    const html = (name, mass, opt) => bauen(name, mass, opt).outerHTML;
    const stueckHtml = (s, opt) => stueck(s, opt).outerHTML;

    function liefern(liste) {
        if (liste && typeof liste === "object") {
            Object.assign(GELIEFERT, liste);
        }
    }

    /* ---------- Die Liste aller Plätze (PLAETZE.md) — rein, ohne Bildschirm ---------- */

    function plaetze() {
        const K = globalThis.UPCREW_KATALOG;
        const liste = [];
        if (K) {
            const je = K.zahlen();
            for (const a of K.ARTEN) {
                const spiel = a.spiel === "alle" ? "beide Spiele" : "nur " + a.spiel;
                const wo = (a.schluessel === "paket" ? "Shop" : (a.schluessel === "abzeichen"
                    ? "geführt (Bild heute aus upcrew-abzeichen.js)" : "Sammlung + Shop")) + ", " + spiel
                    + (a.bild === "baustein" ? " — Bild kommt aus den Bausteinen, keine Datei nötig" : "");
                liste.push({ name: "stueck/" + a.schluessel + "/<wert>", mass: a.mass, wo: wo,
                    anzahl: je[a.schluessel] || 0, art: a.schluessel });
            }
        }
        for (const p of FEST) {
            liste.push({ name: p.name, mass: p.mass, wo: p.wo, anzahl: p.anzahl || 1 });
        }
        return liste;
    }

    function tabelle() {
        const K = globalThis.UPCREW_KATALOG;
        const alle = plaetze();
        const zeilen = [];
        let stuecke = 0;
        let fest = 0;
        let ohneDatei = 0;
        zeilen.push("# Plätze — Sammlung und Shop (Runde 8)", "");
        zeilen.push("Erzeugt aus `js\\upcrew-katalog.js` und `js\\upcrew-platz.js` (`UPCREW_PLATZ.tabelle()`) — "
            + "nicht von Hand ändern.", "");
        zeilen.push("Jeder Platz ist ein Element mit `data-platz` (Name) und `data-mass` (Liefer-Maß in px bei 1x, "
            + "Breite x Höhe; bitte als SVG oder als PNG in 3x). Eine gelieferte Datei wird in "
            + "`UPCREW_PLATZ.liefern({ \"<name>\": \"<datei>\" })` angemeldet; bis dahin steht der Platzhalter. "
            + "In der Probe-Seite sichtbar machen: „Plätze zeigen“ bzw. `&plaetze=1`.", "");
        zeilen.push("## Stück-Bilder (ein Bild je Sammel-Stück)", "", "| Platz | Maß | wo zu sehen | Anzahl |",
            "|---|---|---|---|");
        for (const p of alle.filter((e) => e.art)) {
            zeilen.push("| `" + p.name + "` | " + p.mass + " | " + p.wo + " | " + p.anzahl + " |");
            stuecke += p.anzahl;
            const a = K.art(p.art);
            if (a.bild === "baustein") {
                ohneDatei += p.anzahl;
            }
        }
        zeilen.push("| **Summe Stück-Bilder** | | | **" + stuecke + "** |", "");
        zeilen.push("Davon brauchen " + ohneDatei + " keine Datei (Farbton, Schriftprobe „Ag“, Mini-Knopf). "
            + "Die Paket-Karte zeichnet sich aus der Farbwelt des Pakets; ihr Platz ist nur für ein eigenes "
            + "Paket-Bild gedacht.", "");
        zeilen.push("## Feste Plätze", "", "| Platz | Maß | wo zu sehen | Anzahl |", "|---|---|---|---|");
        for (const p of alle.filter((e) => !e.art)) {
            zeilen.push("| `" + p.name + "` | " + p.mass + " | " + p.wo + " | " + p.anzahl + " |");
            fest += p.anzahl;
        }
        zeilen.push("| **Summe feste Plätze** | | | **" + fest + "** |", "");
        zeilen.push("**Gesamt: " + (stuecke + fest) + " Plätze** (Zeilen mit `<…>` zählen je einmal bzw. mit "
            + "der genannten Anzahl; wie viele Abschnitte und eigene Regale ein Spiel mitbringt, bestimmt das "
            + "Spiel).", "");
        zeilen.push("Kein Platz, sondern Gerüst (gezeichnet aus den Farbwelt-Variablen): die Vorschau der Sammlung, "
            + "die Paket-Karte mit „UPCREW“ und Kachel-Vorschau, Bänder, Striche, die Marke am angelegten Stück.", "");
        zeilen.push("## Plätze der Spiele (von den Spielen selbst gezeichnet)", "");
        zeilen.push("Aus `UPCREW_PLATZ.SPIEL_PLAETZE` (von Hand nachgetragen, gelesen aus den Spielen). Blunderluck "
            + "zeichnet außerhalb von Sammlung und Shop heute keinen eigenen Platz.", "");
        zeilen.push("| Spiel | Platz | Maß | wo zu sehen |", "|---|---|---|---|");
        for (const p of SPIEL_PLAETZE) {
            zeilen.push("| " + p.spiel + " | `" + p.name + "` | " + p.mass + " | " + p.wo + " |");
        }
        zeilen.push("| **Summe Plätze der Spiele** | | | **" + SPIEL_PLAETZE.length + "** |", "");
        zeilen.push("Zusammen mit Sammlung und Shop: **" + (stuecke + fest + SPIEL_PLAETZE.length) + " Plätze**.", "");
        zeilen.push("## Alle Stück-Plätze im Einzelnen", "");
        if (K) {
            for (const a of K.ARTEN) {
                const liste = K.stuecke(a.schluessel).map((s) => "`" + s.wert + "` " + s.name
                    + (s.wirkt ? "" : " (bald)"));
                zeilen.push("- **" + a.name + "** (`stueck/" + a.schluessel + "/…`, " + liste.length + "): "
                    + liste.join(" · "));
            }
        }
        zeilen.push("");
        return zeilen.join("\n");
    }

    const UPCREW_PLATZ = {
        GELIEFERT: GELIEFERT, FEST: FEST, SPIEL_PLAETZE: SPIEL_PLAETZE,
        get pfad() { return pfad; },
        set pfad(p) { pfad = String(p); },
        bauen: bauen, stueck: stueck, html: html, stueckHtml: stueckHtml, liefern: liefern, kuerzel: kuerzel,
        weltFarben: weltFarben, plaetze: plaetze, tabelle: tabelle
    };
    globalThis.UPCREW_PLATZ = UPCREW_PLATZ;
    if (typeof module !== "undefined" && module.exports) {
        module.exports = UPCREW_PLATZ;
    }
})();
