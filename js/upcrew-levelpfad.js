/*
 * upcrew-levelpfad.js — der Level-Pfad: ein Blatt mit dem Weg der Level (erreicht · aktuell mit Fortschritt ·
 * kommend), je Stufe die Belohnung. Gleich in allen UPCrew-Spielen (gehört zu css/upcrew-levelpfad.css; nutzt
 * js/upcrew-blatt.js, wenn da). Neu 29.09.2026.
 *
 * Nutzer 29.09.2026: „ich will auf level klicken können um den level pfad zu sehen“. Geöffnet wird er von JEDER
 * Level-Anzeige: Level-Knopf der Vorschau-Karte, Level-Balken im ausführlichen Profil (klappt ihn dort inline auf),
 * Ring im Kopf der App.
 *
 * DATEN: das GEMEINSAME Level (Zweig-Modell, Level 10 in Blunderluck = Level 10 in Typoluck). Die App gibt, was
 * `FORTSCHRITT.levelAus(gesamtXp)` ohnehin liefert: { level, imLevel, kosten, anteil }. Die Kosten je Level rechnet
 * `kosten(L)` wie `FORTSCHRITT.levelKosten` beider Apps: min(100 + 25 (L − 1), 500) XP.
 *
 * BELOHNUNGEN: Tabelle der Belohnungen (samt Nachtrag 28.09. nachts: Lv 7
 * 100 Münzen, Lv 32 Profil-Banner, ab 51 „Rest 2“ Truhe). PLATZHALTER (platzhalter: true, schlicht „100 Münzen“),
 * weil der Serien-Schutz am 29.09.2026 ganz wegfiel („serien schild raus“): Lv 13, 19, 29, 37, 44, 49 und ab 51
 * jedes Level mit Rest 0 bei Teilung durch 3 (nicht durch 5). Ebenfalls Platzhalter: ab 51 jedes zehnte Level
 * („etwas Einmaliges“ — noch nicht festgelegt). Die Koordination/der Nutzer entscheidet; bis dahin ändert man nur
 * `TABELLE`/`stufe()` hier (oder die App gibt `optionen.stufe` mit, z. B. aus einem künftigen upcrew-katalog.js).
 * Die Tabelle ist nur ANZEIGE — was wirklich freigeschaltet ist, entscheidet weiter die App (UPCREW_ANPASSEN.STUFEN).
 * Seit 29.09.2026c („alle auf Schwarz-Weiß"): Start-Farbwelt ist Grau (Level 1 „Grundausstattung"), die bisherige
 * Standard-Farbwelt Werkstatt kommt mit Level 2 (PLATZHALTER, samt der 50 Münzen); STUFEN.farbwelt folgt dieser
 * Tabelle (Studio 3, Feld 11, Tiefsee 21, Gold 40).
 *
 *     UPCREW_LEVELPFAD.oeffnen({ level: 14, imLevel: 264, kosten: 425 }, { titel?, bis?, texte?, stufe? });
 *         // öffnet ein Blatt (UPCREW_BLATT), rollt zur aktuellen Stufe; → das Blatt
 *     UPCREW_LEVELPFAD.zeichnen(ort, daten, optionen)   // nur der Inhalt (ohne Blatt), → ort
 *         // optionen.kopf: false → ohne den Kopf (Level groß + Balken); so klappt ihn das Profil unter seinem
 *         // Level-Balken auf (seit 29.09.2026 spät, BL v0.157.2 / TL 0.26.2)
 *     UPCREW_LEVELPFAD.stufe(14)   → { level: 14, art: "material", name: "Material Kreide", stern: false, platzhalter: false }
 *     UPCREW_LEVELPFAD.kosten(14)  → 425            UPCREW_LEVELPFAD.ausXp(2100) → { level, imLevel, kosten, anteil }
 *     UPCREW_LEVELPFAD.knopf(element, () => daten)  // macht eine vorhandene Level-Anzeige antippbar (Tastatur mit)
 *
 * `bis`: bis zu welchem Level gezeigt wird (Vorgabe: aktuelles + 15, mindestens 20). Alle Texte über textContent;
 * Farben aus der Farbwelt.
 */
