/*
 * upcrew-abzeichen.js — die fünf Abzeichen, gleich in Blunderluck und Typoluck (gehört zu css\upcrew-abzeichen.css).
 * Gemeinsamer Baustein: in die Apps KOPIEREN, nie abwandeln.
 *
 * Nutzer, 27.09.2026: „es fehlen die Abzeichen, die sollen kopiert werden“. Vorlage: Typoluck 0.12.0
 * (js\fortschritt.js `ABZEICHEN`, `abzeichenWerte`, `abzeichen`; js\bausteine.js `abzeichen`;
 * js\bildschirm-profil.js `_abzeichenZeigen`) — Rechnung und Aussehen 1:1, hier als EIN reiner Baustein.
 *
 * Gerechnet wird aus dem GEMEINSAMEN Fortschritt über ALLE Zweige (spiele.blunderluck, spiele.typoluck …), damit
 * beide Apps dieselben Zahlen zeigen. Nur die LAUFENDE Serie kennt der Baustein nicht (sie hängt an Level und
 * Serien-Schutz der App) — die App gibt sie mit.
 *
 *     const liste = UPCREW_ABZEICHEN.liste(stand, laufendeSerie);   // [{ id, titel, kurz, zeichen, stufen, weiter,
 *                                                                   //    einheit, wert, erreicht, naechste }]
 *     raster.appendChild(UPCREW_ABZEICHEN.kachel(eintrag, () => …)); // Knopf: Zeichen, Punkte je Stufe, Kurzname
 *     DIALOG.hinweis(eintrag.titel, "", UPCREW_ABZEICHEN.blatt(eintrag));   // Wert + Stufen (antippen)
 *     UPCREW_ABZEICHEN.raster(liste, beiKlick)                     // alle fünf im Raster (Profil, Sammlung)
 *
 * Stufen: erst die festen, danach in festen Schritten (`weiter`) ohne Ende („nach oben offen“); `weiter: 0` = keine
 * weiteren Stufen (einmalige Abzeichen der Spiele).
 * Alle Texte über textContent; Zeichen als SVG-Pfade (24er-Raster, Strich 2, runde Enden).
 *
 * EINE LISTE FÜR ALLE SPIELE (Vorschlag Blunderluck v0.156.0, Nutzer 28.09.2026: „wenn ich in dem einen Spiel ein
 * Abzeichen bekomme, soll es fix im Profil liegen; man soll 3 ausrüsten können, egal aus welchem Spiel“):
 *     UPCREW_ABZEICHEN.registrieren("blunderluck", eintraege, { marke: "BL", name: "Blunderluck" });
 *         // eintraege: [{ kennung: "bl-…", titel, kurz, pfad, text, feld, stufen, weiter, einheit }]
 *         // Wert = spiele.<spiel>.zaehler[feld] im GEMEINSAMEN Stand — so sieht jedes Spiel die Abzeichen der
 *         // anderen, ohne ihre Rechnung zu kennen. Die Listen stehen in js\upcrew-abzeichen-spiele.js (Daten,
 *         // in alle Apps kopiert); jedes Spiel schreibt seine verdienten Zähler selbst in den eigenen Zweig.
 *     const alle = UPCREW_ABZEICHEN.alle(stand, laufendeSerie);   // die fünf gemeinsamen (Kennung „up-<id>“,
 *                                                                 // Marke „UP“) + alle angemeldeten Spiele
 *     UPCREW_ABZEICHEN.ausgeruestet(alle, konto.abzeichen, 3, umdeuten)   // die gewählten, nur verdiente
 *     UPCREW_ABZEICHEN.kachel(eintrag, beiKlick)   // mit `pfad` eigenes Zeichen, mit `marke` kleines Schild oben
 *     UPCREW_ABZEICHEN.symbol(eintrag, beiKlick)   // KOMPAKT: nur das Zeichen im Kreis (Name als title/aria-label)
 *     UPCREW_ABZEICHEN.fremdAusgeruestet(alle, gewaehlt, 3, umdeuten, pruefen)   // FREMDE: Spiel-Abzeichen gelten
 *                                                  // als verdient (seit 29.09.2026 in beiden Apps gleich)
 */
