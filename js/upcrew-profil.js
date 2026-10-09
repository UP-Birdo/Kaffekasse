/*
 * upcrew-profil.js — das Profil ZWEISTUFIG, gleich in allen UPCrew-Spielen (gehört zu css/upcrew-profil.css,
 * braucht js/upcrew-abzeichen.js für die Kacheln; nutzt js/upcrew-blatt.js, js/upcrew-levelpfad.js und
 * js/upcrew-einstellungen.js, wenn da). Entstanden in Blunderluck v0.156.0; zweistufig seit 29.09.2026.
 *
 * Nutzer 29.09.2026: „generell soll es nur ein vorschau profil geben karte die oben ist mit den ausgerüsteten
 * abzeichen titel und level und flammen mit natürlich dem namen -> und halt das ausführliche wenn man draufklickt
 * mit mehr inhalten statistiken und so“ · „unten soll das level kachel aus dem profil“ · „das einstellungs symbol ist
 * kein zahnrad“ · „zu viele texte sätze im profil“. Gilt für das EIGENE und FREMDE Profile, beide Spiele.
 *
 * START-KOPF (seit 29.09.2026 abends, Koordination „Start ohne Scrollen“): KEINE Vorschau-Karte auf dem Start,
 * sondern `UPCREW_PROFIL.kopfzeile(ort, daten, { beiOeffnen, beiSerie, beiLevel, menue })` — Kreis mit Level-Ring,
 * Name #Tag, die drei Abzeichen als Zeichen. Seit 29.09.2026 spät (BL v0.157.1 / TL 0.26.1): am Kreis OBEN LINKS eine
 * kleine Flamme mit Serie (→ Serien-Karte), UNTEN RECHTS die Level-Zahl (→ Level-Pfad), Mitte → Profil; rechts das
 * ☰-Menü (`UPCREW_PROFIL.menue`: Freunde · Verlauf · Einstellungen, springt dorthin), kein Flammen-Kreis rechts mehr. Tipp auf Kreis/Namen → DIREKT das ausführliche Profil (Stufe 2).
 * Seit 29.09.2026 nachts (Nutzer: „nicht erst eine vorschau vom profil … das was hinter dem pfeil steht soll direkt
 * kommen“, BL v0.157.1 / TL 0.26.1): auch fremde Namen (Rangliste, Freunde, Partie) öffnen direkt `oeffnen(…)`.
 * Die ausgerüsteten Abzeichen stehen überall KOMPAKT als Zeichen (UPCREW_ABZEICHEN.symbol), auch in Karte und Profil.
 *
 * STUFE 1 — die VORSCHAU-KARTE — UNGENUTZT/OPTIONAL seit 29.09.2026 nachts (kein Zwischenschritt mehr; bleibt nur
 * als Baustein-Teil stehen, keine App ruft sie auf):
 *     UPCREW_PROFIL.vorschau(ort, {
 *         name: "Anna", tag: "#4821", titel: "Stammgast",           // titel wahlfrei
 *         level: 14, imLevel: 264, kosten: 425, anteil: 0.62,         // gemeinsames Level (FORTSCHRITT.levelAus)
 *         serie: 12, heute: true,                                     // Flamme/Serie über alle Spiele
 *         abzeichen: [eintrag, …], plaetze: 3                         // die ausgerüsteten, egal aus welchem Spiel
 *     }, {
 *         beiOeffnen: () => …,         // Tipp auf die Karte → das ausführliche Profil (z. B. UPCREW_PROFIL.oeffnen)
 *         beiLevel: () => …            // wahlfrei; Vorgabe: UPCREW_LEVELPFAD.oeffnen(daten)
 *     });   → die Karte
 *   Die ganze Karte ist EIN Knopf; nur der Level-Knopf darin öffnet stattdessen den Level-Pfad.
 *
 * STUFE 2 — das AUSFÜHRLICHE Profil (Inhalt eines Blatts):
 *     UPCREW_PROFIL.oeffnen(daten, optionen)      // Blatt „Profil“ (UPCREW_BLATT) mit Zahnrad NUR bei eigen
 *     UPCREW_PROFIL.zeichnen(ort, daten, optionen)   // nur der Inhalt
 *   SCHLANK seit 29.09.2026 spät (Nutzer: „den wählen knopf raus … Partien aus profil … oben rechts im profil die
 *   flamme … level balken wieder rein … level pfad aufklappen … dabei seit kompakter … die sammlung der abzeichen
 *   soll auch raus“; BL v0.157.2 / TL 0.26.2). Die Start-Kopfzeile bleibt davon unberührt.
 *   daten wie oben, dazu wahlfrei:
 *         spielzeit: { wert: "1h+", spiel: "Blunderluck",     // NUR dieses Spiel (fremd: die veröffentlichte Summe)
 *                      andere: [{ spiel: "Typoluck", wert: "20 min" }], summe: "1h+",   // → die Rechnung beim Tipp
 *                      oeffentlich: false } | null,
 *         seit: "12.08.2026",                         // steht kompakt als „seit Aug 2026“ (seitKurz)
 *         orte: [{ spiel: "Blunderluck", titel: "Turm · Ort 2", unter: "…", anteil: 0.3, pfad: "…" }]
 *   optionen:
 *         eigen: true,                                // eigenes Profil: Zahnrad, Plätze antippbar
 *         beiZahnrad: () => …,                        // → Einstellungen (nur mit eigen)
 *         beiAbzeichen: (platz) => …,                 // Tipp auf einen der 3 Plätze (auch belegt) → Auswahl (nur eigen)
 *         beiSerie: () => …,                          // Tipp auf die Flamme oben rechts → Serien-Karte (wahlfrei)
 *         statistik: element | (ort) => {},           // DIE APP gibt ihre Statistik hinein (Abschnitt „Statistik“)
 *         zusatz: [element, …],                       // weitere eigene Abschnitte (UPCREW_PROFIL.abschnitt)
 *         texte: { … }                                // wahlfrei, siehe TEXTE
 *   Reihenfolge (fest): Kopf (Kreis OHNE Level-Zahl, Name #Tag, Titel, „seit …“ · Spielzeit; rechts die Flamme) ·
 *   Level-BALKEN (Tipp klappt den Level-Pfad darunter auf, erneuter Tipp zu; rollt zur aktuellen Stufe) ·
 *   Abzeichen (3 Plätze, leere mit „+“; fremd nicht antippbar) · Statistik · Stand (orte) · zusatz.
 *   Tipp auf die Spielzeit → kleine Rechnung darunter (dieses Spiel, die anderen, Summe).
 *   ENTFALLEN: „Wählen“-Knopf, Partien (`verlauf` wird übergangen — Verlauf nur über ☰), Abzeichen-Liste (`alle`
 *   braucht nur noch die Auswahl), „Über“, Level-Kachel unten (`levelKachel` bleibt als Baustein-Teil).
 *
 *     UPCREW_PROFIL.abzeichenWahl(ort, alle, gewaehlt, { plaetze: 3, beiWechsel: (liste) => … });
 *     UPCREW_PROFIL.abschnitt(titel) · ring(daten, gross) · levelKachel(daten, beiLevel) · zahnrad(beiKlick)
 *
 * Kurze Texte: nur Beschriftungen (1–3 Wörter), keine erklärenden Sätze. Kein Spiel-Eigenes: alle Zahlen und Texte
 * kommen von der App; alles über textContent. Alte Aufrufe von `zeichnen` laufen weiter (`xpText` steht im Balken;
 * alte `spielzeit.zeilen` werden nicht mehr gezeigt).
 */
