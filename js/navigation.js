/*
 * navigation.js — Seite oder Blatt: die Tab-Leiste unten, das Seiten-Band (Wischen) und
 * die Blätter über der Seite. Drei Tabs: Start, Verlauf, Einstellungen.
 *
 * Was in der Leiste steht, ist eine SEITE im Band (nie ein Blatt). Blätter gibt es nur für
 * Untermenüs ohne Leisten-Knopf (Anpassen, später Produkt anlegen, Rücknahme) — dahinter
 * bleibt die Seite sichtbar (Nutzer 09.10.2026, TODO: „nur Popups, wenn es Untermenüs gibt,
 * wo man den Hintergrund sieht"). Ein Tipp in der Leiste schließt alle Blätter.
 *
 * Bausteine: upcrew-leiste.js (wandernde Kapsel, beobachtet aria-current selbst),
 * upcrew-wischen.js (das Band; Vertrag im Kopf der Datei), upcrew-blatt.js (Blätter,
 * Zurück-Taste über den Browser-Verlauf).
 *
 * Seiten werden erst gebaut, wenn sie gebraucht werden (`kommt` des Bandes oder der
 * Wechsel). `veralten(id)` sorgt dafür, dass eine Seite beim nächsten Zeigen neu gezeichnet
 * wird — Auffrischen nur bei Veraltung, nie auf Vorrat.
 */

const NAVIGATION = {

    /* Zeichen im 24er-Raster wie in zustand.js; "zahnrad" liefert der Einstellungen-Baustein. */
    TABS: [
        { id: "start", name: "Start", zeichen: "tasse" },
        { id: "verlauf", name: "Verlauf", zeichen: "liste" },
        { id: "einstellungen", name: "Einstellungen", zeichen: "zahnrad" }
    ],

    aktiv: "start",
    leiste: null,
    bandEl: null,
    band: null,
    seiten: {},
    gebaut: {},
    bildschirme: {},
    zeigenErlaubt: () => true,

    /* Einmal beim Start. `bildschirme` = { start: START, verlauf: VERLAUF, einstellungen: EINSTELLUNGEN },
       jeder mit `zeichnen(ort)`. */
    einrichten(optionen) {
        const o = optionen || {};
        NAVIGATION.leiste = o.leiste;
        NAVIGATION.bandEl = o.band;
        NAVIGATION.bildschirme = o.bildschirme || {};
        if (typeof o.erlaubt === "function") {
            NAVIGATION.zeigenErlaubt = o.erlaubt;
        }
        for (const tab of NAVIGATION.TABS) {
            NAVIGATION.seiten[tab.id] = o.band.querySelector('[data-up-seite="' + tab.id + '"]');
        }
        NAVIGATION._leisteBauen();
        if (typeof UPCREW_LEISTE !== "undefined") {
            UPCREW_LEISTE.an(NAVIGATION.leiste);
        }
        if (typeof UPCREW_BLATT !== "undefined") {
            UPCREW_BLATT.einrichten({ ebenen: o.ebenen, haupt: o.band, verlauf: true, horchen: true });
        }
        if (typeof UPCREW_WISCHEN !== "undefined") {
            NAVIGATION.band = UPCREW_WISCHEN.an(o.band, {
                tabs: () => NAVIGATION.TABS.map((t) => t.id),
                aktiv: () => NAVIGATION.aktiv,
                wechseln: (id) => NAVIGATION.wechseln(id),
                erlaubt: () => NAVIGATION.zeigenErlaubt(),
                kommt: (id) => NAVIGATION.bauen(id),
                frueh: true,
                oben: true
            });
        }
        NAVIGATION.wechseln(NAVIGATION.aktiv);
    },

    _leisteBauen() {
        const nav = NAVIGATION.leiste;
        nav.textContent = "";
        for (const tab of NAVIGATION.TABS) {
            const knopf = document.createElement("button");
            knopf.type = "button";
            knopf.className = "up-tab";
            knopf.dataset.tab = tab.id;
            knopf.setAttribute("aria-label", tab.name);
            if (tab.zeichen === "zahnrad" && typeof UPCREW_EINSTELLUNGEN !== "undefined") {
                knopf.appendChild(UPCREW_EINSTELLUNGEN.zeichen("zahnrad", ""));
            } else {
                knopf.appendChild(ZUSTAND.zeichen(tab.zeichen, ""));
            }
            const wort = document.createElement("span");
            wort.textContent = tab.name;
            knopf.appendChild(wort);
            knopf.addEventListener("click", () => NAVIGATION.wechseln(tab.id));
            nav.appendChild(knopf);
        }
    },

    /* Der eine Weg, einen Tab zu zeigen — vom Tipp auf die Leiste wie vom Band. */
    wechseln(id) {
        if (!NAVIGATION.seiten[id]) {
            return;
        }
        NAVIGATION.aktiv = id;
        for (const knopf of NAVIGATION.leiste.querySelectorAll(".up-tab")) {
            if (knopf.dataset.tab === id) {
                knopf.setAttribute("aria-current", "page");
            } else {
                knopf.removeAttribute("aria-current");
            }
        }
        if (typeof UPCREW_BLATT !== "undefined") {
            UPCREW_BLATT.alleSchliessen();
        }
        NAVIGATION.bauen(id);
        if (NAVIGATION.band) {
            NAVIGATION.band.zu(id);
        }
    },

    /* Eine Seite zeichnen, wenn sie noch nicht steht oder veraltet ist. */
    bauen(id) {
        const ort = NAVIGATION.seiten[id];
        const bildschirm = NAVIGATION.bildschirme[id];
        if (!ort || !bildschirm || NAVIGATION.gebaut[id]) {
            return;
        }
        NAVIGATION.gebaut[id] = true;
        bildschirm.zeichnen(ort);
    },

    /* Beim nächsten Zeigen neu zeichnen; ist die Seite gerade offen, sofort. */
    veralten(id) {
        NAVIGATION.gebaut[id] = false;
        if (NAVIGATION.aktiv === id) {
            NAVIGATION.bauen(id);
        }
    },

    alleVeralten() {
        for (const tab of NAVIGATION.TABS) {
            NAVIGATION.veralten(tab.id);
        }
    },

    /* Nach dem Zeigen oder Verbergen der Anmeldung: das Band neu messen. */
    auffrischen() {
        if (NAVIGATION.band) {
            NAVIGATION.band.auffrischen();
        }
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = NAVIGATION;
}
