/*
 * bildschirm-produkte.js — der Tab „Produkte“ (rechts, seit 0.6.0; Nutzer 09.10.2026: „nicht
 * die einzelnen kassen listen sondern die produkte wo in deiner angeben kasse drin sind …
 * mit fakten zum produkt anklick bar mit popup“).
 *
 * Liste: die Produkte DIESER Kasse — Bild (austauschbarer Platz), Name, Marke, Packungen,
 * Ø Preis, offene Packung seit … . Tipp → Blatt mit allen Fakten: Strichcode, Daten aus
 * Open Food Facts (Name, Marke, Bild, Link zur Produktseite), Statistik des Produkts (alle
 * Zeit), die letzten Packungen (Tipp → Packungs-Blatt), „Ausblenden“; klein unten der
 * Quellenhinweis (gehört hierher und unter „Über“, nicht auf den Start).
 *
 * Seit 0.7.0 im Blatt dazu: Bestand (reicht bis, Vorrat, Tipp, Lagerzeit verschlossen Ø/max,
 * MHD) und Angebote (Quote, Normalpreis, Ø Ersparnis, Ø Abstand, nächstes, je Laden).
 *
 * Zahlen aus dem Modell (KASSE.statistik, KASSE.produktFakten, BESTAND.lage); geschrieben über
 * die Steuerung.
 */

