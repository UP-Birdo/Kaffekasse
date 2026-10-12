/*
 * bildschirm-statistik.js — der Tab „Statistik“ (Mitte, seit 0.6.0; Nutzer 09.10.2026:
 * „statistik mit allen möglichen kassen daten“). Für die gewählte Kasse und den Zeitraum
 * (30 Tage · Alles):
 *   Kacheln    Packungen, Ausgaben, Ø Preis, Ø Lager (Kauf → geöffnet), Ø Verbrauch
 *              (geöffnet → leer), je Woche
 *   Personen   Packungen und Ausgaben je Person (Balken aus Bordmitteln)
 *   Produkte   seit 0.9.0 je Produkt nur EINE schlanke Zeile (Bild, Name, Packungen, Dran) —
 *              Tipp → Blatt mit allen Zahlen im Zeitraum (Nutzer 12.10.2026: „nicht so überladen
 *              mit Text, sondern drauf drücken und dahinter Popup mit mehr Fakten“): Packungen,
 *              Ø Preis, offen seit, „leer ~“, dran, Läden, Angebote, Lager, MHD, Balken je Person
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
        STATISTIK._zwischentitel(ort, "Produkte");
        const liste = document.createElement("div");
        liste.className = "produkt-liste";
        for (const p of st.produkte) {
            const zeile = document.createElement("button");
            zeile.type = "button";
            zeile.className = "produkt-zeile";
            zeile.setAttribute("aria-label", p.produkt.name + " · Statistik");
            zeile.addEventListener("click", () => STATISTIK.produktBlatt(p.produkt.id));
            zeile.appendChild(START._produktBild(p.produkt));
            const text = document.createElement("span");
            text.className = "produkt-text";
            const name = document.createElement("b");
            name.className = "produkt-name";
            name.textContent = p.produkt.name;
            text.appendChild(name);
            const zahlen = document.createElement("span");
            zahlen.className = "produkt-zahlen";
            zahlen.textContent = [p.packungen + (p.packungen === 1 ? " Packung" : " Packungen"),
                p.dran ? "Dran: " + (p.dran === uid ? "Du" : KASSE.mitgliedName(stand, p.dran)) : ""].filter(Boolean).join(" · ");
            text.appendChild(zahlen);
            zeile.appendChild(text);
            zeile.appendChild(ZUSTAND.zeichen("pfeil", "produkt-pfeil"));
            liste.appendChild(zeile);
        }
        ort.appendChild(liste);
    },

    /* Das Blatt mit allen Zahlen EINES Produkts im gewählten Zeitraum (0.9.0). Unten der Weg zu
       den Fakten des Produkts (Bestand, Nährwerte, Einstellen — js\bildschirm-produkte.js). */
    produktBlatt(produktId) {
        const S = STEUERUNG;
        if (!S.stand || typeof UPCREW_BLATT === "undefined") {
            return;
        }
        const stand = S.stand;
        const jetzt = S.jetzt();
        const zeitraum = KASSE.zeitraum(jetzt, STATISTIK.art);
        const p = KASSE.statistik(stand, zeitraum).produkte.find((x) => x.produkt.id === produktId);
        if (!p) {
            return;
        }
        const uid = (typeof KONTO !== "undefined") ? KONTO.uid() : null;
        const u = KASSE.uebersicht(stand, zeitraum).find((x) => x.produkt.id === produktId);
        UPCREW_BLATT.oeffnen({
            titel: p.produkt.name,
            klasse: "blatt-produktstatistik",
            inhalt: (el) => {
                const unter = document.createElement("p");
                unter.className = "packung-kopf";
                unter.textContent = zeitraum.art === "30" ? "30 Tage" : "Alles";
                el.appendChild(unter);
                STATISTIK._produktFakten(el, stand, p, jetzt, uid);
                if (u && u.personen.length) {
                    const wer = KASSE_BLATT._abschnitt(el, "Wer kauft");
                    const karte = document.createElement("div");
                    karte.className = "uebersicht";
                    for (const person of u.personen) {
                        karte.appendChild(STATISTIK._balkenZeile(person.uid === uid ? "Du" : person.name, person.anteil,
                            String(person.menge), person.uid === uid));
                    }
                    wer.appendChild(karte);
                }
                el.appendChild(KASSE_BLATT._knoepfe(
                    DIALOG.knopf("Ok", "haupt", () => UPCREW_BLATT.schliessen()),
                    DIALOG.knopf("Produkt", "still", () => PRODUKTE.blatt(produktId))));
            }
        });
    },

    /* Die Zahlen als Kacheln (früher zwei lange Textzeilen auf der Seite). */
    _produktFakten(el, stand, p, jetzt, uid) {
        const l = BESTAND.lage(stand, p.produkt.id, jetzt);
        el.appendChild(STATISTIK.kacheln([
            { titel: "Packungen", wert: String(p.packungen) },
            { titel: "Ø Preis", wert: KASSE.euro(p.schnittPreis) },
            { titel: "Offen seit", wert: p.offen ? KASSE.gross(KASSE.datumKurz(p.offen.geoeffnetAm, jetzt)) : "–" },
            /* Liegt die Schätzung schon hinter uns, ist die Packung länger offen als üblich. */
            { titel: "Leer ~", wert: !p.prognose ? "–" : p.prognose < jetzt ? "überfällig" : KASSE.gross(KASSE.datumKurz(p.prognose, jetzt)) },
            { titel: "Dran", wert: p.dran ? (p.dran === uid ? "Du" : KASSE.mitgliedName(stand, p.dran)) : "–" },
            { titel: "Je Woche", wert: p.jeWoche === null ? "–" : String(p.jeWoche).replace(".", ",") },
            { titel: "Angebot", wert: l.angebotsquote ? BESTAND.prozent(l.angebotsquote) : "–" },
            { titel: "Ø Ersparnis", wert: l.ersparnis > 0 ? KASSE.euro(l.ersparnis) : "–" },
            { titel: "Nächstes ~", wert: l.naechstesAngebot ? KASSE.gross(KASSE.datumKurz(l.naechstesAngebot.naechstes, jetzt)) : "–" },
            { titel: "Lager max", wert: KASSE.dauerText(l.lagerMaxMs) },
            { titel: "MHD", wert: (l.naechstesMhd || l.abgelaufen) ? BESTAND.mhdLageText(l, jetzt) : "–" },
            { titel: "Läden", wert: l.laeden.length ? l.laeden.map((x) => x.laden).join(", ") : "–" }
        ]));
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = STATISTIK;
}
