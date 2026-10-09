/*
 * zustand.js — die drei Zustände Laden, Leer und Fehler als EIN Baustein
 * (UPCrew-Standard, Abschnitt 3). Keine Stelle der App erfindet dafür eigenen Text.
 *
 *     ZUSTAND.laden({ zeilen, nochmal })           → Platzhalter in der Form des Inhalts;
 *                                                     nach LADEN_GRENZE_MS wird daraus der Fehler
 *     ZUSTAND.leer({ zeichen, text, aktion })      → Zeichen, höchstens drei Wörter, ein Knopf
 *                                                     (aktion = { text, bei })
 *     ZUSTAND.fehler({ text, nochmal, technik })   → Zeichen, „Kein Netz", Knopf „Nochmal"
 *     ZUSTAND.zeichen(name)                        → SVG aus dem einen Zeichensatz der App
 *
 * Jeder Aufruf liefert ein Element; der Aufrufer hängt es ein und ersetzt es, sobald
 * Daten da sind. Farben nur aus der Farbwelt (CSS), Texte über textContent.
 */

const ZUSTAND = {

    LADEN_GRENZE_MS: 10000,

    /* Zeichen im 24er-Raster, Strich 2, runde Enden — derselbe Satz wie die Leiste. */
    ZEICHEN: {
        tasse: "M5 8 H16 V15 A4 4 0 0 1 12 19 H9 A4 4 0 0 1 5 15 Z M16 10 H18 A2.5 2.5 0 0 1 18 15 H16",
        liste: "M8 6 H20 M8 12 H20 M8 18 H20 M4 6 V6.1 M4 12 V12.1 M4 18 V18.1",
        netz: "M7 18 H16.5 A4 4 0 0 0 17 10 A5.5 5.5 0 0 0 6.6 9.2 A4.4 4.4 0 0 0 7 18 Z M4 4 L20 20",
        plus: "M12 5 V19 M5 12 H19",
        haken: "M5 12.5 L10 17 L19 7"
    },

    zeichen(name, klasse) {
        const RAUM = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(RAUM, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("class", klasse || "zs-zeichen");
        const p = document.createElementNS(RAUM, "path");
        p.setAttribute("d", ZUSTAND.ZEICHEN[name] || ZUSTAND.ZEICHEN.liste);
        svg.appendChild(p);
        return svg;
    },

    laden(optionen) {
        const o = optionen || {};
        const el = document.createElement("div");
        el.className = "zs zs-laden";
        el.setAttribute("role", "status");
        el.setAttribute("aria-label", "Laden");
        el.setAttribute("aria-busy", "true");
        const anzahl = Math.max(1, Math.min(8, Number(o.zeilen) || 3));
        for (let i = 0; i < anzahl; i++) {
            const balken = document.createElement("div");
            balken.className = "zs-balken";
            el.appendChild(balken);
        }
        /* Ewiges Pulsieren wäre eine Falschaussage: nach der Grenze der Fehler. */
        const uhr = setTimeout(() => {
            if (!el.isConnected) {
                return;
            }
            const fehler = ZUSTAND.fehler({ text: "Dauert zu lange", nochmal: o.nochmal });
            el.replaceWith(fehler);
        }, ZUSTAND.LADEN_GRENZE_MS);
        el.fertig = () => clearTimeout(uhr);
        return el;
    },

    leer(optionen) {
        const o = optionen || {};
        const el = document.createElement("div");
        el.className = "zs zs-leer";
        el.appendChild(ZUSTAND.zeichen(o.zeichen || "liste"));
        const text = document.createElement("p");
        text.textContent = o.text || "Noch nichts";
        el.appendChild(text);
        if (o.aktion && typeof o.aktion.bei === "function") {
            el.appendChild(DIALOG.knopf(o.aktion.text || "Weiter", "haupt", o.aktion.bei));
        }
        return el;
    },

    fehler(optionen) {
        const o = optionen || {};
        const el = document.createElement("div");
        el.className = "zs zs-fehler";
        el.setAttribute("role", "alert");
        el.appendChild(ZUSTAND.zeichen("netz"));
        const text = document.createElement("p");
        text.textContent = o.text || "Kein Netz";
        el.appendChild(text);
        if (typeof o.nochmal === "function") {
            el.appendChild(DIALOG.knopf("Nochmal", "haupt", o.nochmal));
        }
        if (o.technik) {
            /* Die technische Meldung steht nur im Titel — für die Fehlersuche, nicht fürs Auge. */
            el.title = String(o.technik);
        }
        return el;
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = ZUSTAND;
}