(function () {
    "use strict";

    const RAUM = "http://www.w3.org/2000/svg";
    /* Das Zahnrad: dasselbe gefüllte Zeichen wie UPCREW_EINSTELLUNGEN.ZEICHEN.zahnrad (8 Zähne, Loch per evenodd). */
    const ZAHNRAD = "M19.37 10.16 L22.47 10.34 A10.6 10.6 0 0 1 22.47 13.66 L19.37 13.84 A7.6 7.6 0 0 1 18.51 15.91 "
        + "L20.58 18.23 A10.6 10.6 0 0 1 18.23 20.58 L15.91 18.51 A7.6 7.6 0 0 1 13.84 19.37 L13.66 22.47 "
        + "A10.6 10.6 0 0 1 10.34 22.47 L10.16 19.37 A7.6 7.6 0 0 1 8.09 18.51 L5.77 20.58 A10.6 10.6 0 0 1 3.42 18.23 "
        + "L5.49 15.91 A7.6 7.6 0 0 1 4.63 13.84 L1.53 13.66 A10.6 10.6 0 0 1 1.53 10.34 L4.63 10.16 "
        + "A7.6 7.6 0 0 1 5.49 8.09 L3.42 5.77 A10.6 10.6 0 0 1 5.77 3.42 L8.09 5.49 A7.6 7.6 0 0 1 10.16 4.63 "
        + "L10.34 1.53 A10.6 10.6 0 0 1 13.66 1.53 L13.84 4.63 A7.6 7.6 0 0 1 15.91 5.49 L18.23 3.42 "
        + "A10.6 10.6 0 0 1 20.58 5.77 L18.51 8.09 A7.6 7.6 0 0 1 19.37 10.16 Z "
        + "M15.4 12 A3.4 3.4 0 1 0 8.6 12 A3.4 3.4 0 1 0 15.4 12 Z";
    const PFADE = {
        zahnrad: ZAHNRAD,
        uhr: "M12 3 A9 9 0 1 0 12.01 3 Z M12 7 V12 L15 14",
        kalender: "M4 6 H20 V20 H4 Z M4 10 H20 M8 3 V7 M16 3 V7",
        auge: "M2 12 C5 6 19 6 22 12 C19 18 5 18 2 12 Z M12 9.5 A2.5 2.5 0 1 0 12 14.5 A2.5 2.5 0 1 0 12 9.5 Z",
        schloss: "M6 11 H18 V20 H6 Z M8.5 11 V8 A3.5 3.5 0 0 1 15.5 8 V11",
        plus: "M12 6 V18 M6 12 H18",
        haken: "M5 12.5 L10 17 L19 7",
        flamme: "M12 3 C15 7 18 9 18 14 A6 6 0 0 1 6 14 C6 11 8 9 9 7 C10 10 11 11 12 11 C12 8 11 6 12 3 Z",
        rechts: "M9 5 L16 12 L9 19",
        runter: "M5 9 L12 16 L19 9",
        menue: "M4 7 H20 M4 12 H20 M4 17 H20",
        freunde: "M9 11 A3.5 3.5 0 1 0 9 4 A3.5 3.5 0 1 0 9 11 Z M2.5 20 C3 15.5 15 15.5 15.5 20 M16 4.4 A3.3 3.3 0 0 1 16 10.6 M18 14.5 C20.3 15.3 21.3 17 21.5 20"
    };
    const GEFUELLT = { zahnrad: true, flamme: true };

    const TEXTE = {
        profil: "Profil",
        oeffnen: "Profil öffnen",
        abzeichen: "Abzeichen",
        alle: "Abzeichen",
        waehlen: "Wählen",
        summe: "Summe",
        leer: "frei",
        statistik: "Statistik",
        verlauf: "Partien",
        ueber: "Über",
        spielzeit: "Spielzeit",
        oeffentlich: "öffentlich",
        privat: "privat",
        seit: "Dabei seit",
        orte: "Stand",
        level: "Level",
        levelPfad: "Level-Weg",
        serie: "Serie",
        wahlHinweis: "Bis zu 3",
        nochNicht: "Gesperrt",
        zahnrad: "Einstellungen",
        menue: "Menü",
        freunde: "Freunde",
        verlaufMenue: "Verlauf",
        einstellungen: "Einstellungen"
    };

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

    function zeichen(pfad, klasse) {
        const svg = document.createElementNS(RAUM, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        svg.setAttribute("class", (klasse || "up-pf-zeichen") + (GEFUELLT[pfad] ? " up-pf-gefuellt" : ""));
        const p = document.createElementNS(RAUM, "path");
        p.setAttribute("d", PFADE[pfad] || pfad || "");
        if (GEFUELLT[pfad]) {
            p.setAttribute("fill-rule", "evenodd");
        }
        svg.appendChild(p);
        return svg;
    }

    const anteilVon = (w) => Math.max(0, Math.min(1, Number(w) || 0));
    const ganz = (w) => Math.max(0, Math.floor(Number(w) || 0));

    /* Der Level-Stand aus den Daten: { level, imLevel, kosten, anteil } (fehlt imLevel/kosten, bleibt der Anteil). */
    function levelStand(d) {
        const level = Math.max(1, ganz(d.level) || 1);
        const kosten = ganz(d.kosten) || ((typeof UPCREW_LEVELPFAD !== "undefined") ? UPCREW_LEVELPFAD.kosten(level) : 0);
        const imLevel = (typeof d.imLevel === "number") ? ganz(d.imLevel) : Math.round(anteilVon(d.anteil) * kosten);
        return { level: level, imLevel: imLevel, kosten: kosten, anteil: kosten > 0 ? imLevel / kosten : anteilVon(d.anteil) };
    }

    function levelAuf(d, o) {
        return (e) => {
            if (e && e.stopPropagation) {
                e.stopPropagation();
            }
            if (typeof o.beiLevel === "function") {
                o.beiLevel();
            } else if (typeof UPCREW_LEVELPFAD !== "undefined") {
                UPCREW_LEVELPFAD.oeffnen(levelStand(d), { texte: o.levelTexte });
            }
        };
    }

    /* Der Ring: Anfangsbuchstabe, Level unten rechts, Füllung = Anteil. Auch für den Kopf der App. */
    function ring(daten, gross) {
        const d = daten || {};
        const r = el("span", "up-pf-ring" + (gross ? " up-pf-ring-gross" : "") + (d.ringKlasse ? " " + d.ringKlasse : ""));
        r.style.setProperty("--up-pf-anteil", anteilVon(d.anteil).toFixed(3));
        r.appendChild(el("span", "up-pf-kreis", String(d.name || "").trim().charAt(0).toUpperCase() || "?"));
        if (typeof d.level === "number") {
            r.appendChild(el("span", "up-pf-level", String(d.level)));
        }
        return r;
    }

    function abschnitt(titel, rechts) {
        const s = el("section", "up-pf-abschnitt");
        if (titel) {
            const h = el("h3", "", titel);
            if (rechts) {
                h.appendChild(rechts);
            }
            s.appendChild(h);
        }
        return s;
    }

    function zahnrad(beiKlick, name) {
        const k = el("button", "up-bl-kopf-knopf up-pf-zahnrad");
        k.type = "button";
        k.setAttribute("aria-label", name || TEXTE.zahnrad);
        k.title = name || TEXTE.zahnrad;
        k.appendChild(zeichen("zahnrad"));
        if (typeof beiKlick === "function") {
            k.addEventListener("click", beiKlick);
        }
        return k;
    }

    function kachelVon(eintrag, beiKlick) {
        if (typeof UPCREW_ABZEICHEN !== "undefined") {
            return UPCREW_ABZEICHEN.kachel(eintrag, beiKlick);
        }
        const k = el("button", "up-az", eintrag.titel);
        k.type = "button";
        if (beiKlick) {
            k.addEventListener("click", beiKlick);
        }
        return k;
    }

    function inhaltEinsetzen(ziel, inhalt) {
        if (typeof inhalt === "function") {
            inhalt(ziel);
        } else if (inhalt && inhalt.nodeType) {
            ziel.appendChild(inhalt);
        }
    }

    /* ---------- Stufe 1: die Vorschau-Karte ---------- */
    function vorschau(ort, daten, optionen) {
        const d = daten || {};
        const o = optionen || {};
        const t = Object.assign({}, TEXTE, o.texte || {});
        ort.textContent = "";
        const karte = el("div", "up-pf-karte");

        const auf = el("button", "up-pf-karte-auf");
        auf.type = "button";
        auf.setAttribute("aria-label", t.oeffnen + ": " + (d.name || ""));
        auf.addEventListener("click", () => {
            if (typeof o.beiOeffnen === "function") {
                o.beiOeffnen();
            }
        });
        karte.appendChild(auf);

        karte.appendChild(ring(Object.assign({}, d, { level: undefined }), false));   // Level steht im Knopf daneben
        const mitte = el("div", "up-pf-karte-mitte");
        const name = el("div", "up-pf-name up-pf-name-klein", d.name || "");
        if (d.tag) {
            name.appendChild(el("span", "up-pf-tag", d.tag));
        }
        mitte.appendChild(name);
        if (d.titel) {
            mitte.appendChild(el("div", "up-pf-titel", d.titel));
        }
        const zeile = el("div", "up-pf-karte-zeile");
        const stand = levelStand(d);
        const lv = el("button", "up-pf-lv up-lp-antippbar");
        lv.type = "button";
        lv.setAttribute("aria-label", t.level + " " + stand.level + " · " + t.levelPfad);
        lv.appendChild(el("b", "", t.level + " " + stand.level));
        const mini = el("span", "up-pf-lv-balken");
        const i = el("i");
        i.style.width = Math.round(stand.anteil * 100) + "%";
        mini.appendChild(i);
        lv.appendChild(mini);
        lv.addEventListener("click", levelAuf(d, o));
        zeile.appendChild(lv);
        const serie = ganz(d.serie);
        const fl = el("span", "up-pf-serie" + (serie > 0 ? (d.heute ? " up-pf-serie-voll" : " up-pf-serie-offen") : " up-pf-serie-aus"));
        fl.setAttribute("aria-label", t.serie + " " + serie);
        fl.appendChild(zeichen("flamme"));
        fl.appendChild(el("b", "", serie));
        zeile.appendChild(fl);
        mitte.appendChild(zeile);
        karte.appendChild(mitte);
        karte.appendChild(zeichen("rechts", "up-pf-zeichen up-pf-karte-pfeil"));

        const reihe = symbolReihe(d, "up-pf-karte-abzeichen");
        reihe.setAttribute("aria-hidden", "true");
        karte.appendChild(reihe);
        ort.appendChild(karte);
        return karte;
    }

    /* Die ausgerüsteten Abzeichen KOMPAKT, nur als Zeichen (Koordination 29.09.2026 „Start ohne Scrollen“): leere
       Plätze als leerer Kreis. Ohne upcrew-abzeichen.js ein Kürzel im Kreis. */
    function symbolVon(eintrag, beiKlick) {
        if (typeof UPCREW_ABZEICHEN !== "undefined" && typeof UPCREW_ABZEICHEN.symbol === "function") {
            return UPCREW_ABZEICHEN.symbol(eintrag, beiKlick);
        }
        const s = el("span", "up-az-symbol" + (eintrag ? " up-az-an" : " up-az-symbol-leer"),
            eintrag ? String(eintrag.kurz || eintrag.titel || "").charAt(0) : "");
        if (eintrag) {
            s.title = eintrag.titel || "";
        }
        return s;
    }

    function symbolReihe(d, klasse) {
        const plaetze = (typeof d.plaetze === "number" && d.plaetze > 0) ? d.plaetze : 3;
        const liste = Array.isArray(d.abzeichen) ? d.abzeichen.slice(0, plaetze) : [];
        const reihe = el("span", "up-pf-symbole" + (klasse ? " " + klasse : ""));
        for (let n = 0; n < plaetze; n++) {
            reihe.appendChild(symbolVon(liste[n] || null, null));
        }
        return reihe;
    }

    /* ---------- Der Kopf des Starts: EINE kompakte Zeile (Koordination 29.09.2026 „Start ohne Scrollen“) ----------
       Seit 29.09.2026 spät (Nutzer: „die flamme … soll oben links ins eck von dem profil kreis und das level soll in die
       rechte ecke … die zwei kleinen kreise im profil kreis sollen andrückbar gemacht werden mitte der große kreis
       profil öffnen oben in der ecke die flamme das flammen menü und unten das level menü“ — BL v0.157.1 / TL 0.26.1):
       Links der Profil-Kreis mit dem Level-Ring; OBEN LINKS am Kreis ein kleiner Kreis mit Flamme + Serie (→ beiSerie),
       UNTEN RECHTS ein kleiner Kreis mit der Level-Zahl (→ beiLevel, Vorgabe Level-Pfad), die MITTE (und Name/Zeichen
       daneben) → beiOeffnen. Drei getrennte Knöpfe, je mind. 32 px Trefferfläche, eigene aria-labels. Kein eigener
       Flammen-Kreis rechts mehr; rechts wahlfrei das ☰-Menü (`menue`, siehe UPCREW_PROFIL.menue).
           const kopf = UPCREW_PROFIL.kopfzeile(ort, daten, {
               beiOeffnen, beiSerie, beiLevel,                 // beiLevel wahlfrei
               menue: [{ text: "Freunde", zeichen: "freunde", beiKlick }, …]   // wahlfrei: ☰ rechts
           });
           kopf.flamme.setzen({ serie, heuteGeschafft })     // die Ecke oben links; null ohne beiSerie
           kopf.menue                                        // der ☰-Griff (oder null)                          */
    function serieText(serie, heute) {
        const n = ganz(serie);
        return TEXTE.serie + " " + n + (n === 1 ? " Tag" : " Tage")
            + (n === 0 ? "" : (heute ? " · heute geschafft" : " · heute noch offen"));
    }

    function kopfzeile(ort, daten, optionen) {
        const d = daten || {};
        const o = optionen || {};
        const t = Object.assign({}, TEXTE, o.texte || {});
        ort.textContent = "";
        const zeile = el("div", "up-pf-kopfzeile");
        const beiOeffnen = () => {
            if (typeof o.beiOeffnen === "function") {
                o.beiOeffnen();
            }
        };
        /* Der Kreis mit seinen zwei Ecken: drei Geschwister-Knöpfe (nie ineinander). */
        const feld = el("span", "up-pf-kz-feld");
        const auf = el("button", "up-pf-kz-auf");
        auf.type = "button";
        auf.setAttribute("aria-label", t.oeffnen + ": " + (d.name || ""));
        auf.addEventListener("click", beiOeffnen);
        const r = ring(Object.assign({}, d, { level: null }), false);
        r.classList.add("up-pf-ring-kopf");
        auf.appendChild(r);
        feld.appendChild(auf);

        let flamme = null;
        if (typeof o.beiSerie === "function") {
            const ecke = el("button", "up-pf-kz-ecke up-pf-kz-serie up-pf-kz-serie-aus");
            ecke.type = "button";
            const punkt = el("span", "up-pf-kz-punkt");
            punkt.appendChild(zeichen("flamme", "up-pf-kz-flamme"));
            const zahl = el("span", "up-pf-kz-zahl", "0");
            punkt.appendChild(zahl);
            ecke.appendChild(punkt);
            ecke.addEventListener("click", (e) => {
                if (e && e.stopPropagation) {
                    e.stopPropagation();
                }
                o.beiSerie();
            });
            flamme = {
                el: ecke,
                setzen(stand) {
                    const s = stand || {};
                    const n = ganz(s.serie);
                    const zustand = n === 0 ? "aus" : (s.heuteGeschafft ? "voll" : "offen");
                    ecke.className = "up-pf-kz-ecke up-pf-kz-serie up-pf-kz-serie-" + zustand;
                    zahl.textContent = n < 1000 ? String(n) : Math.floor(n / 1000) + "k+";
                    const text = serieText(n, s.heuteGeschafft === true);
                    ecke.setAttribute("aria-label", text);
                    ecke.title = text;
                }
            };
            flamme.setzen({ serie: d.serie, heuteGeschafft: d.heute === true });
            feld.appendChild(ecke);
        }

        if (typeof d.level === "number") {
            const ecke = el("button", "up-pf-kz-ecke up-pf-kz-lv");
            ecke.type = "button";
            ecke.setAttribute("aria-label", t.level + " " + d.level + " · " + t.levelPfad);
            ecke.title = t.levelPfad;
            ecke.appendChild(el("span", "up-pf-kz-punkt", String(d.level)));
            ecke.addEventListener("click", levelAuf(d, o));
            feld.appendChild(ecke);
        }
        zeile.appendChild(feld);

        /* Name und Zeichen daneben: dieselbe Tür wie die Mitte (für Finger; der Knopf trägt das Label). */
        const mitte = el("span", "up-pf-kz-mitte");
        mitte.addEventListener("click", beiOeffnen);
        const name = el("span", "up-pf-kz-name", d.name || "");
        if (d.tag) {
            name.appendChild(el("small", "up-pf-tag", d.tag));
        }
        mitte.appendChild(name);
        const reihe = symbolReihe(d, "up-pf-kz-abzeichen");
        reihe.setAttribute("aria-hidden", "true");
        mitte.appendChild(reihe);
        zeile.appendChild(mitte);

        const menueGriff = Array.isArray(o.menue) && o.menue.length ? menue(zeile, o.menue, { texte: t }) : null;
        ort.appendChild(zeile);
        return { el: zeile, flamme: flamme, menue: menueGriff };
    }

    /* ---------- Das ☰-Menü (29.09.2026 spät, Nutzer: „dann sollen die drei striche wieder kommen welche Freunde
       Verlauf Einstellungen drin hat und man dann dort hin springt“) ----------
           const griff = UPCREW_PROFIL.menue(halter, [
               { text: "Freunde", zeichen: "freunde", beiKlick: () => … },
               { text: "Verlauf", zeichen: "uhr", beiKlick: () => … },
               { text: "Einstellungen", zeichen: "zahnrad", beiKlick: () => … }
           ]);                                  // → { el (der ☰-Knopf), oeffnen(), schliessen(), offen() }
       Ein Tipp auf ☰ klappt eine kleine Karte unter dem Knopf auf (UPCREW_BLATT art „karte“, Klasse up-pf-menue-karte,
       rechts oben angeheftet). Sie schliesst bei Tipp aussen, Esc und Zurück (Verlaufseintrag des Blatt-Bausteins);
       ein Punkt schliesst sie und springt dann (beiKlick). Ohne UPCREW_BLATT: ein Aufklapp-Feld am Knopf, das bei Tipp
       aussen und Esc schliesst. Die Punkte und was sie tun gibt die App. */
    function menue(halter, punkte, optionen) {
        const o = optionen || {};
        const t = Object.assign({}, TEXTE, o.texte || {});
        const liste = (punkte || []).filter((p) => p && p.text);
        const knopf = el("button", "up-pf-menue-knopf");
        knopf.type = "button";
        knopf.setAttribute("aria-label", t.menue);
        knopf.setAttribute("aria-haspopup", "menu");
        knopf.setAttribute("aria-expanded", "false");
        knopf.title = t.menue;
        knopf.appendChild(zeichen("menue"));
        let offenGriff = null;
        let ersatz = null;

        function listeBauen(beiWahl) {
            const nav = el("div", "up-pf-menue");
            nav.setAttribute("role", "menu");
            for (const p of liste) {
                const punkt = el("button", "up-pf-menue-punkt");
                punkt.type = "button";
                punkt.setAttribute("role", "menuitem");
                if (p.zeichen) {
                    punkt.appendChild(zeichen(p.zeichen));
                }
                punkt.appendChild(el("span", "", p.text));
                punkt.addEventListener("click", (e) => {
                    if (e && e.stopPropagation) {
                        e.stopPropagation();
                    }
                    beiWahl();
                    if (typeof p.beiKlick === "function") {
                        p.beiKlick();
                    }
                });
                nav.appendChild(punkt);
            }
            return nav;
        }

        function ersatzZu(e) {
            if (!ersatz) {
                return;
            }
            if (e && e.type === "keydown" && e.key !== "Escape") {
                return;
            }
            if (e && e.type === "click" && ersatz.contains(e.target)) {
                return;
            }
            if (ersatz.parentNode) {
                ersatz.parentNode.removeChild(ersatz);
            }
            ersatz = null;
            knopf.setAttribute("aria-expanded", "false");
            document.removeEventListener("click", ersatzZu, true);
            document.removeEventListener("keydown", ersatzZu);
        }

        const griff = {
            el: knopf,
            offen: () => !!offenGriff || !!ersatz,
            schliessen() {
                if (offenGriff) {
                    const g = offenGriff;
                    offenGriff = null;
                    g.schliessen();
                }
                ersatzZu();
            },
            oeffnen() {
                if (griff.offen()) {
                    return;
                }
                knopf.setAttribute("aria-expanded", "true");
                if (typeof UPCREW_BLATT !== "undefined" && typeof UPCREW_BLATT.oeffnen === "function") {
                    const eintrag = UPCREW_BLATT.oeffnen({
                        art: "karte",
                        titel: t.menue,
                        klasse: "up-pf-menue-karte",
                        inhalt: listeBauen(() => griff.schliessen()),
                        beimSchliessen: () => {
                            offenGriff = null;
                            knopf.setAttribute("aria-expanded", "false");
                        }
                    });
                    offenGriff = eintrag;
                    /* Unter dem Knopf rechts anheften (gemessen). */
                    if (eintrag && eintrag.flaeche && eintrag.flaeche.style && typeof knopf.getBoundingClientRect === "function") {
                        const k = knopf.getBoundingClientRect();
                        const breit = (typeof window !== "undefined" && window.innerWidth) || 0;
                        if (k && breit && k.bottom > 0) {
                            eintrag.flaeche.style.setProperty("--up-pf-menue-oben", Math.round(k.bottom + 6) + "px");
                            eintrag.flaeche.style.setProperty("--up-pf-menue-rechts",
                                Math.max(8, Math.round(breit - k.right)) + "px");
                        }
                    }
                    return;
                }
                ersatz = listeBauen(() => griff.schliessen());
                ersatz.classList.add("up-pf-menue-ersatz");
                (knopf.parentNode || halter).appendChild(ersatz);
                setTimeout(() => {
                    if (ersatz) {
                        document.addEventListener("click", ersatzZu, true);
                        document.addEventListener("keydown", ersatzZu);
                    }
                }, 0);
            }
        };
        knopf.addEventListener("click", (e) => {
            if (e && e.stopPropagation) {
                e.stopPropagation();
            }
            if (griff.offen()) {
                griff.schliessen();
            } else {
                griff.oeffnen();
            }
        });
        if (halter) {
            halter.appendChild(knopf);
        }
        return griff;
    }

    /* Die Level-Kachel (ganz unten im ausführlichen Profil): antippbar → Level-Pfad. */
    function levelKachel(daten, beiLevel, texte) {
        const d = daten || {};
        const t = Object.assign({}, TEXTE, texte || {});
        const stand = levelStand(d);
        const k = el("button", "up-pf-levelkachel up-lp-antippbar");
        k.type = "button";
        k.setAttribute("aria-label", t.level + " " + stand.level + " · " + t.levelPfad);
        const zahl = el("span", "up-pf-lk-zahl");
        zahl.appendChild(el("small", "", t.level));
        zahl.appendChild(el("b", "", stand.level));
        k.appendChild(zahl);
        const mitte = el("span", "up-pf-lk-mitte");
        const balken = el("span", "up-pf-xp");
        const fuellung = el("i");
        fuellung.style.width = Math.round(stand.anteil * 100) + "%";
        balken.appendChild(fuellung);
        mitte.appendChild(balken);
        mitte.appendChild(el("small", "up-pf-xp-text", d.xpText || (stand.kosten > 0
            ? stand.imLevel + " / " + stand.kosten + " XP" : "")));
        k.appendChild(mitte);
        const pfeil = el("span", "up-pf-lk-pfad", t.levelPfad);
        pfeil.appendChild(zeichen("rechts", "up-pf-zeichen up-pf-klein-zeichen"));
        k.appendChild(pfeil);
        if (typeof beiLevel === "function") {
            k.addEventListener("click", beiLevel);
        }
        return k;
    }

    /* „Dabei seit“ KOMPAKT (29.09.2026 spät, Nutzer: „dabei seit soll kompakter sein wie z.b. seit 2026“):
       „12.08.2026“ / „2026-08-12“ → „seit Aug 2026“; nur ein Jahr → „seit 2026“; sonst „seit “ + Text. */
    const MONATE = ["Jan", "Feb", "März", "Apr", "Mai", "Juni", "Juli", "Aug", "Sep", "Okt", "Nov", "Dez"];
    function seitKurz(seit) {
        const s = String(seit || "").trim();
        if (!s) {
            return "";
        }
        let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
        if (m) {
            return "seit " + (MONATE[Number(m[2]) - 1] || "") + " " + m[3];
        }
        m = /^(\d{4})-(\d{2})(?:-\d{2})?/.exec(s);
        if (m) {
            return "seit " + (MONATE[Number(m[2]) - 1] || "") + " " + m[1];
        }
        return /^seit /.test(s) ? s : "seit " + s;
    }

    /* Der Level-BALKEN im Profil (29.09.2026 spät): Level-Zahl + Fortschritt; Tipp klappt den Level-Pfad auf. */
    function levelBalken(daten, texte) {
        const d = daten || {};
        const t = Object.assign({}, TEXTE, texte || {});
        const stand = levelStand(d);
        const k = el("button", "up-pf-levelkachel up-pf-levelbalken up-lp-antippbar");
        k.type = "button";
        k.setAttribute("aria-label", t.level + " " + stand.level + " · " + t.levelPfad);
        k.setAttribute("aria-expanded", "false");
        const zahl = el("span", "up-pf-lk-zahl");
        zahl.appendChild(el("small", "", t.level));
        zahl.appendChild(el("b", "", stand.level));
        k.appendChild(zahl);
        const mitte = el("span", "up-pf-lk-mitte");
        const balken = el("span", "up-pf-xp");
        const fuellung = el("i");
        fuellung.style.width = Math.round(stand.anteil * 100) + "%";
        balken.appendChild(fuellung);
        mitte.appendChild(balken);
        mitte.appendChild(el("small", "up-pf-xp-text", d.xpText || (stand.kosten > 0
            ? stand.imLevel + " / " + stand.kosten + " XP" : "")));
        k.appendChild(mitte);
        k.appendChild(zeichen("runter", "up-pf-zeichen up-pf-klein-zeichen up-pf-lb-pfeil"));
        return k;
    }

    /* ---------- Stufe 2: das ausführliche Profil ----------
       Seit 29.09.2026 spät SCHLANK (Nutzer: „den wählen knopf raus … Partien aus profil … oben rechts die flamme …
       level balken wieder rein … level pfad aufklappen … dabei seit kompakter … sammlung der abzeichen soll auch
       raus“; BL v0.157.2 / TL 0.26.2): Kopf (Kreis ohne Level-Zahl · Name #Tag · Titel · „seit …“ und Spielzeit ·
       rechts die Flamme) · Level-Balken (Tipp → Level-Pfad klappt darunter auf/zu) · 3 Abzeichen-Plätze · Statistik ·
       Stand · zusatz. Kein „Wählen“, keine Partien, keine Abzeichen-Liste, kein „Über“, keine Level-Kachel.
       `optionen.verlauf` wird still übergangen. */
    function zeichnen(ort, daten, optionen) {
        const d = daten || {};
        const o = optionen || {};
        const t = Object.assign({}, TEXTE, o.texte || {});
        const eigen = o.eigen === true || (o.eigen === undefined && typeof o.beiAbzeichen === "function");
        ort.innerHTML = "";
        ort.classList.add("up-pf");

        /* Kopf: Kreis (ohne Level-Zahl), Name + #Tag, Titel, „seit …“ + Spielzeit; rechts die Flamme. */
        const kopf = el("div", "up-pf-kopf");
        kopf.appendChild(ring(Object.assign({}, d, { level: null }), true));
        const mitte = el("div", "up-pf-mitte");
        const name = el("div", "up-pf-name", d.name || "");
        if (d.tag) {
            name.appendChild(el("span", "up-pf-tag", d.tag));
        }
        mitte.appendChild(name);
        if (d.titel) {
            mitte.appendChild(el("div", "up-pf-titel", d.titel));
        }
        const fakten = el("div", "up-pf-kurzfakten");
        let rechnung = null;
        if (d.seit) {
            const f = el("span", "up-pf-kf up-pf-seit");
            f.appendChild(zeichen("kalender"));
            f.appendChild(document.createTextNode(seitKurz(d.seit)));
            f.title = t.seit + " " + d.seit;
            fakten.appendChild(f);
        }
        if (d.spielzeit && d.spielzeit.wert) {
            const z = d.spielzeit;
            const andere = Array.isArray(z.andere) ? z.andere.filter((a) => a && a.wert) : [];
            const mitRechnung = andere.length > 0 || !!z.summe;
            const f = el(mitRechnung ? "button" : "span", "up-pf-kf up-pf-spielzeit");
            f.appendChild(zeichen("uhr"));
            f.appendChild(document.createTextNode(z.wert));
            if (!z.oeffentlich) {
                f.appendChild(zeichen("schloss", "up-pf-zeichen up-pf-kf-schloss"));
            }
            const label = t.spielzeit + (z.spiel ? " " + z.spiel : "") + " " + z.wert
                + " · " + (z.oeffentlich ? t.oeffentlich : t.privat);
            f.setAttribute("aria-label", label);
            f.title = label;
            if (mitRechnung) {
                f.type = "button";
                f.setAttribute("aria-expanded", "false");
                rechnung = el("div", "up-pf-rechnung");
                rechnung.hidden = true;
                const zeile = (links, rechts, klasse) => {
                    const r = el("div", "up-pf-rechnung-zeile" + (klasse ? " " + klasse : ""));
                    r.appendChild(el("span", "", links));
                    r.appendChild(el("b", "", rechts));
                    rechnung.appendChild(r);
                };
                zeile(z.spiel || t.spielzeit, z.wert);
                for (const a of andere) {
                    zeile(a.spiel || "", a.wert);
                }
                if (z.summe) {
                    zeile(t.summe, z.summe, "up-pf-rechnung-summe");
                }
                f.addEventListener("click", () => {
                    rechnung.hidden = !rechnung.hidden;
                    f.setAttribute("aria-expanded", rechnung.hidden ? "false" : "true");
                });
            }
            fakten.appendChild(f);
        }
        if (fakten.firstChild) {
            mitte.appendChild(fakten);
        }
        kopf.appendChild(mitte);

        /* Oben rechts die Flamme mit der Serie (Tipp → Serien-Karte, wenn beiSerie). */
        const serie = ganz(d.serie);
        const zustand = serie === 0 ? "aus" : (d.heute ? "voll" : "offen");
        const flamme = el(typeof o.beiSerie === "function" ? "button" : "span",
            "up-pf-kopf-flamme up-pf-serie up-pf-serie-" + zustand);
        flamme.appendChild(zeichen("flamme"));
        flamme.appendChild(el("b", "", serie < 1000 ? String(serie) : Math.floor(serie / 1000) + "k+"));
        const serieLabel = serieText(serie, d.heute === true);
        flamme.setAttribute("aria-label", serieLabel);
        flamme.title = serieLabel;
        if (typeof o.beiSerie === "function") {
            flamme.type = "button";
            flamme.addEventListener("click", () => o.beiSerie());
        }
        kopf.appendChild(flamme);
        ort.appendChild(kopf);
        if (rechnung) {
            ort.appendChild(rechnung);   // die Rechnung zur Spielzeit, zu bis zum Tipp
        }

        /* Level-BALKEN: Tipp klappt den Level-Pfad darunter auf (inline), erneuter Tipp zu. */
        if (typeof d.level === "number") {
            const lvAbschnitt = el("div", "up-pf-level-abschnitt");
            const knopf = levelBalken(d, o.texte);
            let pfad = null;
            knopf.addEventListener("click", () => {
                if (pfad) {
                    pfad.parentNode.removeChild(pfad);
                    pfad = null;
                    knopf.setAttribute("aria-expanded", "false");
                    knopf.classList.remove("up-pf-levelbalken-auf");
                    return;
                }
                if (typeof UPCREW_LEVELPFAD === "undefined" || typeof UPCREW_LEVELPFAD.zeichnen !== "function") {
                    levelAuf(d, o)();
                    return;
                }
                pfad = el("div", "up-pf-levelpfad");
                lvAbschnitt.appendChild(pfad);
                UPCREW_LEVELPFAD.zeichnen(pfad, levelStand(d), { texte: o.levelTexte, kopf: false });
                knopf.setAttribute("aria-expanded", "true");
                knopf.classList.add("up-pf-levelbalken-auf");
            });
            lvAbschnitt.appendChild(knopf);
            ort.appendChild(lvAbschnitt);
        }

        /* Drei Abzeichen-Plätze: eigen jeder Platz antippbar (leer mit „+“) → Auswahl; fremd nicht antippbar. */
        const plaetze = (typeof d.plaetze === "number" && d.plaetze > 0) ? d.plaetze : 3;
        const kannWaehlen = eigen && typeof o.beiAbzeichen === "function";
        const az = abschnitt(t.abzeichen);
        const reihe = el("div", "up-pf-plaetze up-pf-plaetze-kompakt");
        const liste = Array.isArray(d.abzeichen) ? d.abzeichen.slice(0, plaetze) : [];
        for (let i = 0; i < plaetze; i++) {
            const platz = el("div", "up-pf-platz");
            const eintrag = liste[i] || null;
            if (kannWaehlen) {
                const k = el("button", "up-pf-platz-knopf" + (eintrag ? "" : " up-pf-leer up-az-symbol up-az-symbol-leer"));
                k.type = "button";
                k.setAttribute("aria-label", t.abzeichen + " " + (i + 1) + " · " + (eintrag ? (eintrag.titel || "") : t.leer));
                if (eintrag) {
                    const s = symbolVon(eintrag, null);
                    s.setAttribute("aria-hidden", "true");
                    k.appendChild(s);
                } else {
                    k.title = t.leer;
                    k.appendChild(zeichen("plus"));
                }
                k.addEventListener("click", () => o.beiAbzeichen(i));
                platz.appendChild(k);
            } else if (eintrag) {
                platz.appendChild(symbolVon(eintrag, null));
            } else {
                platz.appendChild(el("span", "up-pf-leer up-pf-leer-fremd up-az-symbol up-az-symbol-leer"));
            }
            reihe.appendChild(platz);
        }
        az.appendChild(reihe);
        ort.appendChild(az);

        /* Statistik der App. */
        if (o.statistik) {
            const s = abschnitt(t.statistik);
            inhaltEinsetzen(s, o.statistik);
            ort.appendChild(s);
        }

        /* Stand: je Spiel eine Zeile. */
        const orte = Array.isArray(d.orte) ? d.orte : [];
        if (orte.length > 0) {
            const wo = abschnitt(t.orte);
            const liste2 = el("div", "up-pf-orte");
            for (const eintrag of orte) {
                const z = el("div", "up-pf-ort");
                const bild = el("span", "up-pf-ort-bild");
                if (eintrag.pfad) {
                    bild.appendChild(zeichen(eintrag.pfad));
                }
                z.appendChild(bild);
                const text = el("span", "up-pf-ort-text");
                text.appendChild(el("small", "", eintrag.spiel || ""));
                text.appendChild(el("b", "", eintrag.titel || ""));
                if (eintrag.unter) {
                    text.appendChild(el("small", "", eintrag.unter));
                }
                z.appendChild(text);
                if (typeof eintrag.anteil === "number") {
                    const b = el("span", "up-pf-ort-balken");
                    const i = el("i");
                    i.style.width = Math.round(anteilVon(eintrag.anteil) * 100) + "%";
                    b.appendChild(i);
                    z.appendChild(b);
                }
                liste2.appendChild(z);
            }
            wo.appendChild(liste2);
            ort.appendChild(wo);
        }

        for (const zusatz of (o.zusatz || [])) {
            if (zusatz) {
                ort.appendChild(zusatz);
            }
        }
        return ort;
    }

    /* Das ausführliche Profil als Blatt. Zahnrad nur im eigenen Profil (und nur mit beiZahnrad). */
    function oeffnen(daten, optionen) {
        const o = optionen || {};
        const t = Object.assign({}, TEXTE, o.texte || {});
        if (typeof UPCREW_BLATT === "undefined") {
            return null;
        }
        const rechts = (o.eigen === true && typeof o.beiZahnrad === "function") ? [zahnrad(o.beiZahnrad, t.zahnrad)] : [];
        return UPCREW_BLATT.oeffnen({
            titel: o.titel || t.profil,
            rechts: rechts,
            klasse: "up-pf-blatt",
            inhalt: (ort) => zeichnen(ort, daten, o)
        });
    }

    /* Die Auswahl: alle Abzeichen (verdiente antippbar), die gewählten mit Haken. Höchstens `plaetze`; beim Vierten
       fällt das älteste heraus. `beiWechsel(neueListe)` nach jedem Tipp; `beiGesperrt(eintrag)` für nicht verdiente. */
    function abzeichenWahl(ort, alle, gewaehlt, optionen) {
        const o = optionen || {};
        const t = Object.assign({}, TEXTE, o.texte || {});
        const plaetze = (typeof o.plaetze === "number" && o.plaetze > 0) ? o.plaetze : 3;
        let wahl = (Array.isArray(gewaehlt) ? gewaehlt : []).slice(0, plaetze);
        const vorrat = Array.isArray(alle) ? alle : [];

        function fuellen() {
            ort.innerHTML = "";
            ort.classList.add("up-pf", "up-pf-wahl");
            ort.appendChild(el("p", "up-pf-hinweis", t.wahlHinweis + " · " + wahl.length + "/" + plaetze));
            const raster = el("div", "up-pf-alle");
            for (const eintrag of vorrat) {
                const kennung = eintrag.kennung || eintrag.id;
                const an = wahl.indexOf(kennung) !== -1;
                const zelle = el("div", "up-pf-wahl-zelle" + (eintrag.erreicht > 0 ? "" : " up-pf-gesperrt")
                    + (an ? " up-pf-an" : ""));
                const kachel = kachelVon(eintrag, () => {
                    if (!(eintrag.erreicht > 0)) {
                        if (typeof o.beiGesperrt === "function") {
                            o.beiGesperrt(eintrag);
                        }
                        return;
                    }
                    if (an) {
                        wahl = wahl.filter((k) => k !== kennung);
                    } else {
                        wahl = wahl.concat([kennung]);
                        if (wahl.length > plaetze) {
                            wahl = wahl.slice(wahl.length - plaetze);
                        }
                    }
                    fuellen();
                    if (typeof o.beiWechsel === "function") {
                        o.beiWechsel(wahl.slice());
                    }
                });
                kachel.setAttribute("aria-pressed", an ? "true" : "false");
                zelle.appendChild(kachel);
                if (an) {
                    const haken = el("span", "up-pf-haken");
                    haken.appendChild(zeichen("haken"));
                    zelle.appendChild(haken);
                }
                raster.appendChild(zelle);
            }
            ort.appendChild(raster);
        }
        fuellen();
        return { wahl: () => wahl.slice(), neu: fuellen };
    }

    const UPCREW_PROFIL = { vorschau: vorschau, kopfzeile: kopfzeile, menue: menue, zeichnen: zeichnen, oeffnen: oeffnen, abzeichenWahl: abzeichenWahl,
        ring: ring, abschnitt: abschnitt, levelKachel: levelKachel, levelBalken: levelBalken, seitKurz: seitKurz, levelStand: levelStand, zahnrad: zahnrad,
        TEXTE: TEXTE, PFADE: PFADE };
    if (typeof window !== "undefined") {
        window.UPCREW_PROFIL = UPCREW_PROFIL;
    }
    if (typeof globalThis !== "undefined") {
        globalThis.UPCREW_PROFIL = UPCREW_PROFIL;
    }
    if (typeof module !== "undefined" && module.exports) {
        module.exports = UPCREW_PROFIL;
    }
})();
