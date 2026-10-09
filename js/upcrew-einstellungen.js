/*
 * upcrew-einstellungen.js — Einstellungen UND Verwaltung im selben Aufbau, gleich in allen UPCrew-Spielen (gehört zu
 * css/upcrew-einstellungen.css). Entstanden in Blunderluck v0.156.0
 * (Entwurf Oberfläche Runde 7, vom Nutzer abgenommen 28.09.2026).
 *
 * Nutzer, 28.09.2026 (nachts): „verwalten und die einstellungen sollen in beiden spielen gleich aussehen“ →
 * Aufbau, Reihenfolge und Aussehen gleich; spiel-eigene Einträge stehen in EINEM eigenen Abschnitt
 * („nur in <Spiel>“).
 *
 *     UPCREW_EINSTELLUNGEN.bauen(ort, "einstellungen" | "verwaltung", abschnitte, { spiel: "Blunderluck" });
 *
 *     abschnitt = { art: "konto", titel?: "…", zeilen: [zeile, …], hinweis?: "…", inhalt?: element }
 *     zeile     = { zeichen?: "person" | "<Pfad>", titel: "…", unter?: "…", tag?: "#1234",
 *                  rechts?: element | "pfeil" | "Text", beiKlick?: () => …, gefahr?: true, klasse?: "…" }
 *                 Mit `beiKlick` ist die Zeile ein Knopf (aria-label = titel), sonst eine Anzeige.
 *
 * Die REIHENFOLGE ist fest (REIHENFOLGE.<art>); die App liefert nur, was sie hat — was fehlt, fällt weg:
 *   einstellungen: konto · aussehen · privatsphaere · spiel · hilfe · admin · ueber · gefahr
 *   verwaltung:    spieler · datenbank · spiel · ende
 * Der Abschnitt „spiel“ trägt ohne eigenen Titel „Nur in <Spiel>“ (Marke).
 *
 * Helfer für die rechte Seite: schalter(an, beiWechsel, name) · segment(optionen, wert, beiWahl, name) ·
 * pfeil() · wert(text) · lampe(zustand). Kein Spiel-Eigenes hier; alle Texte über textContent, Farben aus der Farbwelt.
 *
 * Nutzer 29.09.2026: „bei speicher mache eine status lampe rein · das einstellungs symbol ist kein zahnrad · zu viele
 * texte sätze im profil / einstellungen“ →
 *   STATUS-LAMPE:  const l = UPCREW_EINSTELLUNGEN.lampe("gespeichert" | "wartet" | "offline");  l.setzen("wartet");
 *                  grün „Gespeichert“ · gelb „Wartet“ · grau „Offline · später“ (Wort daneben, auch als aria-label).
 *                  Kurzform für die Zeile im Abschnitt „ueber“ (bzw. wo die App „Speicher“ zeigt):
 *                  zeilen.push(UPCREW_EINSTELLUNGEN.speicherZeile(zustand));  → { zeichen, titel: "Speicher",
 *                  rechts: lampe }; die Lampe hängt an `zeile.lampe`, damit die App sie später umstellen kann.
 *                  Auch "gruen"/"gelb"/"rot" und true/false/null (gespeichert/wartet/offline) werden verstanden.
 *   ZAHNRAD:       ZEICHEN.zahnrad = das gefüllte Zahnrad aus Blunderluck start.js `_zahnradBauen` (8 Zähne mit
 *                  geraden Flanken, Loch per evenodd) — NICHT mehr die „Sonne“ aus Kreis und Strichen.
 *                  zeichen("zahnrad") zeichnet es gefüllt; zahnradKnopf(beiKlick, name, klasse) = fertiger Knopf.
 *                  Jede Stelle, die zu den Einstellungen führt (Kopf, Profil-Blatt, Start), nimmt dieses Zeichen.
 *   KURZ:          `unter` einer Zeile höchstens 3 Wörter, `hinweis` eines Abschnitts höchstens 6 Wörter — Längeres
 *                  zeigt der Baustein NICHT (Warnung in der Konsole), damit keine Sätze mehr hineinrutschen.
 *                  Titel: „Konto“, „Spieler“ statt „UPCrew-Konto · alle Spiele“ usw.
 */
