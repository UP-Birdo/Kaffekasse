/*
 * dialog.js — Frage, Hinweis, Eingabe und Zwei-Schritt-Bestätigung als eigene Karte.
 *
 * Kein confirm(), alert(), prompt() in dieser App (Haus-Regel). Jede Karte liegt über
 * allem, trägt aria-modal="true" (dadurch sperrt das Seiten-Band des Wischen-Bausteins
 * von selbst) und schließt mit Escape oder einem Tipp auf den Grund wie „Nein".
 *
 *     DIALOG.frage({ titel, text, ja, nein, gefahr })      → Promise<true|false>
 *     DIALOG.hinweis({ titel, text, ok })                  → Promise<void>
 *     DIALOG.eingabe({ titel, text, wert, platzhalter, ok, art, maxLaenge })
 *                                                          → Promise<string|null>
 *     DIALOG.zweiSchritt({ titel, text, erst, dann, gefahr })
 *                                                          → Promise<true|false>
 *         Zwei Tipps hintereinander (erst „Zurücknehmen", dann „Wirklich") — für
 *         Dinge, die man nicht aus Versehen tun soll, ohne eine zweite Karte.
 *     DIALOG.knopf(text, art, beiKlick)                    → <button> der Knopf-Familie
 *         art: "haupt" (die EINE Hauptaktion), "gefahr" (Zerstörendes), "still" (alles Übrige)
 *
 * Texte: kurz, keine ganzen Sätze (UPCrew-Standard). Der Aufrufer liefert sie.
 */

const DIALOG = {

    /* Die Knopf-Familie des Studios (upcrew-knoepfe.css) mit den Haus-Klassen davor. */
    KLASSEN: {
        haupt: "knopf-haupt up-kn up-haupt",
        gefahr: "knopf-gefahr up-kn up-gefahr",
        still: "knopf-still up-kn up-zweit"
    },

    knopf(text, art, beiKlick) {
        const k = document.createElement("button");
        k.type = "button";
        k.className = DIALOG.KLASSEN[art] || DIALOG.KLASSEN.still;
        k.textContent = text;
        if (typeof beiKlick === "function") {
            k.addEventListener("click", beiKlick);
        }
        return k;
    },

    frage(optionen) {
        const o = optionen || {};
        return new Promise((fertig) => {
            const karte = DIALOG._oeffnen(o.titel, o.text);
            const nein = DIALOG.knopf(o.nein || "Nein", "still", () => karte.schliessen(false));
            const ja = DIALOG.knopf(o.ja || "Ja", o.gefahr ? "gefahr" : "haupt", () => karte.schliessen(true));
            karte.knoepfe(nein, ja);
            karte.beiEnde = fertig;
            ja.focus();
        });
    },

    hinweis(optionen) {
        const o = optionen || {};
        return new Promise((fertig) => {
            const karte = DIALOG._oeffnen(o.titel, o.text);
            const ok = DIALOG.knopf(o.ok || "Ok", "haupt", () => karte.schliessen(true));
            karte.knoepfe(ok);
            karte.beiEnde = () => fertig();
            ok.focus();
        });
    },

    eingabe(optionen) {
        const o = optionen || {};
        return new Promise((fertig) => {
            const karte = DIALOG._oeffnen(o.titel, o.text);
            const feld = document.createElement("input");
            feld.type = o.art || "text";
            feld.className = "dlg-feld";
            feld.value = o.wert || "";
            feld.placeholder = o.platzhalter || "";
            feld.setAttribute("aria-label", o.titel || "Eingabe");
            if (o.maxLaenge) {
                feld.maxLength = o.maxLaenge;
            }
            karte.inhalt.appendChild(feld);
            const abbrechen = DIALOG.knopf(o.nein || "Abbrechen", "still", () => karte.schliessen(null));
            const ok = DIALOG.knopf(o.ok || "Ok", "haupt", () => karte.schliessen(feld.value.trim()));
            feld.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    karte.schliessen(feld.value.trim());
                }
            });
            karte.knoepfe(abbrechen, ok);
            karte.beiEnde = fertig;
            karte.abbruchWert = null;
            feld.focus();
        });
    },

    zweiSchritt(optionen) {
        const o = optionen || {};
        return new Promise((fertig) => {
            const karte = DIALOG._oeffnen(o.titel, o.text);
            const nein = DIALOG.knopf(o.nein || "Nein", "still", () => karte.schliessen(false));
            let scharf = false;
            const tun = DIALOG.knopf(o.erst || "Weiter", o.gefahr ? "gefahr" : "haupt", () => {
                if (!scharf) {
                    scharf = true;
                    tun.textContent = o.dann || "Wirklich";
                    tun.classList.add("dlg-scharf");
                    return;
                }
                karte.schliessen(true);
            });
            karte.knoepfe(nein, tun);
            karte.beiEnde = fertig;
            tun.focus();
        });
    },

    /* ---------------------------------------------------------------- *
     * Innereien
     * ---------------------------------------------------------------- */

    _offen: null,

    _oeffnen(titel, text) {
        if (DIALOG._offen) {
            DIALOG._offen.schliessen(DIALOG._offen.abbruchWert);
        }
        const grund = document.createElement("div");
        grund.className = "dlg-grund";
        const karte = document.createElement("div");
        karte.className = "dlg-karte";
        karte.setAttribute("role", "dialog");
        karte.setAttribute("aria-modal", "true");
        karte.tabIndex = -1;
        if (titel) {
            const h = document.createElement("h2");
            h.className = "dlg-titel";
            h.textContent = titel;
            karte.appendChild(h);
            karte.setAttribute("aria-label", titel);
        }
        const inhalt = document.createElement("div");
        inhalt.className = "dlg-inhalt";
        if (text) {
            const p = document.createElement("p");
            p.textContent = text;
            inhalt.appendChild(p);
        }
        karte.appendChild(inhalt);
        const leiste = document.createElement("div");
        leiste.className = "dlg-knoepfe";
        karte.appendChild(leiste);
        grund.appendChild(karte);

        const vorher = document.activeElement;
        const griff = {
            el: karte,
            inhalt: inhalt,
            beiEnde: null,
            abbruchWert: false,
            knoepfe(...liste) {
                for (const k of liste) {
                    leiste.appendChild(k);
                }
            },
            schliessen(wert) {
                if (DIALOG._offen !== griff) {
                    return;
                }
                DIALOG._offen = null;
                document.removeEventListener("keydown", beiTaste);
                grund.remove();
                document.documentElement.classList.remove("dlg-offen");
                if (vorher && typeof vorher.focus === "function" && document.contains(vorher)) {
                    vorher.focus();
                }
                if (typeof griff.beiEnde === "function") {
                    griff.beiEnde(wert);
                }
            }
        };
        const beiTaste = (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                griff.schliessen(griff.abbruchWert);
            }
        };
        grund.addEventListener("click", (e) => {
            if (e.target === grund) {
                griff.schliessen(griff.abbruchWert);
            }
        });
        document.addEventListener("keydown", beiTaste);
        document.documentElement.classList.add("dlg-offen");
        document.body.appendChild(grund);
        DIALOG._offen = griff;
        return griff;
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = DIALOG;
}
