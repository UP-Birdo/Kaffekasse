/*
 * bildschirm-produkte.js — der Tab „Produkte“ (links, seit 0.9.0; seit 0.6.0, Nutzer 09.10.2026:
 * „nicht die einzelnen kassen listen sondern die produkte wo in deiner angeben kasse drin sind …
 * mit fakten zum produkt anklick bar mit popup“).
 *
 * Liste: die Produkte DIESER Kasse — Bild (austauschbarer Platz), Name, Marke, Packungen. Tipp →
 * das Produkt-Blatt (dasselbe öffnet der Bestand).
 *
 * DAS PRODUKT-BLATT seit 0.10.0 aufgeräumt (Nutzer 12.10.2026: „noch zu viele Infos … nur das
 * Wichtigste in den Vordergrund, den Rest in Untermenüs verstecken, priorisiere selbst“):
 *   vorne    Kopf (Bild, Name, Marke), DREI Kacheln (Vorrat · Reicht bis · Dran), der Tipp, falls
 *            einer da ist, die Nährwerte (Open Food Facts, mit Schalter „100 g · Packung“)
 *   Untermenüs (je ein Blatt): Statistik (Zahlen + letzte Packungen) · Angebote (nur wenn es
 *            Läden gibt) · Einstellen (Name, offen haltbar, eigenes Foto, Ausblenden) ·
 *            Open Food Facts (Seite im Browser)
 * Dazu `details(treffer)`: die Produktdetails eines gescannten Strichcodes VOR dem Anlegen
 * (Nutzer 12.10.2026: „wenn ich etwas einscanne … auf die Vorschau klicken, um die Produktdetails
 * zu sehen“).
 *
 * NÄHRWERTE: je 100 g wie auf der Packung, oder umgerechnet auf die ganze Packung (Nutzer
 * 12.10.2026: „überall, wo man die Produktdetails sieht, ein Schalter, der auf das Produktgewicht
 * umrechnet … 100 g soll immer noch anzeigbar sein“). Die Wahl merkt sich das Gerät.
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
            karte.appendChild(ZUSTAND.leer({ zeichen: "paket", text: "Noch kein Produkt", aktion: { text: "Neues Produkt", bei: () => KASSE_BLATT.produkt() } }));
            ort.appendChild(karte);
            return;
        }
        const liste = document.createElement("div");
        liste.className = "produkt-liste";
        for (const p of st.produkte) {
            liste.appendChild(PRODUKTE._zeile(p));
        }
        ort.appendChild(liste);
        const fuss = document.createElement("div");
        fuss.className = "start-fuss";
        fuss.appendChild(DIALOG.knopf("Neues Produkt", "still", () => KASSE_BLATT.produkt()));
        ort.appendChild(fuss);
    },

    /* Eine Zeile: Bild, Name, darunter Marke · Packungen (seit 0.10.0 ohne Preis, offen seit, Läden —
       das steht im Blatt unter „Statistik“). */
    _zeile(p) {
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
        const zahlen = document.createElement("span");
        zahlen.className = "produkt-zahlen";
        zahlen.textContent = [p.produkt.marke, p.packungen + (p.packungen === 1 ? " Packung" : " Packungen")].filter(Boolean).join(" · ");
        text.appendChild(zahlen);
        zeile.appendChild(text);
        zeile.appendChild(ZUSTAND.zeichen("pfeil", "produkt-pfeil"));
        return zeile;
    },

    /* ---------------------------------------------------------------- *
     * Nährwerte mit Schalter „100 g · Packung“ (0.10.0)
     * ---------------------------------------------------------------- */

    NAEHR_SCHLUESSEL: "kaffekasse.naehrJe",

    naehrJe() {
        try {
            return localStorage.getItem(PRODUKTE.NAEHR_SCHLUESSEL) === "packung" ? "packung" : "100";
        } catch (fehler) {
            return "100";
        }
    },

    _naehrJeSetzen(wert) {
        try {
            localStorage.setItem(PRODUKTE.NAEHR_SCHLUESSEL, wert);
        } catch (fehler) {
            /* egal: gilt dann nur für diese Ansicht */
        }
    },

    /* Den Abschnitt füllen; ohne Packungsgröße gibt es nur „je 100 g“ (kein Schalter). */
    _naehrwerteZeichnen(ort, n) {
        ort.textContent = "";
        const packung = n.packung > 0;
        const je = packung ? PRODUKTE.naehrJe() : "100";
        const faktor = (je === "packung") ? n.packung / 100 : 1;
        const kopf = document.createElement("div");
        kopf.className = "naehr-kopf";
        const h = document.createElement("h3");
        h.className = "blatt-abschnitt-titel";
        h.textContent = "Nährwerte";
        kopf.appendChild(h);
        if (packung && typeof UPCREW_EINSTELLUNGEN !== "undefined") {
            kopf.appendChild(UPCREW_EINSTELLUNGEN.segment(
                [{ wert: "100", text: "100 " + n.einheit }, { wert: "packung", text: "Packung" }],
                je,
                /* Neu zeichnen erst NACH dem Tipp: sonst hängt der getippte Knopf schon nicht mehr im
                   Blatt, und das Blatt hält den Tipp für einen auf den Grund (schließt sich). */
                (wert) => { PRODUKTE._naehrJeSetzen(wert); setTimeout(() => PRODUKTE._naehrwerteZeichnen(ort, n), 0); },
                "Nährwerte je"));
        }
        ort.appendChild(kopf);
        const marken = [];
        if (n.nutri) {
            marken.push({ text: "Nutri-Score " + n.nutri, klasse: "nutri nutri-" + n.nutri.toLowerCase() });
        }
        if (n.nova) {
            marken.push({ text: "NOVA " + n.nova, klasse: "" });
        }
        if (n.menge) {
            marken.push({ text: n.menge, klasse: "" });
        }
        if (marken.length) {
            const reihe = document.createElement("div");
            reihe.className = "naehr-marken";
            for (const m of marken) {
                const s = document.createElement("span");
                s.className = "naehr-marke " + m.klasse;
                s.textContent = m.text;
                reihe.appendChild(s);
            }
            ort.appendChild(reihe);
        }
        if (n.werte.length) {
            const unter = document.createElement("div");
            unter.className = "feld-hinweis";
            unter.textContent = je === "packung" ? "je Packung · " + String(n.packung).replace(".", ",") + " " + n.einheit : "je 100 " + n.einheit;
            ort.appendChild(unter);
            const tabelle = document.createElement("dl");
            tabelle.className = "naehr-tabelle";
            for (const w of n.werte) {
                const dt = document.createElement("dt");
                dt.textContent = w.titel;
                if (/^davon/.test(w.titel)) {
                    dt.className = "naehr-davon";
                }
                const dd = document.createElement("dd");
                dd.textContent = PRODUKTSUCHE.naehrText(w, faktor);
                tabelle.appendChild(dt);
                tabelle.appendChild(dd);
            }
            ort.appendChild(tabelle);
        }
        ort.hidden = false;
    },

    /* Ein Platz für die Nährwerte, der sich still füllt (oder weg bleibt). */
    _naehrPlatz(el, ean) {
        const naehr = document.createElement("section");
        naehr.className = "blatt-abschnitt naehrwerte";
        naehr.hidden = true;
        el.appendChild(naehr);
        if (ean && typeof PRODUKTSUCHE !== "undefined") {
            PRODUKTSUCHE.naehrwerte(ean).then((n) => {
                if (n && n.gefunden && naehr.isConnected) {
                    PRODUKTE._naehrwerteZeichnen(naehr, n);
                }
            });
        }
        return naehr;
    },

    /* ---------------------------------------------------------------- *
     * Kleine Bausteine der Blätter
     * ---------------------------------------------------------------- */

    /* Eine Zeile „Untermenü“: Titel, wahlfrei ein leiser Text, Pfeil. */
    menueZeile(titel, unter, beiKlick) {
        const zeile = document.createElement("button");
        zeile.type = "button";
        zeile.className = "menue-zeile";
        const text = document.createElement("span");
        text.className = "menue-zeile-text";
        const b = document.createElement("b");
        b.textContent = titel;
        text.appendChild(b);
        if (unter) {
            const s = document.createElement("small");
            s.textContent = unter;
            text.appendChild(s);
        }
        zeile.appendChild(text);
        zeile.appendChild(ZUSTAND.zeichen("pfeil", "produkt-pfeil"));
        zeile.addEventListener("click", beiKlick);
        return zeile;
    },

    _kopf(el, produkt, unterText) {
        const kopf = document.createElement("div");
        kopf.className = "fakten-kopf";
        kopf.appendChild(START._produktBild(produkt));
        const text = document.createElement("div");
        text.className = "produkt-text";
        const name = document.createElement("b");
        name.className = "produkt-name";
        name.textContent = produkt.name;
        text.appendChild(name);
        const unter = document.createElement("small");
        unter.className = "produkt-marke";
        unter.textContent = unterText;
        text.appendChild(unter);
        kopf.appendChild(text);
        el.appendChild(kopf);
    },

    _quelle(el) {
        const quelle = document.createElement("p");
        quelle.className = "quelle";
        quelle.textContent = (typeof PRODUKTSUCHE !== "undefined") ? PRODUKTSUCHE.QUELLE : "";
        el.appendChild(quelle);
    },

    /* ---------------------------------------------------------------- *
     * Das Produkt-Blatt
     * ---------------------------------------------------------------- */

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
        const l = BESTAND.lage(S.stand, produktId, jetzt);
        UPCREW_BLATT.oeffnen({
            titel: f.produkt.name,
            klasse: "blatt-produktfakten",
            inhalt: (el) => {
                PRODUKTE._kopf(el, f.produkt, f.produkt.marke || (f.produkt.ean ? "" : "Ohne Strichcode"));

                el.appendChild(STATISTIK.kacheln([
                    { titel: "Im Schrank", wert: l.leer ? "Leer" : String(l.vorrat) },
                    { titel: "Reicht bis", wert: l.leer ? "–" : (l.reichtBis ? "~" + KASSE.datumKurz(l.reichtBis, jetzt) : "–") },
                    { titel: "Dran", wert: f.dran ? wer(f.dran) : "–" }
                ]));
                if (l.tipp && l.tipp.art !== "reicht") {
                    el.appendChild(KASSE_BLATT._hinweis(l.tipp.text));
                }

                const menue = document.createElement("div");
                menue.className = "menue";
                menue.appendChild(PRODUKTE.menueZeile("Statistik",
                    f.packungen + (f.packungen === 1 ? " Packung" : " Packungen") + (f.schnittPreis !== null ? " · Ø " + KASSE.euro(f.schnittPreis) : ""),
                    () => PRODUKTE._statistikBlatt(produktId)));
                if (l.laeden.length) {
                    menue.appendChild(PRODUKTE.menueZeile("Angebote",
                        l.angebotsquote ? "Angebot " + BESTAND.prozent(l.angebotsquote) : l.laeden.map((x) => x.laden).join(", "),
                        () => PRODUKTE._angeboteBlatt(produktId)));
                }
                menue.appendChild(PRODUKTE.menueZeile("Einstellen", "Name · offen haltbar · Foto",
                    () => PRODUKTE._einstellenBlatt(produktId)));
                const seite = (typeof PRODUKTSUCHE !== "undefined") ? PRODUKTSUCHE.seite(f.produkt.ean) : "";
                if (seite) {
                    menue.appendChild(PRODUKTE.menueZeile("Open Food Facts", f.produkt.ean,
                        () => window.open(seite, "_blank", "noopener")));
                }
                el.appendChild(menue);
                /* Die Nährwerte unter den Menü-Zeilen: lang, aber Inhalt, kein Weg. */
                PRODUKTE._naehrPlatz(el, f.produkt.ean);
                PRODUKTE._quelle(el);
            }
        });
    },

    /* Untermenü „Statistik“: alle Zahlen (alle Zeit) und die letzten Packungen. */
    _statistikBlatt(produktId) {
        const S = STEUERUNG;
        const jetzt = S.jetzt();
        const f = KASSE.produktFakten(S.stand, produktId, jetzt);
        if (!f) {
            return;
        }
        const uid = (typeof KONTO !== "undefined") ? KONTO.uid() : null;
        const l = BESTAND.lage(S.stand, produktId, jetzt);
        UPCREW_BLATT.oeffnen({
            titel: "Statistik",
            klasse: "blatt-produktstatistik",
            inhalt: (el) => {
                el.appendChild(STATISTIK.kacheln([
                    { titel: "Packungen", wert: String(f.packungen) },
                    { titel: "Ø Preis", wert: KASSE.euro(f.schnittPreis) },
                    { titel: "Je Woche", wert: f.jeWoche === null ? "–" : String(f.jeWoche).replace(".", ",") },
                    { titel: "Offen seit", wert: f.offen ? KASSE.gross(KASSE.datumKurz(f.offen.geoeffnetAm, jetzt)) : "–" },
                    { titel: "Leer ~", wert: !f.prognose ? "–" : f.prognose < jetzt ? "überfällig" : KASSE.gross(KASSE.datumKurz(f.prognose, jetzt)) },
                    { titel: "Ø Verbrauch", wert: KASSE.dauerText(f.verbrauchMs) },
                    { titel: "Ø Lager", wert: KASSE.dauerText(f.lagerMs) },
                    { titel: "Lager max", wert: KASSE.dauerText(l.lagerMaxMs) },
                    { titel: "MHD", wert: BESTAND.mhdLageText(l, jetzt) }
                ]));
                const letzte = KASSE_BLATT._abschnitt(el, "Letzte Packungen");
                if (f.letzte.length === 0) {
                    letzte.appendChild(KASSE_BLATT._hinweis("Noch keine"));
                    return;
                }
                const gruppe = document.createElement("div");
                gruppe.className = "verlauf-gruppe";
                for (const e of f.letzte) {
                    gruppe.appendChild(VERLAUF._zeile(Object.assign({ gueltig: true, produktName: KASSE.gross(KASSE.datumKurz(e.kauf, jetzt)) }, e), uid));
                }
                letzte.appendChild(gruppe);
            }
        });
    },

    /* Untermenü „Angebote“: Quote, Normalpreis, Ersparnis, nächstes, je Laden. */
    _angeboteBlatt(produktId) {
        const S = STEUERUNG;
        const jetzt = S.jetzt();
        const l = BESTAND.lage(S.stand, produktId, jetzt);
        UPCREW_BLATT.oeffnen({
            titel: "Angebote",
            klasse: "blatt-angebote",
            inhalt: (el) => {
                el.appendChild(STATISTIK.kacheln([
                    { titel: "Angebot", wert: BESTAND.prozent(l.angebotsquote) },
                    { titel: "Normalpreis", wert: KASSE.euro(l.normalpreis) },
                    { titel: "Ø Ersparnis", wert: l.ersparnis > 0 ? KASSE.euro(l.ersparnis) : "–" },
                    { titel: "Ø Abstand", wert: KASSE.dauerText(l.abstandMs) },
                    { titel: "Nächstes ~", wert: l.naechstesAngebot ? KASSE.gross(KASSE.datumKurz(l.naechstesAngebot.naechstes, jetzt)) : "–" },
                    { titel: "Läden", wert: String(l.laeden.length) }
                ]));
                const teil = KASSE_BLATT._abschnitt(el, "Je Laden");
                for (const a of l.angebote) {
                    teil.appendChild(KASSE_BLATT._hinweis(BESTAND.angebotText(a, jetzt) + " · alle " + KASSE.dauerText(a.abstandMs)));
                }
                for (const x of l.laeden) {
                    teil.appendChild(KASSE_BLATT._hinweis(x.laden + " · " + x.packungen + (x.packungen === 1 ? " Packung" : " Packungen")));
                }
            }
        });
    },

    /* Untermenü „Einstellen“ (0.8.0/0.9.0): Name, offen haltbar, eigenes Foto, Ausblenden. Nach dem
       Speichern gehen alle Blätter zu und das Produkt-Blatt kommt neu (mit neuem Namen/Bild). */
    _einstellenBlatt(produktId) {
        const S = STEUERUNG;
        const produkt = S.stand && S.stand.produkte[produktId];
        if (!produkt) {
            return;
        }
        const neuZeigen = () => { UPCREW_BLATT.alleSchliessen(); PRODUKTE.blatt(produktId); };
        UPCREW_BLATT.oeffnen({
            titel: "Einstellen",
            klasse: "blatt-einstellen",
            inhalt: (el) => {
                const teil = KASSE_BLATT._abschnitt(el, "");
                const t = KASSE.offenTage(produkt);
                const nameFeld = KASSE_BLATT._feld("produkt-name-neu", "Name", "Hafermilch", "text", KASSE.NAME_MAX);
                nameFeld.feld.value = produkt.name;
                const tageFeld = KASSE_BLATT._feld("produkt-offen-tage", "Offen haltbar (Tage)",
                    t.vorschlag && t.tage ? String(t.tage) : "", "number", 3);
                tageFeld.feld.inputMode = "numeric";
                tageFeld.feld.min = "1";
                tageFeld.feld.max = String(KASSE.OFFEN_TAGE_MAX);
                tageFeld.feld.value = t.vorschlag ? "" : String(t.tage);
                teil.appendChild(nameFeld.zeile);
                teil.appendChild(tageFeld.zeile);
                if (t.vorschlag) {
                    teil.appendChild(KASSE_BLATT._hinweis(t.tage ? "Leer = Vorschlag " + t.tage + " Tage" : "Leer = ohne „bis“"));
                }
                const speichern = DIALOG.knopf("Speichern", "haupt", async () => {
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
                        neuZeigen();
                        return;
                    }
                    nameFeld.fehler.textContent = "Abgelehnt";
                });
                teil.appendChild(KASSE_BLATT._knoepfe(speichern));

                const foto = KASSE_BLATT._abschnitt(el, "Bild");
                PRODUKTE._fotoTeil(foto, Object.assign({ id: produktId }, produkt), neuZeigen);

                const weg = KASSE_BLATT._abschnitt(el, "");
                weg.appendChild(DIALOG.knopf("Ausblenden", "still", async () => {
                    const ja = await DIALOG.zweiSchritt({ titel: produkt.name, text: "Produkt ausblenden?", erst: "Ausblenden", dann: "Wirklich" });
                    if (ja) {
                        await S.produktAusblenden(produktId);
                        UPCREW_BLATT.alleSchliessen();
                    }
                }));
            }
        });
    },

    /* Eigenes Foto (0.9.0): wählen (Gerät: Foto machen oder Mediathek), verkleinern, speichern;
       „Foto weg“, wenn eins da ist. Ohne eigenes Foto gilt das Bild aus Open Food Facts. */
    _fotoTeil(ort, produkt, danach) {
        if (typeof PRODUKTFOTO === "undefined") {
            return;
        }
        const fehler = document.createElement("div");
        fehler.className = "feld-fehler";
        fehler.setAttribute("role", "alert");
        const knoepfe = [];
        const waehlen = DIALOG.knopf(produkt.foto ? "Foto ändern" : "Eigenes Foto", "still", async () => {
            fehler.textContent = "";
            const datei = await PRODUKTFOTO.waehlen();
            if (!datei) {
                return;
            }
            waehlen.disabled = true;
            const foto = await PRODUKTFOTO.verkleinern(datei);
            if (!foto) {
                waehlen.disabled = false;
                fehler.textContent = "Bild nicht lesbar";
                return;
            }
            const ok = await STEUERUNG.produktAendern(produkt.id, { foto: foto });
            waehlen.disabled = false;
            if (!ok) {
                fehler.textContent = "Abgelehnt";
                return;
            }
            danach();
        });
        knoepfe.push(waehlen);
        if (produkt.foto) {
            knoepfe.push(DIALOG.knopf("Foto weg", "still", async () => {
                const ok = await STEUERUNG.produktAendern(produkt.id, { foto: null });
                if (!ok) {
                    fehler.textContent = "Abgelehnt";
                    return;
                }
                danach();
            }));
        }
        ort.appendChild(KASSE_BLATT._knoepfe(...knoepfe));
        ort.appendChild(fehler);
    },

    /* ---------------------------------------------------------------- *
     * Produktdetails eines Treffers aus der Strichcode-Suche (vor dem Anlegen, 0.10.0)
     * ---------------------------------------------------------------- */

    /* `treffer`: { ean, name, marke, bild } aus PRODUKTSUCHE.suchen. */
    details(treffer) {
        if (!treffer || typeof UPCREW_BLATT === "undefined") {
            return;
        }
        UPCREW_BLATT.oeffnen({
            titel: treffer.name || "Produkt",
            klasse: "blatt-produktdetails",
            inhalt: (el) => {
                const bild = document.createElement("div");
                bild.className = "details-bild";
                bild.hidden = !treffer.bild;
                if (treffer.bild) {
                    const img = document.createElement("img");
                    img.src = treffer.bild;
                    img.alt = "";
                    img.referrerPolicy = "no-referrer";
                    bild.appendChild(img);
                }
                el.appendChild(bild);
                const text = document.createElement("p");
                text.className = "packung-kopf";
                text.textContent = [treffer.marke, treffer.ean].filter(Boolean).join(" · ");
                el.appendChild(text);
                const naehr = PRODUKTE._naehrPlatz(el, treffer.ean);
                const leer = KASSE_BLATT._hinweis("Keine Nährwerte");
                leer.hidden = true;
                el.appendChild(leer);
                if (typeof PRODUKTSUCHE !== "undefined") {
                    PRODUKTSUCHE.naehrwerte(treffer.ean).then((n) => {
                        if (!el.isConnected) {
                            return;
                        }
                        /* Das größere Bild, wenn es eins gibt. */
                        if (n && n.bildGross) {
                            bild.textContent = "";
                            const img = document.createElement("img");
                            img.src = n.bildGross;
                            img.alt = "";
                            img.referrerPolicy = "no-referrer";
                            bild.appendChild(img);
                            bild.hidden = false;
                        }
                        leer.hidden = !!(n && n.gefunden) || !naehr.hidden;
                    });
                }
                const seite = (typeof PRODUKTSUCHE !== "undefined") ? PRODUKTSUCHE.seite(treffer.ean) : "";
                const knoepfe = [DIALOG.knopf("Ok", "haupt", () => UPCREW_BLATT.schliessen())];
                if (seite) {
                    knoepfe.push(DIALOG.knopf("Open Food Facts", "still", () => window.open(seite, "_blank", "noopener")));
                }
                el.appendChild(KASSE_BLATT._knoepfe(...knoepfe));
                PRODUKTE._quelle(el);
            }
        });
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = PRODUKTE;
}
