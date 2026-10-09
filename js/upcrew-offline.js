/*
 * upcrew-offline.js — dezenter Offline-Hinweis (zu css/upcrew-offline.css). Einbau: EINBAU-OFFLINE.md.
 *
 * Ein kleines, ruhiges Zeichen an einem Anker der App (Profilbild im Start-Kopf, rechts im Kopf des Spiel-
 * Bildschirms). Tipp darauf öffnet eine kleine Sprechblase. Kein Streifen, kein Blatt, kein Wackeln, kein Pulsieren,
 * nichts über dem Spielfeld.
 *
 *     const h = UPCREW_OFFLINE.an(anker, { ecke: "unten-links" | "rechts", texte: { … } });
 *                                              // → { el, setzen(offline), hochgeladen(), aus() }
 *     UPCREW_OFFLINE.setzen(true | false);     // Zustand für ALLE Zeichen (setzen(true) bei schon offline: nichts)
 *     UPCREW_OFFLINE.hochgeladen();            // nach BESTÄTIGTEM Hochladen: kurzer Haken, dann aus
 *     const loesen = UPCREW_OFFLINE.lampe(l);  // wahlfrei: Speicher-Lampe der Einstellungen mitführen
 *     UPCREW_OFFLINE.istNetzFehler(fehler);    // true nur bei „kein Netz“ (offline, fetch scheitert, Zeitlimit)
 *     UPCREW_OFFLINE.lauschen();               // wahlfrei: window online/offline → setzen
 *
 * Nicht nerven: erst nach VERZOEGERUNG ms ohne Netz erscheint etwas (kurze Aussetzer bleiben unsichtbar);
 * hochgeladen() zeigt nur dann den Haken, wenn vorher ein Zeichen sichtbar war; nichts reagiert auf Tipps im Spiel.
 *
 * Grafik ist ein Platz: `symbol/offline` und `symbol/hochgeladen` (16x16, UPCREW_PLATZ). Bis eine Datei geliefert
 * ist, steht ein schlichtes Strich-Zeichen. Farben nur aus der Farbwelt, Texte über textContent.
 */