(function () {
    "use strict";

    const RAUM = "http://www.w3.org/2000/svg";

    /* Zeichen je Art (24er-Raster, Strich 2, runde Enden). */
    const PFADE = {
        start: "M4 11 L12 4 L20 11 V20 H4 Z",
        muenzen: "M12 3 A9 9 0 1 0 12.01 3 Z M12 7 A5 5 0 1 0 12.01 7 Z",
        farbwelt: "M12 3 A9 9 0 1 0 12 21 C13.5 21 14 20 14 19 C14 17.5 15 17 16.5 17 H18 A3 3 0 0 0 21 14 C21 8 17 3 12 3 Z",
        knoepfe: "M4 8 H20 V16 H4 Z M8 12 H16",
        material: "M12 3 L21 8 L12 13 L3 8 Z M3 12 L12 17 L21 12 M3 16 L12 21 L21 16",
        schrift: "M5 19 L11 5 H13 L19 19 M8 14 H16",
        effekt: "M12 3 L13.8 10.2 L21 12 L13.8 13.8 L12 21 L10.2 13.8 L3 12 L10.2 10.2 Z",
        rahmen: "M4 4 H20 V20 H4 Z M8 8 H16 V16 H8 Z",
        titel: "M6 3 H18 V21 L12 17 L6 21 Z",
        zeichen: "M12 3 L14.6 8.6 L20.6 9.3 L16.1 13.4 L17.3 19.4 L12 16.4 L6.7 19.4 L7.9 13.4 L3.4 9.3 L9.4 8.6 Z",
        flamme: "M12 3 C15 7 18 9 18 14 A6 6 0 0 1 6 14 C6 11 8 9 9 7 C10 10 11 11 12 11 C12 8 11 6 12 3 Z",
        intro: "M8 5 L19 12 L8 19 Z",
        set: "M4 5 H10 V11 H4 Z M14 5 H20 V11 H14 Z M4 15 H10 V21 H4 Z M14 15 H20 V21 H14 Z",
        banner: "M5 21 V4 H19 L16 8.5 L19 13 H5",
        truhe: "M3 10 H21 V20 H3 Z M3 10 V7 A3 3 0 0 1 6 4 H18 A3 3 0 0 1 21 7 V10 M11 10 V13 H13 V10",
        haken: "M5 12.5 L10 17 L19 7",
        schloss: "M6 11 H18 V20 H6 Z M8.5 11 V8 A3.5 3.5 0 0 1 15.5 8 V11"
    };

    /* Level 1–50 (Konzept §5). [art, name, stern (nur erspielt), platzhalter] */
    const P = "platzhalter";
    const TABELLE = {
        1: ["start", "Grundausstattung"],
        2: ["farbwelt", "Farbwelt Werkstatt + 50 Münzen", false, P],   // 29.09.2026c: Werkstatt nicht mehr Start
        3: ["farbwelt", "Farbwelt Studio"],
        4: ["knoepfe", "Knöpfe K5 Kapsel"],
        5: ["material", "Material Holz"],
        6: ["schrift", "Schrift S4"],
        7: ["muenzen", "100 Münzen"],
        8: ["knoepfe", "Knöpfe K3 Taste"],
        9: ["effekt", "Sieg-Effekt Konfetti"],
        10: ["rahmen", "Rahmen Silber + Titel Stammgast", true],
        11: ["farbwelt", "Farbwelt Feld"],
        12: ["schrift", "Schrift S2"],
        13: ["muenzen", "100 Münzen", false, P],
        14: ["material", "Material Kreide"],
        15: ["rahmen", "Rahmen Gold", true],
        16: ["intro", "Intro wählen"],
        17: ["knoepfe", "Knöpfe K2 Kissen"],
        18: ["flamme", "Flammen-Farbe Blau"],
        19: ["muenzen", "100 Münzen", false, P],
        20: ["rahmen", "Rahmen Platin", true],
        21: ["farbwelt", "Farbwelt Tiefsee"],
        22: ["schrift", "Schrift S3"],
        23: ["effekt", "Sieg-Effekt Tinte"],
        24: ["set", "Set-Platz 4"],
        25: ["titel", "Titel Kenner", true],
        26: ["material", "Material Neon"],
        27: ["knoepfe", "Knöpfe K4 Stempel"],
        28: ["zeichen", "Profilzeichen Feder"],
        29: ["muenzen", "100 Münzen", false, P],
        30: ["rahmen", "Rahmen Glanz 1", true],
        31: ["schrift", "Schrift S5"],
        32: ["banner", "Profil-Banner"],
        33: ["effekt", "Sieg-Effekt Funken"],
        34: ["material", "Material Kupfer"],
        35: ["rahmen", "Rahmen Glanz 2", true],
        36: ["flamme", "Flammen-Farbe Violett"],
        37: ["muenzen", "100 Münzen", false, P],
        38: ["schrift", "Schrift S6"],
        39: ["zeichen", "Profilzeichen Krone"],
        40: ["farbwelt", "Farbwelt Gold", true],
        41: ["knoepfe", "Knöpfe K6 Ecke"],
        42: ["muenzen", "200 Münzen"],
        43: ["material", "Material Glas"],
        44: ["muenzen", "100 Münzen", false, P],
        45: ["rahmen", "Rahmen Glanz 3", true],
        46: ["effekt", "Sieg-Effekt Feuerwerk"],
        47: ["set", "Set-Platz 5"],
        48: ["muenzen", "250 Münzen"],
        49: ["muenzen", "100 Münzen", false, P],
        50: ["titel", "Titel Legende + Rahmen Glanz 4", true]
    };

    const TEXTE = {
        titel: "Level-Weg",
        level: "Level",
        xp: "XP",
        noch: "noch",
        erreicht: "erreicht",
        jetzt: "jetzt",
        stern: "nur erspielt"
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

    function zeichen(name, klasse) {
        const svg = document.createElementNS(RAUM, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        svg.setAttribute("class", klasse || "up-lp-zeichen");
        const p = document.createElementNS(RAUM, "path");
        p.setAttribute("d", PFADE[name] || PFADE.muenzen);
        svg.appendChild(p);
        return svg;
    }

    const ganz = (w, min) => Math.max(min, Math.floor(Number(w) || 0));

    function kosten(level) {
        const l = ganz(level, 1);
        return Math.min(100 + 25 * (l - 1), 500);
    }

    function ausXp(xp) {
        let rest = ganz(xp, 0);
        let level = 1;
        while (rest >= kosten(level)) {
            rest -= kosten(level);
            level++;
        }
        const k = kosten(level);
        return { level: level, imLevel: rest, kosten: k, anteil: rest / k };
    }

    /* Die Belohnung von Level L (reine Logik). */
    function stufe(level) {
        const l = ganz(level, 1);
        const t = TABELLE[l];
        if (t) {
            return { level: l, art: t[0], name: t[1], stern: t[2] === true, platzhalter: t[3] === P };
        }
        if (l % 10 === 0) {
            return { level: l, art: "zeichen", name: "Einmaliges Stück", stern: true, platzhalter: true };
        }
        if (l % 5 === 0) {
            return { level: l, art: "rahmen", name: "Glanz-Rahmen", stern: true, platzhalter: false };
        }
        const rest = l % 3;
        if (rest === 1) {
            return { level: l, art: "muenzen", name: "100 Münzen", stern: false, platzhalter: false };
        }
        if (rest === 2) {
            return { level: l, art: "truhe", name: "Truhe", stern: false, platzhalter: false };
        }
        return { level: l, art: "muenzen", name: "100 Münzen", stern: false, platzhalter: true };
    }

    function sauber(daten) {
        const d = daten || {};
        const level = ganz(d.level, 1);
        const k = ganz(d.kosten, 0) || kosten(level);
        const imLevel = Math.min(ganz(d.imLevel, 0), k);
        return { level: level, imLevel: imLevel, kosten: k, anteil: k > 0 ? imLevel / k : 0 };
    }

    function zeichnen(ort, daten, optionen) {
        const o = optionen || {};
        const t = Object.assign({}, TEXTE, o.texte || {});
        const d = sauber(daten);
        const stufeVon = typeof o.stufe === "function" ? (l) => Object.assign(stufe(l), o.stufe(l) || {}) : stufe;
        const bis = Math.max(ganz(o.bis, 0), d.level + 15, 20);
        ort.classList.add("up-lp");
        ort.textContent = "";

        /* Oben: Level groß, XP-Balken, „noch … XP“ — ohne mit `kopf: false` (im Profil aufgeklappt steht darüber
           schon der Level-Balken, seit 29.09.2026 spät). */
        const kopf = el("div", "up-lp-kopf");
        const zahl = el("div", "up-lp-gross");
        zahl.appendChild(el("small", "", t.level));
        zahl.appendChild(el("b", "", d.level));
        kopf.appendChild(zahl);
        const mitte = el("div", "up-lp-mitte");
        const balken = el("div", "up-lp-balken");
        const fuellung = el("i");
        fuellung.style.width = Math.round(d.anteil * 100) + "%";
        balken.appendChild(fuellung);
        mitte.appendChild(balken);
        mitte.appendChild(el("small", "up-lp-xp", d.imLevel + " / " + d.kosten + " " + t.xp + " · " + t.noch + " "
            + (d.kosten - d.imLevel)));
        kopf.appendChild(mitte);
        if (o.kopf !== false) {
            ort.appendChild(kopf);
        }

        /* Der Weg: von oben (Level 1) nach unten, Knoten an einer Linie; die aktuelle Stufe wird in die Mitte gerollt. */
        const weg = el("ol", "up-lp-weg");
        let aktuellEl = null;
        for (let l = 1; l <= bis; l++) {
            const s = stufeVon(l);
            const zustand = l < d.level ? "erreicht" : (l === d.level ? "aktuell" : "kommend");
            const li = el("li", "up-lp-stufe up-lp-" + zustand + (s.platzhalter ? " up-lp-platzhalter" : ""));
            li.dataset.level = String(l);
            const knoten = el("span", "up-lp-knoten");
            knoten.appendChild(el("b", "", l));
            li.appendChild(knoten);
            const karte = el("div", "up-lp-karte");
            const bild = el("span", "up-lp-bild");
            bild.appendChild(zeichen(s.art));
            karte.appendChild(bild);
            const text = el("span", "up-lp-text");
            const name = el("b", "", s.name);
            if (s.stern) {
                const stern = el("span", "up-lp-stern", "★");
                stern.title = t.stern;
                stern.setAttribute("aria-label", t.stern);
                name.appendChild(stern);
            }
            text.appendChild(name);
            if (zustand === "aktuell") {
                const b = el("span", "up-lp-balken up-lp-klein");
                const i = el("i");
                i.style.width = Math.round(d.anteil * 100) + "%";
                b.appendChild(i);
                text.appendChild(b);
            }
            karte.appendChild(text);
            const rechts = el("span", "up-lp-rechts");
            if (zustand === "erreicht") {
                rechts.appendChild(zeichen("haken", "up-lp-zeichen up-lp-klein-zeichen"));
                rechts.setAttribute("aria-label", t.erreicht);
            } else if (zustand === "aktuell") {
                rechts.textContent = t.jetzt;
            } else {
                rechts.appendChild(zeichen("schloss", "up-lp-zeichen up-lp-klein-zeichen"));
            }
            karte.appendChild(rechts);
            li.appendChild(karte);
            li.setAttribute("aria-label", t.level + " " + l + ": " + s.name + " · "
                + (zustand === "erreicht" ? t.erreicht : (zustand === "aktuell" ? t.jetzt : "")));
            if (zustand === "aktuell") {
                li.setAttribute("aria-current", "step");
                aktuellEl = li;
            }
            weg.appendChild(li);
        }
        ort.appendChild(weg);

        /* Zur aktuellen Stufe rollen, sobald das Blatt steht. */
        if (aktuellEl && typeof requestAnimationFrame === "function") {
            requestAnimationFrame(() => requestAnimationFrame(() => {
                /* Nur den rollbaren Halter bewegen (nie scrollIntoView: das rollte auch die gesperrte Seite). */
                let halter = ort;
                while (halter && halter !== document.body && !(halter.scrollHeight > halter.clientHeight + 1
                    && /auto|scroll/.test(getComputedStyle(halter).overflowY))) {
                    halter = halter.parentElement;
                }
                if (halter && halter !== document.body) {
                    const abstand = aktuellEl.getBoundingClientRect().top - halter.getBoundingClientRect().top;
                    halter.scrollTop = Math.max(0, halter.scrollTop + abstand - halter.clientHeight / 2
                        + aktuellEl.offsetHeight / 2);
                }
            }));
        }
        return ort;
    }

    function oeffnen(daten, optionen) {
        const o = optionen || {};
        const t = Object.assign({}, TEXTE, o.texte || {});
        if (typeof UPCREW_BLATT === "undefined") {
            return null;
        }
        return UPCREW_BLATT.oeffnen({
            titel: o.titel || t.titel,
            klasse: "up-lp-blatt",
            inhalt: (ort) => zeichnen(ort, daten, o)
        });
    }

    /* Macht eine vorhandene Level-Anzeige antippbar. `datenGeben` liefert beim Tipp den aktuellen Stand. */
    function knopf(element, datenGeben, optionen) {
        if (!element) {
            return element;
        }
        const t = Object.assign({}, TEXTE, (optionen && optionen.texte) || {});
        const echterKnopf = element.tagName === "BUTTON";
        if (!echterKnopf) {
            element.setAttribute("role", "button");
            element.tabIndex = 0;
        }
        element.classList.add("up-lp-antippbar");
        if (!element.getAttribute("aria-label")) {
            element.setAttribute("aria-label", t.titel);
        }
        const auf = (e) => {
            if (e && e.stopPropagation) {
                e.stopPropagation();
            }
            oeffnen(typeof datenGeben === "function" ? datenGeben() : datenGeben, optionen);
        };
        element.addEventListener("click", auf);
        if (!echterKnopf) {
            element.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    auf(e);
                }
            });
        }
        return element;
    }

    const UPCREW_LEVELPFAD = { oeffnen: oeffnen, zeichnen: zeichnen, stufe: stufe, kosten: kosten, ausXp: ausXp,
        knopf: knopf, TABELLE: TABELLE, TEXTE: TEXTE, PFADE: PFADE };
    if (typeof window !== "undefined") {
        window.UPCREW_LEVELPFAD = UPCREW_LEVELPFAD;
    }
    if (typeof globalThis !== "undefined") {
        globalThis.UPCREW_LEVELPFAD = UPCREW_LEVELPFAD;
    }
    if (typeof module !== "undefined" && module.exports) {
        module.exports = UPCREW_LEVELPFAD;
    }
})();