(function () {
    "use strict";

    const RAUM = "http://www.w3.org/2000/svg";

    const REIHENFOLGE = {
        einstellungen: ["konto", "aussehen", "privatsphaere", "spiel", "hilfe", "admin", "ueber", "gefahr"],
        verwaltung: ["spieler", "datenbank", "spiel", "ende"]
    };

    const TITEL = {
        konto: "Konto",
        aussehen: "Aussehen",
        privatsphaere: "Privatsphäre",
        hilfe: "Hilfe",
        admin: "Admin",
        ueber: "Über",
        gefahr: "",
        spieler: "Spieler",
        datenbank: "Datenbank",
        ende: ""
    };

    /* Zeichen im 24er-Raster (Strich 2, runde Enden). Eine App kann statt des Namens einen Pfad geben. */
    const ZEICHEN = {
        person: "M12 12 A4 4 0 1 0 12 4 A4 4 0 1 0 12 12 Z M4 21 C4 16 8 14 12 14 C16 14 20 16 20 21",
        schloss: "M6 11 H18 V20 H6 Z M8.5 11 V8 A3.5 3.5 0 0 1 15.5 8 V11",
        hoch: "M12 19 V6 M6 11 L12 5 L18 11",
        verlassen: "M10 5 H5 V19 H10 M14 8 L19 12 L14 16 M19 12 H9",
        farbe: "M12 3 A9 9 0 1 0 12 21 C13.5 21 14 20 14 19 C14 17.5 15 17 16.5 17 H18 A3 3 0 0 0 21 14 C21 8 17 3 12 3 Z",
        schrift: "M5 19 L11 5 H13 L19 19 M8 14 H16",
        sammlung: "M4 5 H10 V11 H4 Z M14 5 H20 V11 H14 Z M4 15 H10 V21 H4 Z M14 15 H20 V21 H14 Z",
        vibration: "M8 4 H16 V20 H8 Z M4 8 V16 M20 8 V16",
        uhr: "M12 3 A9 9 0 1 0 12.01 3 Z M12 7 V12 L15 14",
        hilfe: "M12 21 A9 9 0 1 0 12 3 A9 9 0 1 0 12 21 Z M9.5 9.5 A2.5 2.5 0 1 1 13 11.8 C12.3 12.2 12 12.8 12 13.5 M12 17 V17.1",
        werkzeug: "M14 6 A4 4 0 0 0 19 11 L21 9 A6 6 0 0 1 13 3 Z M14 10 L4 20",
        info: "M12 21 A9 9 0 1 0 12 3 A9 9 0 1 0 12 21 Z M12 11 V16 M12 8 V8.1",
        datenbank: "M4 6 C4 3.5 20 3.5 20 6 V18 C20 20.5 4 20.5 4 18 Z M4 6 C4 8.5 20 8.5 20 6 M4 12 C4 14.5 20 14.5 20 12",
        schild: "M12 3 L19 6 V11 C19 16 16 19 12 21 C8 19 5 16 5 11 V6 Z",
        liste: "M8 6 H20 M8 12 H20 M8 18 H20 M4 6 V6.1 M4 12 V12.1 M4 18 V18.1",
        figur: "M9 20 H15 M10 20 L10.5 14 H13.5 L14 20 M12 4 A3 3 0 1 0 12 10 A3 3 0 1 0 12 4 Z",
        brett: "M4 4 H20 V20 H4 Z M12 4 V20 M4 12 H20",
        buch: "M4 5 C7 4 10 4 12 6 C14 4 17 4 20 5 V19 C17 18 14 18 12 20 C10 18 7 18 4 19 Z M12 6 V20",
        rechts: "M9 5 L16 12 L9 19",
        /* Gefüllt (fill-rule evenodd), siehe Kopf „ZAHNRAD“. */
        zahnrad: "M19.37 10.16 L22.47 10.34 A10.6 10.6 0 0 1 22.47 13.66 L19.37 13.84 A7.6 7.6 0 0 1 18.51 15.91 "
            + "L20.58 18.23 A10.6 10.6 0 0 1 18.23 20.58 L15.91 18.51 A7.6 7.6 0 0 1 13.84 19.37 L13.66 22.47 "
            + "A10.6 10.6 0 0 1 10.34 22.47 L10.16 19.37 A7.6 7.6 0 0 1 8.09 18.51 L5.77 20.58 A10.6 10.6 0 0 1 3.42 18.23 "
            + "L5.49 15.91 A7.6 7.6 0 0 1 4.63 13.84 L1.53 13.66 A10.6 10.6 0 0 1 1.53 10.34 L4.63 10.16 "
            + "A7.6 7.6 0 0 1 5.49 8.09 L3.42 5.77 A10.6 10.6 0 0 1 5.77 3.42 L8.09 5.49 A7.6 7.6 0 0 1 10.16 4.63 "
            + "L10.34 1.53 A10.6 10.6 0 0 1 13.66 1.53 L13.84 4.63 A7.6 7.6 0 0 1 15.91 5.49 L18.23 3.42 "
            + "A10.6 10.6 0 0 1 20.58 5.77 L18.51 8.09 A7.6 7.6 0 0 1 19.37 10.16 Z "
            + "M15.4 12 A3.4 3.4 0 1 0 8.6 12 A3.4 3.4 0 1 0 15.4 12 Z"
    };
    const GEFUELLT = { zahnrad: true };

    /* Die Status-Lampe (siehe Kopf). */
    const LAMPE = {
        gespeichert: "Gespeichert",
        wartet: "Wartet",
        offline: "Offline · später"
    };
    const LAMPE_ALIAS = { gruen: "gespeichert", ok: "gespeichert", gelb: "wartet", rot: "offline", aus: "offline" };

    /* Höchstens so viele Wörter (siehe Kopf „KURZ“). */
    const KURZ = { unter: 3, hinweis: 6 };
    const woerter = (t) => String(t || "").trim().split(/\s+/).filter((w) => w !== "" && w !== "·").length;
    function kurzGenug(text, art) {
        if (woerter(text) <= KURZ[art]) {
            return true;
        }
        if (typeof console !== "undefined" && console.warn) {
            console.warn("upcrew-einstellungen: " + art + " zu lang, nicht gezeigt:", text);
        }
        return false;
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

    function zeichen(name, klasse) {
        const svg = document.createElementNS(RAUM, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        svg.setAttribute("class", klasse || "up-es-zeichen");
        const p = document.createElementNS(RAUM, "path");
        p.setAttribute("d", ZEICHEN[name] || name || "");
        if (GEFUELLT[name]) {
            svg.classList.add("up-es-gefuellt");
            p.setAttribute("fill-rule", "evenodd");
        }
        svg.appendChild(p);
        return svg;
    }

    /* Ein fertiger Zahnrad-Knopf (→ Einstellungen). `klasse` z. B. "up-bl-kopf-knopf" für den Blatt-Kopf. */
    function zahnradKnopf(beiKlick, name, klasse) {
        const k = el("button", "up-es-zahnrad" + (klasse ? " " + klasse : ""));
        k.type = "button";
        k.setAttribute("aria-label", name || "Einstellungen");
        k.title = name || "Einstellungen";
        k.appendChild(zeichen("zahnrad"));
        if (typeof beiKlick === "function") {
            k.addEventListener("click", beiKlick);
        }
        return k;
    }

    function lampeArt(zustand) {
        if (zustand === true) {
            return "gespeichert";
        }
        if (zustand === false) {
            return "wartet";
        }
        const z = LAMPE_ALIAS[zustand] || zustand;
        return LAMPE[z] ? z : "offline";
    }

    /* Die Status-Lampe: Punkt + kurzes Wort. `texte` wahlfrei { gespeichert, wartet, offline }. */
    function lampe(zustand, texte) {
        const t = Object.assign({}, LAMPE, texte || {});
        const l = el("span", "up-es-wert up-es-lampe");
        l.setAttribute("role", "status");
        const punkt = el("i");
        punkt.setAttribute("aria-hidden", "true");
        const wort = el("span");
        l.appendChild(punkt);
        l.appendChild(wort);
        l.setzen = function (neu) {
            const art = lampeArt(neu);
            l.dataset.zustand = art;
            wort.textContent = t[art];
            l.setAttribute("aria-label", "Speicher: " + t[art]);
            return art;
        };
        l.setzen(zustand);
        return l;
    }

    /* Die Zeile „Speicher“ mit Lampe (für den Abschnitt, in dem die App den Speicher zeigt). */
    function speicherZeile(zustand, extra) {
        const l = lampe(zustand, extra && extra.texte);
        return Object.assign({ zeichen: "datenbank", titel: "Speicher", rechts: l, lampe: l }, extra || {},
            { rechts: l, lampe: l });
    }

    function pfeil() {
        const w = el("span", "up-es-wert up-es-pfeil");
        w.appendChild(zeichen("rechts", "up-es-zeichen up-es-klein"));
        return w;
    }

    function wert(text) {
        return el("span", "up-es-wert", text);
    }

    /* Ein Schalter an/aus (role=switch). `beiWechsel(neu)` nach jedem Tipp. */
    function schalter(an, beiWechsel, name) {
        const k = el("button", "up-es-schalter");
        k.type = "button";
        k.setAttribute("role", "switch");
        k.setAttribute("aria-checked", an ? "true" : "false");
        k.setAttribute("aria-label", name || "Umschalten");
        let zustand = !!an;
        k.addEventListener("click", (e) => {
            if (e && e.stopPropagation) {
                e.stopPropagation();
            }
            zustand = !zustand;
            const neu = zustand;
            k.setAttribute("aria-checked", neu ? "true" : "false");
            if (typeof beiWechsel === "function") {
                beiWechsel(neu);
            }
        });
        return k;
    }

    /* Mehrere Wahlen in einer Pille (radiogroup). `beiWahl(wert)` nur bei einer ANDEREN Wahl. */
    function segment(optionen, aktuell, beiWahl, name) {
        const gruppe = el("div", "up-es-segment");
        gruppe.setAttribute("role", "radiogroup");
        gruppe.setAttribute("aria-label", name || "");
        for (const option of (optionen || [])) {
            const gewaehlt = option.wert === aktuell;
            const knopf = el("button", "up-es-wahl" + (gewaehlt ? " up-es-aktiv" : ""), option.text);
            knopf.type = "button";
            knopf.setAttribute("role", "radio");
            knopf.setAttribute("aria-checked", gewaehlt ? "true" : "false");
            knopf.addEventListener("click", (e) => {
                if (e && e.stopPropagation) {
                    e.stopPropagation();
                }
                if (option.wert !== aktuell && typeof beiWahl === "function") {
                    beiWahl(option.wert);
                }
            });
            gruppe.appendChild(knopf);
        }
        return gruppe;
    }

    function zeileBauen(z) {
        const knopf = typeof z.beiKlick === "function";
        const zeile = el(knopf ? "button" : "div", "up-es-zeile" + (z.gefahr ? " up-es-gefahr" : "")
            + (z.klasse ? " " + z.klasse : ""));
        if (knopf) {
            zeile.type = "button";
            zeile.setAttribute("aria-label", z.titel || "");
            zeile.addEventListener("click", z.beiKlick);
        }
        if (z.zeichen && !z.gefahr) {
            zeile.appendChild(zeichen(z.zeichen));
        }
        const text = el("span", "up-es-text");
        const titel = el("b", "", z.titel || "");
        if (z.tag) {
            titel.appendChild(el("span", "up-es-tag", z.tag));
        }
        if (z.marke) {
            titel.appendChild(el("span", "up-es-marke", z.marke));
        }
        text.appendChild(titel);
        if (z.unter && kurzGenug(z.unter, "unter")) {
            text.appendChild(el("small", "", z.unter));
        }
        zeile.appendChild(text);
        if (z.rechts === "pfeil") {
            zeile.appendChild(pfeil());
        } else if (typeof z.rechts === "string" && z.rechts !== "") {
            zeile.appendChild(wert(z.rechts));
        } else if (z.rechts && typeof z.rechts === "object") {
            zeile.appendChild(z.rechts);
        }
        return zeile;
    }

    function abschnittBauen(a, optionen) {
        const s = el("section", "up-es-abschnitt up-es-" + a.art);
        s.dataset.art = a.art;
        const titel = (typeof a.titel === "string") ? a.titel : (a.art === "spiel" ? null : (TITEL[a.art] || ""));
        if (titel === null) {
            const h = el("h3", "", "Nur in ");
            h.appendChild(el("span", "up-es-marke", (optionen && optionen.spiel) || ""));
            s.appendChild(h);
        } else if (titel !== "") {
            s.appendChild(el("h3", "", titel));
        }
        const zeilen = (a.zeilen || []).filter((z) => !!z);
        if (zeilen.length > 0) {
            const gruppe = el("div", "up-es-gruppe");
            for (const z of zeilen) {
                gruppe.appendChild(zeileBauen(z));
            }
            s.appendChild(gruppe);
        }
        if (a.inhalt) {
            s.appendChild(a.inhalt);
        }
        if (a.hinweis && kurzGenug(a.hinweis, "hinweis")) {
            s.appendChild(el("p", "up-es-hinweis", a.hinweis));
        }
        return s;
    }

    /* Ordnet die Abschnitte nach der festen Reihenfolge (unbekannte Arten ans Ende, in ihrer Reihenfolge). */
    function ordnen(art, abschnitte) {
        const reihe = REIHENFOLGE[art] || [];
        const liste = (abschnitte || []).filter((a) => a && typeof a.art === "string");
        return liste.slice().sort((a, b) => {
            const ia = reihe.indexOf(a.art);
            const ib = reihe.indexOf(b.art);
            return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || liste.indexOf(a) - liste.indexOf(b);
        });
    }

    function bauen(ort, art, abschnitte, optionen) {
        ort.classList.add("up-es", "up-es-" + art);
        const geordnet = ordnen(art, abschnitte).filter((a) => (a.zeilen || []).some((z) => !!z) || a.inhalt);
        for (const a of geordnet) {
            ort.appendChild(abschnittBauen(a, optionen));
        }
        return geordnet.map((a) => a.art);
    }

    const UPCREW_EINSTELLUNGEN = { bauen: bauen, ordnen: ordnen, zeile: zeileBauen, schalter: schalter,
        segment: segment, pfeil: pfeil, wert: wert, zeichen: zeichen, zahnradKnopf: zahnradKnopf, lampe: lampe,
        speicherZeile: speicherZeile, lampeArt: lampeArt, REIHENFOLGE: REIHENFOLGE, TITEL: TITEL, ZEICHEN: ZEICHEN,
        LAMPE: LAMPE, KURZ: KURZ };
    if (typeof window !== "undefined") {
        window.UPCREW_EINSTELLUNGEN = UPCREW_EINSTELLUNGEN;
    }
    if (typeof globalThis !== "undefined") {
        globalThis.UPCREW_EINSTELLUNGEN = UPCREW_EINSTELLUNGEN;
    }
    if (typeof module !== "undefined" && module.exports) {
        module.exports = UPCREW_EINSTELLUNGEN;
    }
})();