(function () {
    "use strict";

    const RAUM = "http://www.w3.org/2000/svg";
    const VERZOEGERUNG = 1200;      // ms ohne Netz, bevor das Zeichen erscheint
    const HAKEN_DAUER = 1800;       // ms, die der Haken nach dem Hochladen steht
    const BLASE_DAUER = 3000;       // ms, bis die Sprechblase von selbst schliesst
    const ONLINE_FRIST = 8000;      // ms, die das Zeichen nach „wieder online“ auf hochgeladen() wartet
    /* Meldungen, mit denen fetch ohne Netz scheitert (Chromium, Firefox, Safari, ältere Hüllen). */
    const NETZ_TEXTE = /failed to fetch|networkerror|network request failed|load failed|fetch failed|network connection was lost|internet connection appears to be offline/i;
    const ECKEN = ["unten-links", "rechts"];

    const TEXTE = {
        name: "Offline",
        blaseTitel: "Du spielst offline",
        blaseText: "Fortschritt lädt hoch, sobald Netz da ist.",
        hochgeladen: "Hochgeladen"
    };

    /* Platzhalter der zwei Plätze (24er-Raster, Strich). */
    const PFADE = {
        offline: "M7 18 H16.5 A4 4 0 0 0 17 10 A5.5 5.5 0 0 0 6.6 9.2 A4.4 4.4 0 0 0 7 18 Z M4 4 L20 20",
        hochgeladen: "M5 12.5 L10 17 L19 7"
    };

    const griffe = [];
    const lampen = [];
    let offline = false;        // was die App zuletzt gesagt hat
    let sichtbar = false;       // ob das Zeichen gerade steht (nach der Verzögerung)
    let wartet = null;
    let lampeOffline = false;   // ob die Lampen gerade „offline“ zeigen

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

    function strich(pfad) {
        const svg = document.createElementNS(RAUM, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("aria-hidden", "true");
        const p = document.createElementNS(RAUM, "path");
        p.setAttribute("d", pfad);
        svg.appendChild(p);
        return svg;
    }

    function platz(art) {
        const name = "symbol/" + art;
        const P = (typeof window !== "undefined") ? window.UPCREW_PLATZ : null;
        if (P && typeof P.bauen === "function") {
            return P.bauen(name, "16x16", { inhalt: strich(PFADE[art]), klasse: "up-of-platz up-of-platz-" + art });
        }
        const s = el("span", "up-of-platz up-of-platz-" + art);
        s.dataset.platz = name;
        s.appendChild(strich(PFADE[art]));
        return s;
    }

    /* ---------- ein Zeichen an einem Anker ---------- */
    function an(anker, optionen) {
        const o = optionen || {};
        const ecke = ECKEN.indexOf(o.ecke) !== -1 ? o.ecke : "unten-links";
        const t = Object.assign({}, TEXTE, o.texte || {});

        anker.classList.add("up-of-anker");
        const knopf = el("button", "up-of up-of-ecke-" + ecke);
        knopf.type = "button";
        knopf.dataset.zustand = "aus";
        knopf.setAttribute("aria-label", t.name + ": " + t.blaseText);
        knopf.title = t.name;
        knopf.appendChild(platz("offline"));
        knopf.appendChild(platz("hochgeladen"));
        knopf.addEventListener("click", (e) => {
            if (e && e.stopPropagation) {
                e.stopPropagation();
            }
            blase();
        });
        anker.appendChild(knopf);

        /* Für Vorleser: eine stille Zeile, die nur bei Wechseln spricht. */
        const ansage = el("span", "up-of-ansage");
        ansage.setAttribute("role", "status");
        anker.appendChild(ansage);

        let hakenZeit = null;
        let blaseEl = null;
        let blaseZeit = null;

        function blaseZu() {
            clearTimeout(blaseZeit);
            if (blaseEl) {
                blaseEl.remove();
                blaseEl = null;
                document.removeEventListener("pointerdown", daneben, true);
            }
        }

        function daneben(e) {
            if (blaseEl && !blaseEl.contains(e.target) && !knopf.contains(e.target)) {
                blaseZu();
            }
        }

        function blase() {
            if (blaseEl) {
                blaseZu();
                return;
            }
            if (knopf.dataset.zustand !== "offline") {
                return;
            }
            blaseEl = el("span", "up-of-blase up-of-blase-" + ecke);
            blaseEl.appendChild(el("strong", "", t.blaseTitel));
            blaseEl.appendChild(el("span", "", t.blaseText));
            anker.appendChild(blaseEl);
            document.addEventListener("pointerdown", daneben, true);
            blaseZeit = setTimeout(blaseZu, BLASE_DAUER);
        }

        const griff = {
            el: knopf,
            _zeigen() {
                clearTimeout(hakenZeit);
                knopf.dataset.zustand = "offline";
                ansage.textContent = t.name;
            },
            _weg() {
                blaseZu();
                if (knopf.dataset.zustand === "offline") {
                    knopf.dataset.zustand = "aus";
                    ansage.textContent = "";
                }
            },
            _haken() {
                blaseZu();
                knopf.dataset.zustand = "hochgeladen";
                ansage.textContent = t.hochgeladen;
                clearTimeout(hakenZeit);
                hakenZeit = setTimeout(() => {
                    knopf.dataset.zustand = "aus";
                    ansage.textContent = "";
                }, HAKEN_DAUER);
            },
            setzen: (wert) => setzen(wert),
            hochgeladen: () => hochgeladen(),
            aus() {
                blaseZu();
                clearTimeout(hakenZeit);
                knopf.remove();
                ansage.remove();
                anker.classList.remove("up-of-anker");
                const i = griffe.indexOf(griff);
                if (i !== -1) {
                    griffe.splice(i, 1);
                }
            }
        };
        griffe.push(griff);
        if (sichtbar) {
            griff._zeigen();            // neuer Anker während offline: gleich still mit dabei
        }
        return griff;
    }

    /* ---------- ein Zustand für alle Zeichen ---------- */
    function allen(art) {
        for (const g of griffe.slice()) {
            g[art]();
        }
    }

    /* Lampen, deren Element nicht mehr im Dokument hängt, fallen heraus. */
    function lampenAufraeumen() {
        for (let i = lampen.length - 1; i >= 0; i--) {
            if (lampen[i].isConnected === false) {
                lampen.splice(i, 1);
            }
        }
    }

    function lampenSetzen(z) {
        lampeOffline = z === "offline";
        lampenAufraeumen();
        for (const l of lampen) {
            if (l && typeof l.setzen === "function") {
                l.setzen(z);
            }
        }
    }

    function setzen(wert) {
        const neu = wert === true;
        if (neu === offline) {
            return;
        }
        offline = neu;
        clearTimeout(wartet);
        wartet = null;
        if (offline) {
            if (sichtbar) {
                allen("_zeigen");       // war noch sichtbar (wartete auf hochgeladen): einfach stehen lassen
                return;
            }
            wartet = setTimeout(() => {
                wartet = null;
                if (!offline) {
                    return;
                }
                sichtbar = true;
                allen("_zeigen");
                lampenSetzen("offline");
            }, VERZOEGERUNG);
        } else if (sichtbar) {
            /* Wieder Netz: das Zeichen bleibt bis hochgeladen() stehen, höchstens ONLINE_FRIST, dann still aus.
               Die Lampe bleibt: „gespeichert“ meldet nur ein bestätigtes Hochladen. */
            wartet = setTimeout(() => {
                wartet = null;
                if (!offline && sichtbar) {
                    sichtbar = false;
                    allen("_weg");
                }
            }, ONLINE_FRIST);
        }
    }

    /* Nach bestätigtem Hochladen. Ein gelungenes Hochladen beweist Netz: gilt zugleich als setzen(false). */
    function hochgeladen() {
        clearTimeout(wartet);
        wartet = null;
        offline = false;
        if (!sichtbar) {
            if (lampeOffline) {
                lampenSetzen("gespeichert");
            }
            return false;
        }
        sichtbar = false;
        allen("_haken");
        lampenSetzen("gespeichert");
        return true;
    }

    /* Die Speicher-Lampe (UPCREW_EINSTELLUNGEN.lampe / speicherZeile) mitführen; offline zeigt sie selbst grau.
       Gibt eine Löse-Funktion zurück; eine Lampe ausserhalb des Dokuments fällt auch von selbst heraus. */
    function lampe(l) {
        lampenAufraeumen();
        if (!l) {
            return () => {};
        }
        if (lampen.indexOf(l) === -1) {
            lampen.push(l);
            if (lampeOffline && typeof l.setzen === "function") {
                l.setzen("offline");
            }
        }
        return () => {
            const i = lampen.indexOf(l);
            if (i !== -1) {
                lampen.splice(i, 1);
            }
        };
    }

    /* „Kein Netz“ nur, wenn das Gerät offline meldet oder fetch selbst scheitert (Netzfehler, Abbruch durchs
       Zeitlimit). Antworten mit Status, unlesbares JSON und Programmfehler zählen nicht. */
    function istNetzFehler(fehler) {
        if (typeof navigator !== "undefined" && navigator && navigator.onLine === false) {
            return true;
        }
        if (!fehler || typeof fehler !== "object") {
            return false;
        }
        const name = String(fehler.name || "");
        if (name === "AbortError" || name === "TimeoutError") {
            return true;
        }
        return name === "TypeError" && NETZ_TEXTE.test(String(fehler.message || ""));
    }

    let lauscht = false;
    function lauschen() {
        if (lauscht || typeof window === "undefined" || typeof window.addEventListener !== "function") {
            return;
        }
        lauscht = true;
        window.addEventListener("offline", () => setzen(true));
        window.addEventListener("online", () => setzen(false));
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
            setzen(true);
        }
    }

    /* Nur für Probe und Tests: alles zurück. */
    function _zuruecksetzen() {
        clearTimeout(wartet);
        wartet = null;
        offline = false;
        sichtbar = false;
        allen("_weg");
        lampen.length = 0;
        lampeOffline = false;
    }

    const UPCREW_OFFLINE = {
        an: an, setzen: setzen, hochgeladen: hochgeladen, lampe: lampe, lauschen: lauschen,
        istNetzFehler: istNetzFehler,
        offline: () => offline, sichtbar: () => sichtbar, _zuruecksetzen: _zuruecksetzen,
        TEXTE: TEXTE, VERZOEGERUNG: VERZOEGERUNG, HAKEN_DAUER: HAKEN_DAUER, ONLINE_FRIST: ONLINE_FRIST
    };
    if (typeof window !== "undefined") {
        window.UPCREW_OFFLINE = UPCREW_OFFLINE;
    }
    if (typeof globalThis !== "undefined") {
        globalThis.UPCREW_OFFLINE = UPCREW_OFFLINE;
    }
    if (typeof module !== "undefined" && module.exports) {
        module.exports = UPCREW_OFFLINE;
    }
})();
