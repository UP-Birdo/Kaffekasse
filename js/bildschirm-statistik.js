/*
 * bildschirm-statistik.js — der Tab „Statistik“ (Mitte, seit 0.6.0; Nutzer 09.10.2026:
 * „statistik mit allen möglichen kassen daten“). Für die gewählte Kasse und den Zeitraum
 * (30 Tage · Alles):
 *   Kacheln    Packungen, Ausgaben, Ø Preis, Ø Lager (Kauf → geöffnet), Ø Verbrauch
 *              (geöffnet → leer), je Woche
 *   Personen   Packungen und Ausgaben je Person (Balken aus Bordmitteln)
 *   Produkte   je Produkt: Packungen, Ø Preis, offen seit, „leer ~“ (Prognose), dran, Balken;
 *              seit 0.7.0 Läden, Angebotsquote, Ø Ersparnis, nächstes Angebot, Lager, MHD
 *   Verlauf    darunter wie bisher (VERLAUF.liste), jede Zeile → Packungs-Blatt
 * Kurze Beschriftungen, keine Sätze. Alle Zahlen aus dem Modell (KASSE.statistik,
 * KASSE.uebersicht) — der Bildschirm rechnet nichts.
 */

const STATISTIK = {

    art: "30",
    loesen: null,

    zeichnen(ort) {
        ort.textContent = "";
        const titel = document.createElement("h1");
        titel.className = "seite-titel";
        titel.textContent = "Statistik";
        ort.appendChild(titel);

        if (!STATISTIK.loesen) {
            STATISTIK.loesen = STEUERUNG.beobachten(() => NAVIGATION.veralten("statistik"));
        }

        const S = STEUERUNG;
        if (!S.hatKasse() || !S.stand) {
            const karte = document.createElement("section");
            karte.className = "karte";
            karte.appendChild(ZUSTAND.leer({ zeichen: "statistik", text: S.hatKasse() ? "Kasse lädt" : "Noch keine Kasse" }));
            ort.appendChild(karte);
            return;
        }

        const stand = S.stand;
        const jetzt = S.jetzt();
        const zeitraum = KASSE.zeitraum(jetzt, STATISTIK.art);

        if (typeof UPCREW_EINSTELLUNGEN !== "undefined") {
            const huelle = document.createElement("div");
            huelle.className = "verlauf-schalter";
            huelle.appendChild(UPCREW_EINSTELLUNGEN.segment(
                [{ wert: "30", text: "30 Tage" }, { wert: "alle", text: "Alles" }],
                STATISTIK.art,
                (wert) => { STATISTIK.art = wert; NAVIGATION.veralten("statistik"); },
                "Zeitraum"));
            ort.appendChild(huelle);
        }

        const st = KASSE.statistik(stand, zeitraum);
        const g = st.gesamt;
        ort.appendChild(STATISTIK.kacheln([
            { titel: "Packungen", wert: String(g.packungen) },
            { titel: "Ausgaben", wert: g.mitPreis > 0 ? KASSE.euro(g.ausgaben) : "–" },
            { titel: "Ø Preis", wert: KASSE.euro(g.schnittPreis) },
            { titel: "Je Woche", wert: g.jeWoche === null ? "–" : String(g.jeWoche).replace(".", ",") },
            { titel: "Ø Lager", wert: KASSE.dauerText(g.lagerMs) },
            { titel: "Ø Verbrauch", wert: KASSE.dauerText(g.verbrauchMs) }
        ]));

        STATISTIK._personen(ort, st.personen);
        STATISTIK._produkte(ort, stand, st, zeitraum, jetzt);

        STATISTIK._zwischentitel(ort, "Verlauf");
        VERLAUF.liste(ort, stand, zeitraum);
    },

    /* Kleine Kacheln: Titel klein, Wert groß. Auch für das Profil und das Produkt-Blatt. */
    kacheln(liste) {
        const raster = document.createElement("div");
        raster.className = "kacheln";
        for (const k of liste || []) {
            const kachel = document.createElement("div");
            kachel.className = "kachel";
            const titel = document.createElement("small");
            titel.textContent = k.titel;
            const wert = document.createElement("b");
            wert.textContent = k.wert;
            kachel.appendChild(titel);
            kachel.appendChild(wert);
            raster.appendChild(kachel);
        }
        return raster;
    },

    _zwischentitel(ort, text) {
        const h = document.createElement("h3");
        h.className = "verlauf-tag";
        h.textContent = text;
        ort.appendChild(h);
    },

    _balkenZeile(name, anteil, rechts, ich) {
        const zeile = document.createElement("div");
        zeile.className = "balken-zeile" + (ich ? " balken-ich" : "");
        const wer = document.createElement("span");
        wer.className = "balken-name";
        wer.textContent = name;
        const balken = document.createElement("span");
        balken.className = "balken";
        balken.setAttribute("role", "img");
        balken.setAttribute("aria-label", name + " " + rechts);
        const fuellung = document.createElement("i");
        fuellung.style.width = Math.round(Math.max(0, Math.min(1, anteil)) * 100) + "%";
        balken.appendChild(fuellung);
        const menge = document.createElement("span");
        menge.className = "balken-menge";
        menge.textContent = rechts;
        zeile.appendChild(wer);
        zeile.appendChild(balken);
        zeile.appendChild(menge);
        return zeile;
    },

    _personen(ort, personen) {
        if (!personen.length) {
            return;
        }
        const uid = (typeof KONTO !== "undefined") ? KONTO.uid() : null;
        STATISTIK._zwischentitel(ort, "Personen");
        const karte = document.createElement("section");
        karte.className = "uebersicht";
        karte.setAttribute("aria-label", "Personen");
        for (const p of personen) {
            const rechts = p.packungen + (p.ausgaben > 0 ? " · " + KASSE.euro(p.ausgaben) : "");
            karte.appendChild(STATISTIK._balkenZeile(p.uid === uid ? "Du" : p.name, p.anteil, rechts, p.uid === uid));
        }
        ort.appendChild(karte);
    },

    _produkte(ort, stand, st, zeitraum, jetzt) {
        if (!st.produkte.length) {
            return;
        }
        const uid = (typeof KONTO !== "undefined") ? KONTO.uid() : null;
        const balken = {};
        for (const u of KASSE.uebersicht(stand, zeitraum)) {
            balken[u.produkt.id] = u.personen;
        }
        STATISTIK._zwischentitel(ort, "Produkte");
        for (const p of st.produkte) {
            const karte = document.createElement("section");
            karte.className = "uebersicht";
            karte.setAttribute("aria-label", p.produkt.name);

            const kopf = document.createElement("div");
            kopf.className = "uebersicht-kopf";
            const name = document.createElement("b");
            name.textContent = p.produkt.name;
            const rechts = document.createElement("span");
            rechts.textContent = p.dran ? "Dran: " + (p.dran === uid ? "Du" : KASSE.mitgliedName(stand, p.dran)) : "";
            kopf.appendChild(name);
            kopf.appendChild(rechts);
            karte.appendChild(kopf);

            const fakten = [p.packungen + (p.packungen === 1 ? " Packung" : " Packungen")];
            if (p.schnittPreis !== null) {
                fakten.push("Ø " + KASSE.euro(p.schnittPreis));
            }
            if (p.offen) {
                fakten.push("offen seit " + KASSE.datumKurz(p.offen.geoeffnetAm, jetzt));
            }
            if (p.prognose) {
                /* Liegt die Schätzung schon hinter uns, ist die Packung länger offen als üblich. */
                fakten.push(p.prognose < jetzt ? "leer? überfällig" : "leer ~" + KASSE.datumKurz(p.prognose, jetzt));
            }
            const zeile = document.createElement("div");
            zeile.className = "uebersicht-fakten";
            zeile.textContent = fakten.join(" · ");
            karte.appendChild(zeile);

            /* Seit 0.7.0: Läden, Angebote, Lagerzeit verschlossen, MHD (BESTAND.lage). */
            const l = BESTAND.lage(stand, p.produkt.id, jetzt);
            const mehr = [];
            if (l.laeden.length) {
                mehr.push(l.laeden.map((x) => x.laden).join(", "));
            }
            if (l.angebotsquote) {
                mehr.push("Angebot " + BESTAND.prozent(l.angebotsquote));
            }
            if (l.ersparnis > 0) {
                mehr.push("Ø -" + KASSE.euro(l.ersparnis));
            }
            if (l.naechstesAngebot) {
                mehr.push("nächstes ~" + KASSE.datumKurz(l.naechstesAngebot.naechstes, jetzt));
            }
            if (l.lagerMaxMs !== null) {
                mehr.push("Lager max " + KASSE.dauerText(l.lagerMaxMs));
            }
            if (l.naechstesMhd || l.abgelaufen) {
                mehr.push("MHD " + BESTAND.mhdLageText(l, jetzt));
            }
            if (mehr.length) {
                const zeile2 = document.createElement("div");
                zeile2.className = "uebersicht-fakten";
                zeile2.textContent = mehr.join(" · ");
                karte.appendChild(zeile2);
            }

            for (const person of balken[p.produkt.id] || []) {
                karte.appendChild(STATISTIK._balkenZeile(person.uid === uid ? "Du" : person.name, person.anteil,
                    String(person.menge), person.uid === uid));
            }
            ort.appendChild(karte);
        }
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = STATISTIK;
}