const PRODUKTE = {

    loesen: null,

    zeichnen(ort) {
        ort.textContent = "";
        const titel = document.createElement("h1");
        titel.className = "seite-titel";
        titel.textContent = "Produkte";
        ort.appendChild(titel);

        if (!PRODUKTE.loesen) {
            PRODUKTE.loesen = STEUERUNG.beobachten(() => NAVIGATION.veralten("produkte"));
        }

        const S = STEUERUNG;
        if (!S.hatKasse() || !S.stand) {
            const karte = document.createElement("section");
            karte.className = "karte";
            karte.appendChild(ZUSTAND.leer({ zeichen: "paket", text: S.hatKasse() ? "Kasse lädt" : "Noch keine Kasse" }));
            ort.appendChild(karte);
            return;
        }
        const jetzt = S.jetzt();
        const st = KASSE.statistik(S.stand, KASSE.zeitraum(jetzt, "alle"));
        if (st.produkte.length === 0) {
            const karte = document.createElement("section");
            karte.className = "karte";
            karte.appendChild(ZUSTAND.leer({ zeichen: "paket", text: "Noch kein Produkt", aktion: { text: "Produkt", bei: () => KASSE_BLATT.produkt() } }));
            ort.appendChild(karte);
            return;
        }
        const liste = document.createElement("div");
        liste.className = "produkt-liste";
        for (const p of st.produkte) {
            liste.appendChild(PRODUKTE._zeile(p, jetzt));
        }
        ort.appendChild(liste);
        const fuss = document.createElement("div");
        fuss.className = "start-fuss";
        fuss.appendChild(DIALOG.knopf("Produkt", "still", () => KASSE_BLATT.produkt()));
        ort.appendChild(fuss);
    },

    _zeile(p, jetzt) {
        const zeile = document.createElement("button");
        zeile.type = "button";
        zeile.className = "produkt-zeile";
        zeile.setAttribute("aria-label", p.produkt.name + " · Fakten");
        zeile.addEventListener("click", () => PRODUKTE.blatt(p.produkt.id));
        zeile.appendChild(START._produktBild(p.produkt));

        const text = document.createElement("span");
        text.className = "produkt-text";
        const name = document.createElement("b");
        name.className = "produkt-name";
        name.textContent = p.produkt.name;
        text.appendChild(name);
        if (p.produkt.marke) {
            const marke = document.createElement("small");
            marke.className = "produkt-marke";
            marke.textContent = p.produkt.marke;
            text.appendChild(marke);
        }
        const fakten = [p.packungen + (p.packungen === 1 ? " Packung" : " Packungen")];
        if (p.schnittPreis !== null) {
            fakten.push("Ø " + KASSE.euro(p.schnittPreis));
        }
        if (p.offen) {
            fakten.push("offen seit " + KASSE.datumKurz(p.offen.geoeffnetAm, jetzt));
        }
        /* Seit 0.7.0: die Läden kurz dazu. */
        const laeden = BESTAND.laeden(STEUERUNG.stand, p.produkt.id);
        if (laeden.length) {
            fakten.push(laeden.map((l) => l.laden).join(", "));
        }
        const zahlen = document.createElement("span");
        zahlen.className = "produkt-zahlen";
        zahlen.textContent = fakten.join(" · ");
        text.appendChild(zahlen);
        zeile.appendChild(text);
        zeile.appendChild(ZUSTAND.zeichen("pfeil", "produkt-pfeil"));
        return zeile;
    },

    /* Das Blatt mit allen Fakten eines Produkts. */
    blatt(produktId) {
        const S = STEUERUNG;
        if (!S.stand || typeof UPCREW_BLATT === "undefined") {
            return;
        }
        const jetzt = S.jetzt();
        const f = KASSE.produktFakten(S.stand, produktId, jetzt);
        if (!f) {
            return;
        }
        const uid = (typeof KONTO !== "undefined") ? KONTO.uid() : null;
        const wer = (u) => (u === uid ? "Du" : (KASSE.mitgliedName(S.stand, u) || "Ehemals"));
        UPCREW_BLATT.oeffnen({
            titel: f.produkt.name,
            klasse: "blatt-produktfakten",
            inhalt: (el) => {
                const kopf = document.createElement("div");
                kopf.className = "fakten-kopf";
                kopf.appendChild(START._produktBild(f.produkt));
                const text = document.createElement("div");
                text.className = "produkt-text";
                const name = document.createElement("b");
                name.className = "produkt-name";
                name.textContent = f.produkt.name;
                text.appendChild(name);
                const unter = document.createElement("small");
                unter.className = "produkt-marke";
                unter.textContent = [f.produkt.marke, f.produkt.ean].filter(Boolean).join(" · ") || "Ohne Strichcode";
                text.appendChild(unter);
                kopf.appendChild(text);
                el.appendChild(kopf);

                el.appendChild(STATISTIK.kacheln([
                    { titel: "Packungen", wert: String(f.packungen) },
                    { titel: "Ø Preis", wert: KASSE.euro(f.schnittPreis) },
                    { titel: "Ø Lager", wert: KASSE.dauerText(f.lagerMs) },
                    { titel: "Ø Verbrauch", wert: KASSE.dauerText(f.verbrauchMs) },
                    { titel: "Offen seit", wert: f.offen ? KASSE.gross(KASSE.datumKurz(f.offen.geoeffnetAm, jetzt)) : "–" },
                    { titel: "Leer ~", wert: !f.prognose ? "–" : f.prognose < jetzt ? "überfällig" : KASSE.gross(KASSE.datumKurz(f.prognose, jetzt)) },
                    { titel: "Dran", wert: f.dran ? wer(f.dran) : "–" },
                    { titel: "Je Woche", wert: f.jeWoche === null ? "–" : String(f.jeWoche).replace(".", ",") }
                ]));

                /* Seit 0.7.0: Bestand, Angebote, Haltbarkeit (BESTAND.lage). */
                const l = BESTAND.lage(S.stand, produktId, jetzt);
                const bestand = KASSE_BLATT._abschnitt(el, "Bestand");
                bestand.appendChild(STATISTIK.kacheln([
                    { titel: "Reicht bis", wert: l.leer ? "Leer" : (l.reichtBis ? "~" + KASSE.datumKurz(l.reichtBis, jetzt) : "–") },
                    { titel: "Vorrat", wert: String(l.vorrat) },
                    { titel: "Tipp", wert: l.tipp ? l.tipp.text : "–" },
                    { titel: "Lager zu Ø", wert: KASSE.dauerText(l.lagerMs) },
                    { titel: "Lager zu max", wert: KASSE.dauerText(l.lagerMaxMs) },
                    { titel: "MHD", wert: BESTAND.mhdLageText(l, jetzt) }
                ]));
                const angebote = KASSE_BLATT._abschnitt(el, "Angebote");
                angebote.appendChild(STATISTIK.kacheln([
                    { titel: "Angebotsquote", wert: BESTAND.prozent(l.angebotsquote) },
                    { titel: "Normalpreis", wert: KASSE.euro(l.normalpreis) },
                    { titel: "Ø Ersparnis", wert: l.ersparnis > 0 ? KASSE.euro(l.ersparnis) : "–" },
                    { titel: "Ø Abstand", wert: KASSE.dauerText(l.abstandMs) },
                    { titel: "Nächstes ~", wert: l.naechstesAngebot ? KASSE.gross(KASSE.datumKurz(l.naechstesAngebot.naechstes, jetzt)) : "–" },
                    { titel: "Läden", wert: String(l.laeden.length) }
                ]));
                for (const a of l.angebote) {
                    angebote.appendChild(KASSE_BLATT._hinweis(BESTAND.angebotText(a, jetzt) + " · alle " + KASSE.dauerText(a.abstandMs)));
                }
                for (const x of l.laeden) {
                    angebote.appendChild(KASSE_BLATT._hinweis(x.laden + " · " + x.packungen + (x.packungen === 1 ? " Packung" : " Packungen")));
                }

                const letzte = KASSE_BLATT._abschnitt(el, "Letzte Packungen");
                if (f.letzte.length === 0) {
                    letzte.appendChild(KASSE_BLATT._hinweis("Noch keine"));
                }
                const gruppe = document.createElement("div");
                gruppe.className = "verlauf-gruppe";
                for (const e of f.letzte) {
                    gruppe.appendChild(VERLAUF._zeile(Object.assign({ gueltig: true, produktName: KASSE.gross(KASSE.datumKurz(e.kauf, jetzt)) }, e), uid));
                }
                if (f.letzte.length) {
                    letzte.appendChild(gruppe);
                }

                /* Einstellen (0.8.0): kurzer Name für die Bestand-Karte und wie lange eine offene
                   Packung hält — leer = der Vorschlag nach dem Namen. */
                const einstellen = KASSE_BLATT._abschnitt(el, "Einstellen");
                const t = KASSE.offenTage(f.produkt);
                const nameFeld = KASSE_BLATT._feld("produkt-name-neu", "Name", "Hafermilch", "text", KASSE.NAME_MAX);
                nameFeld.feld.value = f.produkt.name;
                const tageFeld = KASSE_BLATT._feld("produkt-offen-tage", "Offen haltbar (Tage)",
                    t.vorschlag && t.tage ? String(t.tage) : "", "number", 3);
                tageFeld.feld.inputMode = "numeric";
                tageFeld.feld.min = "1";
                tageFeld.feld.max = String(KASSE.OFFEN_TAGE_MAX);
                tageFeld.feld.value = t.vorschlag ? "" : String(t.tage);
                einstellen.appendChild(nameFeld.zeile);
                einstellen.appendChild(tageFeld.zeile);
                if (t.vorschlag) {
                    einstellen.appendChild(KASSE_BLATT._hinweis(t.tage ? "Leer = Vorschlag " + t.tage + " Tage" : "Leer = ohne „bis“"));
                }
                const speichern = DIALOG.knopf("Speichern", "still", async () => {
                    nameFeld.fehler.textContent = "";
                    tageFeld.fehler.textContent = "";
                    const tage = tageFeld.feld.value.trim();
                    if (tage && !KASSE._offenTage(Number(tage))) {
                        tageFeld.fehler.textContent = "1 bis " + KASSE.OFFEN_TAGE_MAX;
                        return;
                    }
                    if (!nameFeld.feld.value.trim()) {
                        nameFeld.fehler.textContent = "Name fehlt";
                        return;
                    }
                    const ok = await S.produktAendern(produktId, { name: nameFeld.feld.value, offenTage: tage ? Number(tage) : 0 });
                    if (ok) {
                        UPCREW_BLATT.schliessen();
                        return;
                    }
                    nameFeld.fehler.textContent = "Abgelehnt";
                });
                einstellen.appendChild(KASSE_BLATT._knoepfe(speichern));

                const daten = KASSE_BLATT._abschnitt(el, "Produktdaten");
                const seite = (typeof PRODUKTSUCHE !== "undefined") ? PRODUKTSUCHE.seite(f.produkt.ean) : "";
                if (seite) {
                    daten.appendChild(DIALOG.knopf("Open Food Facts", "still", () => window.open(seite, "_blank", "noopener")));
                } else {
                    daten.appendChild(KASSE_BLATT._hinweis("Ohne Strichcode"));
                }
                daten.appendChild(DIALOG.knopf("Ausblenden", "still", async () => {
                    const ja = await DIALOG.zweiSchritt({ titel: f.produkt.name, text: "Produkt ausblenden?", erst: "Ausblenden", dann: "Wirklich" });
                    if (ja) {
                        await S.produktAusblenden(produktId);
                        UPCREW_BLATT.schliessen();
                    }
                }));

                const quelle = document.createElement("p");
                quelle.className = "quelle";
                quelle.textContent = (typeof PRODUKTSUCHE !== "undefined") ? PRODUKTSUCHE.QUELLE : "";
                el.appendChild(quelle);
            }
        });
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = PRODUKTE;
}