(function () {
    "use strict";

    const ABZEICHEN = [
        { id: "partien", titel: "Viel gespielt", kurz: "Partien", zeichen: "partie",
            stufen: [10, 50, 100, 250, 500, 1000], weiter: 500, einheit: "Partien" },
        { id: "besteSerie", titel: "Serie", kurz: "Serie", zeichen: "serie",
            stufen: [3, 7, 30, 100, 365], weiter: 365, einheit: "Tage am Stück" },
        { id: "beideTage", titel: "Beide Spiele", kurz: "Beide", zeichen: "beide",
            stufen: [1, 10, 30, 100], weiter: 100, einheit: "Tage" },
        { id: "figuren", titel: "Figuren", kurz: "Figuren", zeichen: "koenig",
            stufen: [10, 30, 60, 100, 150], weiter: 50, einheit: "Figuren" },
        { id: "tagesaufgaben", titel: "Tagesaufgaben", kurz: "Heute", zeichen: "kalender",
            stufen: [1, 10, 50, 100, 365], weiter: 365, einheit: "geschafft" }
    ];

    /* Die Pfade wörtlich aus Typoluck js\bausteine.js (dort aus dem Entwurf Herausforderungen). */
    const ZEICHEN = {
        partie: "M8 5 L19 12 L8 19 Z",
        serie: "M12 3 C15 7 18 9 18 14 A6 6 0 0 1 6 14 C6 11 8 9 9 7 C10 10 11 11 12 11 C12 8 11 6 12 3 Z",
        beide: "M4 9 H14 V20 H4 Z M10 4 H20 V15 H16",
        kalender: "M4 6 H20 V20 H4 Z M4 10 H20 M8 3 V7 M16 3 V7",
        koenig: "M11 1.5 H13 V3.5 H15 V5.5 H13 V7.5 H11 V5.5 H9 V3.5 H11 Z M7.5 9 C9 8 15 8 16.5 9 L15 17.5 H9 Z "
            + "M6 18.5 H18 V21.5 H6 Z"
    };

    const XP_MAX = 10000000;
    const TAGE_MAX = 60;

    const istObjekt = (w) => !!w && typeof w === "object" && !Array.isArray(w);
    const zahl = (w, hoechstens) => (typeof w === "number" && isFinite(w) && w > 0)
        ? Math.min(Math.floor(w), hoechstens || XP_MAX) : 0;
    const istDatum = (w) => typeof w === "string" && /^\d{4}-\d{2}-\d{2}$/.test(w);

    function tageVon(zweig) {
        const liste = (zweig && Array.isArray(zweig.tage)) ? zweig.tage : [];
        return liste.filter((tag, stelle) => istDatum(tag) && liste.indexOf(tag) === stelle).sort().slice(-TAGE_MAX);
    }

    function zaehlerVon(zweig, feld) {
        return (zweig && istObjekt(zweig.zaehler)) ? zahl(zweig.zaehler[feld]) : 0;
    }

    /* Figuren: ausserhalb des Turms (`zaehler.figuren`) plus die besten Figuren je Turm-Stufe (1 bis 3). */
    function figurenVon(zweig) {
        let summe = zaehlerVon(zweig, "figuren");
        const turm = (zweig && istObjekt(zweig.turm) && istObjekt(zweig.turm.figuren)) ? zweig.turm.figuren : {};
        for (const schluessel of Object.keys(turm)) {
            summe += zahl(turm[schluessel], 3);
        }
        return summe;
    }

    /* Tagesaufgaben: der Zähler, wo es ihn gibt, sonst die gemerkten Tage. */
    function tagesaufgabenVon(zweig) {
        const hatZaehler = zweig && istObjekt(zweig.zaehler) && typeof zweig.zaehler.tagesaufgaben === "number";
        return hatZaehler ? zaehlerVon(zweig, "tagesaufgaben") : tageVon(zweig).length;
    }

    /* Die Werte über ALLE Spiele. `laufend` = die laufende Serie der App (Tage), sonst 0. */
    function werte(stand, laufend) {
        const spiele = (istObjekt(stand) && istObjekt(stand.spiele)) ? stand.spiele : {};
        const zweige = Object.keys(spiele).map((app) => spiele[app]).filter(istObjekt);
        const summe = (rechnung) => zweige.reduce((s, zweig) => s + rechnung(zweig), 0);

        /* Beide Spiele: gezählte Tage aller Zweige — mindestens aber die Tage, die in zwei Zweigen stehen. */
        const gesehen = {};
        let gemeinsam = 0;
        for (const zweig of zweige) {
            for (const tag of tageVon(zweig)) {
                gesehen[tag] = (gesehen[tag] || 0) + 1;
                if (gesehen[tag] === 2) {
                    gemeinsam++;
                }
            }
        }

        return {
            partien: summe((z) => zahl(z.partien)),
            besteSerie: Math.max(zahl(laufend), ...zweige.map((z) => zaehlerVon(z, "besteSerie")), 0),
            beideTage: Math.max(summe((z) => zaehlerVon(z, "beideTage")), gemeinsam),
            figuren: summe(figurenVon),
            tagesaufgaben: summe(tagesaufgabenVon)
        };
    }

    /* Die Abzeichen mit erreichter Stufe; über die letzte Stufe hinaus in festen Schritten weiter. */
    function liste(stand, laufend) {
        const w = werte(stand, laufend);
        return ABZEICHEN.map((abzeichen) => {
            const wert = w[abzeichen.id] || 0;
            let erreicht = abzeichen.stufen.filter((stufe) => wert >= stufe).length;
            let naechste = abzeichen.stufen[erreicht];
            if (naechste === undefined && !(abzeichen.weiter > 0)) {
                naechste = null;
            } else if (naechste === undefined) {
                const letzte = abzeichen.stufen[abzeichen.stufen.length - 1];
                const dazu = Math.floor((wert - letzte) / abzeichen.weiter);
                erreicht += dazu;
                naechste = letzte + (dazu + 1) * abzeichen.weiter;
            }
            return Object.assign({}, abzeichen, { stufen: abzeichen.stufen.slice(), wert: wert,
                erreicht: erreicht, naechste: naechste });
        });
    }

    /* ---- Eine Liste für alle Spiele (seit dem Vorschlag Blunderluck v0.156.0) ---- */

    const SPIELE = [];
    const GEMEINSAM = { spiel: "upcrew", marke: "UP", name: "UPCrew" };

    /* Die Abzeichen EINES Spiels anmelden (ersetzt eine frühere Anmeldung desselben Spiels). */
    function registrieren(spiel, eintraege, info) {
        const i = info || {};
        const sauber = (Array.isArray(eintraege) ? eintraege : []).filter((e) => istObjekt(e)
            && typeof e.kennung === "string" && e.kennung !== "" && typeof e.feld === "string"
            && /^[a-zA-Z]{1,32}$/.test(e.feld) && Array.isArray(e.stufen) && e.stufen.length > 0);
        const alt = SPIELE.findIndex((s) => s.spiel === spiel);
        const eintrag = { spiel: String(spiel), marke: String(i.marke || ""), name: String(i.name || spiel),
            abzeichen: sauber };
        if (alt === -1) {
            SPIELE.push(eintrag);
        } else {
            SPIELE[alt] = eintrag;
        }
        return sauber.length;
    }

    /* Die Abzeichen eines angemeldeten Spiels aus dem gemeinsamen Stand. */
    function spielListe(stand, spiel) {
        const s = SPIELE.find((x) => x.spiel === spiel);
        if (!s) {
            return [];
        }
        const spiele = (istObjekt(stand) && istObjekt(stand.spiele)) ? stand.spiele : {};
        const zweig = istObjekt(spiele[spiel]) ? spiele[spiel] : null;
        return s.abzeichen.map((a) => {
            const wert = zaehlerVon(zweig, a.feld);
            const stufen = a.stufen.slice();
            const weiter = (typeof a.weiter === "number" && a.weiter > 0) ? a.weiter : 0;
            let erreicht = stufen.filter((stufe) => wert >= stufe).length;
            let naechste = stufen[erreicht];
            if (naechste === undefined && weiter > 0) {
                const letzte = stufen[stufen.length - 1];
                const dazu = Math.floor((wert - letzte) / weiter);
                erreicht += dazu;
                naechste = letzte + (dazu + 1) * weiter;
            }
            return Object.assign({}, a, { id: a.kennung, stufen: stufen, weiter: weiter, wert: wert,
                erreicht: erreicht, naechste: naechste === undefined ? null : naechste,
                spiel: s.spiel, marke: s.marke, spielName: s.name, einheit: a.einheit || "" });
        });
    }

    /* Alle Abzeichen: die fünf gemeinsamen, dann jedes angemeldete Spiel. Kennung = das, was im Konto-Feld
       `abzeichen` steht (gemeinsame: „up-<id>“). */
    function alle(stand, laufend) {
        const gemeinsam = liste(stand, laufend).map((e) => Object.assign(e, { kennung: "up-" + e.id,
            spiel: GEMEINSAM.spiel, marke: GEMEINSAM.marke, spielName: GEMEINSAM.name }));
        return SPIELE.reduce((summe, s) => summe.concat(spielListe(stand, s.spiel)), gemeinsam);
    }

    /* Die ausgerüsteten (höchstens `max`, Vorgabe 3) in der gewählten Reihenfolge — nur verdiente, keine doppelt.
       `umdeuten(kennung)` (wahlfrei) übersetzt alte Kennungen einer App. */
    function ausgeruestet(eintraege, gewaehlt, max, umdeuten) {
        const grenze = (typeof max === "number" && max > 0) ? max : 3;
        const vorrat = Array.isArray(eintraege) ? eintraege : [];
        const aus = [];
        for (const roh of (Array.isArray(gewaehlt) ? gewaehlt : [])) {
            const kennung = (typeof umdeuten === "function") ? umdeuten(roh) : roh;
            const e = vorrat.find((x) => (x.kennung || x.id) === kennung);
            if (e && e.erreicht > 0 && aus.indexOf(e) === -1) {
                aus.push(e);
            }
            if (aus.length >= grenze) {
                break;
            }
        }
        return aus;
    }

    /* FREMDE PROFILE (Nutzer 29.09.2026: „die 3 ausgerüsteten werden überall gezeigt, egal aus welchem Spiel — auch
       bei Fremden“): Abzeichen EINES Spiels stehen nicht im öffentlichen Auszug. Die Auswahl nimmt nur Verdientes an
       (UPCREW_PROFIL.abzeichenWahl), also gilt jedes gewählte Spiel-Abzeichen als verdient (mindestens Stufe 1) —
       ausser `pruefen(eintrag)` sagt ausdrücklich false (z. B. Blunderluck prüft bl-… an der Chronik). Die gemeinsamen
       (up-…) rechnet der Auszug selbst. Setzt `erreicht` in `eintraege` mit (auch „Abzeichen“ im Profil) und liefert
       die ausgerüsteten wie `ausgeruestet`. */
    function fremdAusgeruestet(eintraege, gewaehlt, max, umdeuten, pruefen) {
        const vorrat = Array.isArray(eintraege) ? eintraege : [];
        const kennungen = (Array.isArray(gewaehlt) ? gewaehlt : [])
            .map((roh) => (typeof umdeuten === "function") ? umdeuten(roh) : roh);
        for (const kennung of kennungen) {
            const e = vorrat.find((x) => (x.kennung || x.id) === kennung);
            if (e && String(e.kennung || "").indexOf("up-") !== 0
                    && !(typeof pruefen === "function" && pruefen(e) === false)) {
                e.erreicht = Math.max(1, Number(e.erreicht) || 0);
            }
        }
        return ausgeruestet(vorrat, kennungen, max);
    }

    /* ---- Aussehen (1:1 Typoluck, Klassen up-az-…) ---- */

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

    function zeichen(name, eigenerPfad) {
        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("class", "up-az-zeichen");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        const pfad = document.createElementNS(ns, "path");
        pfad.setAttribute("d", (typeof eigenerPfad === "string" && eigenerPfad !== "") ? eigenerPfad
            : (ZEICHEN[name] || ""));
        svg.appendChild(pfad);
        return svg;
    }

    /* Ein Abzeichen als Knopf: Zeichen, je Stufe ein Punkt (erreichte golden), „+n“ über die letzte hinaus,
       darunter der Kurzname. Ohne erreichte Stufe blass. */
    function kachel(eintrag, beiKlick) {
        const feld = el("button", "up-az" + (eintrag.erreicht > 0 ? " up-az-an" : ""));
        feld.type = "button";
        feld.setAttribute("aria-label", eintrag.titel + ": " + eintrag.wert + ", Stufe " + eintrag.erreicht);
        feld.appendChild(zeichen(eintrag.zeichen, eintrag.pfad));
        if (eintrag.marke) {
            const marke = el("span", "up-az-marke", eintrag.marke);
            marke.setAttribute("aria-hidden", "true");
            feld.appendChild(marke);
        }
        const punkte = el("span", "up-az-punkte");
        punkte.setAttribute("aria-hidden", "true");
        eintrag.stufen.forEach((stufe, i) => {
            punkte.appendChild(el("i", i < eintrag.erreicht ? "an" : null));
        });
        const extra = eintrag.erreicht - eintrag.stufen.length;
        if (extra > 0) {
            punkte.appendChild(el("b", null, "+" + extra));
        }
        feld.appendChild(punkte);
        feld.appendChild(el("span", "up-az-name", eintrag.kurz));
        if (typeof beiKlick === "function") {
            feld.addEventListener("click", beiKlick);
        }
        return feld;
    }

    /* Der Inhalt zum Antippen: Wert mit Einheit, die Stufen (erreichte golden), „+weiter …“. */
    function blatt(eintrag) {
        const inhalt = el("div", "up-az-blatt");
        const wert = el("p", "up-az-wert");
        wert.appendChild(el("strong", null, String(eintrag.wert)));
        wert.appendChild(el("span", null, " " + eintrag.einheit));
        inhalt.appendChild(wert);
        const stufen = el("div", "up-az-stufen");
        for (const stufe of eintrag.stufen) {
            stufen.appendChild(el("span", eintrag.wert >= stufe ? "an" : null, String(stufe)));
        }
        if (eintrag.weiter > 0) {
            stufen.appendChild(el("span", "leise", "+" + eintrag.weiter + " …"));
        }
        inhalt.appendChild(stufen);
        if (eintrag.text) {
            inhalt.appendChild(el("p", "up-az-text", eintrag.text));
        }
        if (eintrag.spielName) {
            inhalt.appendChild(el("p", "up-az-herkunft", eintrag.spielName));
        }
        return inhalt;
    }

    /* KOMPAKT (Start-Kopf, Vorschau-Karte, „Ausgerüstet“ im Profil; Koordination 29.09.2026 „Start ohne Scrollen“):
       nur das Zeichen im Kreis, kein Wort — der Name steht in title/aria-label bzw. beim Antippen. Ohne Eintrag ein
       leerer Kreis. Mit `beiKlick` ein Knopf, sonst ein span. */
    function symbol(eintrag, beiKlick) {
        const knopf = typeof beiKlick === "function";
        const s = el(knopf ? "button" : "span", "up-az-symbol" + (eintrag ? (eintrag.erreicht > 0 ? " up-az-an" : "")
            : " up-az-symbol-leer"));
        if (knopf) {
            s.type = "button";
            s.addEventListener("click", beiKlick);
        }
        if (eintrag) {
            const name = String(eintrag.titel || eintrag.kurz || "")
                + (eintrag.spielName ? " · " + eintrag.spielName : "");
            s.setAttribute(knopf ? "aria-label" : "title", name);
            if (knopf) {
                s.title = name;
            } else {
                s.setAttribute("role", "img");
                s.setAttribute("aria-label", name);
            }
            s.appendChild(zeichen(eintrag.zeichen, eintrag.pfad));
        }
        return s;
    }

    /* Alle fünf im Raster; `beiKlick(eintrag)` je Abzeichen. */
    function raster(eintraege, beiKlick) {
        const r = el("div", "up-az-raster");
        for (const eintrag of eintraege) {
            r.appendChild(kachel(eintrag, typeof beiKlick === "function" ? () => beiKlick(eintrag) : null));
        }
        return r;
    }

    const UPCREW_ABZEICHEN = { ABZEICHEN: ABZEICHEN, ZEICHEN: ZEICHEN, werte: werte, liste: liste,
        kachel: kachel, symbol: symbol, blatt: blatt, raster: raster,
        SPIELE: SPIELE, registrieren: registrieren, spielListe: spielListe, alle: alle, ausgeruestet: ausgeruestet,
        fremdAusgeruestet: fremdAusgeruestet };
    globalThis.UPCREW_ABZEICHEN = UPCREW_ABZEICHEN;
    if (typeof module !== "undefined" && module.exports) {
        module.exports = UPCREW_ABZEICHEN;
    }
})();
