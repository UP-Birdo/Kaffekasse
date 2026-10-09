/*
 * bildschirm-anmeldung.js — Anmelden mit dem UPCrew-Konto, Konto anlegen, oder als Gast
 * weiter. Eine Schicht über der App (kein Blatt: dahinter gibt es noch nichts zu sehen).
 *
 * Alles, was mit Passwort, Nummer und Datenbank zu tun hat, macht der Studio-Baustein
 * js\konto.js (`KONTO`): Prüfen der Eingaben, Firebase Authentication, Nummer würfeln,
 * Eintrag schreiben. Dieser Bildschirm zeigt nur Felder und Meldungen — jede Absage des
 * Bausteins trägt `feld` („name", „passwort", „allgemein"), die Meldung steht dann dort.
 *
 * Texte nennen das Studio („UPCrew-Konto"), nie ein Spiel. Keine ganzen Sätze, außer die
 * Meldung kommt vom Baustein (dort sind sie in allen Apps gleich).
 */

const ANMELDUNG = {

    ort: null,
    modus: "anmelden",       /* "anmelden" | "neu" */
    felder: {},
    beiFertig: null,

    zeigen(ort, beiFertig) {
        ANMELDUNG.ort = ort;
        ANMELDUNG.beiFertig = beiFertig;
        ANMELDUNG.bauen();
        ort.hidden = false;
        document.documentElement.classList.add("anmeldung-offen");
        const erstes = ort.querySelector("input");
        if (erstes) {
            erstes.focus();
        }
    },

    verbergen() {
        if (ANMELDUNG.ort) {
            ANMELDUNG.ort.hidden = true;
            ANMELDUNG.ort.textContent = "";
        }
        document.documentElement.classList.remove("anmeldung-offen");
    },

    offen() {
        return !!(ANMELDUNG.ort && !ANMELDUNG.ort.hidden);
    },

    bauen() {
        const ort = ANMELDUNG.ort;
        ort.textContent = "";
        ort.removeAttribute("aria-busy");
        const innen = document.createElement("div");
        innen.className = "anmeldung-innen";

        const titel = document.createElement("h1");
        titel.className = "anmeldung-titel";
        titel.textContent = KONFIG.APP_NAME;
        innen.appendChild(titel);
        const unter = document.createElement("p");
        unter.className = "anmeldung-unter";
        unter.textContent = "UPCrew-Konto";
        innen.appendChild(unter);

        innen.appendChild(ANMELDUNG._wahl());

        const neu = ANMELDUNG.modus === "neu";
        const name = ANMELDUNG._feld("name", "Name", neu ? "Name" : "Name#1234", "text",
            neu ? KONTO.NAME_MIN + "–" + KONTO.NAME_MAX + " Zeichen" : "");
        const passwort = ANMELDUNG._feld("passwort", "Passwort", "", "password",
            neu ? ANMELDUNG._passwortRegel() : "");
        innen.appendChild(name.zeile);
        innen.appendChild(passwort.zeile);
        name.feld.autocomplete = "username";
        passwort.feld.autocomplete = neu ? "new-password" : "current-password";

        const allgemein = document.createElement("div");
        allgemein.className = "feld-fehler";
        allgemein.setAttribute("role", "alert");
        innen.appendChild(allgemein);

        const auswahl = document.createElement("div");
        auswahl.className = "anmeldung-auswahl";
        innen.appendChild(auswahl);

        const knoepfe = document.createElement("div");
        knoepfe.className = "anmeldung-knoepfe";
        const haupt = DIALOG.knopf(neu ? "Konto anlegen" : "Anmelden", "haupt",
            () => (neu ? ANMELDUNG.anlegen() : ANMELDUNG.anmelden()));
        const gast = DIALOG.knopf("Gast", "still", () => ANMELDUNG.gast());
        knoepfe.appendChild(haupt);
        knoepfe.appendChild(gast);
        innen.appendChild(knoepfe);

        for (const f of [name.feld, passwort.feld]) {
            f.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    haupt.click();
                }
            });
        }

        ANMELDUNG.felder = { name: name, passwort: passwort, allgemein: allgemein, auswahl: auswahl };
        ort.appendChild(innen);
    },

    _wahl() {
        const wahl = document.createElement("div");
        wahl.className = "anmeldung-wahl";
        wahl.setAttribute("role", "radiogroup");
        wahl.setAttribute("aria-label", "Anmelden oder neues Konto");
        for (const [wert, text] of [["anmelden", "Anmelden"], ["neu", "Neu"]]) {
            const k = document.createElement("button");
            k.type = "button";
            k.setAttribute("role", "radio");
            k.setAttribute("aria-checked", ANMELDUNG.modus === wert ? "true" : "false");
            k.textContent = text;
            k.addEventListener("click", () => {
                if (ANMELDUNG.modus !== wert) {
                    ANMELDUNG.modus = wert;
                    ANMELDUNG.bauen();
                }
            });
            wahl.appendChild(k);
        }
        return wahl;
    },

    _feld(kennung, titel, platzhalter, art, hinweis) {
        const zeile = document.createElement("div");
        zeile.className = "feld-zeile";
        const label = document.createElement("label");
        label.textContent = titel;
        label.htmlFor = "anmeldung-" + kennung;
        const feld = document.createElement("input");
        feld.id = "anmeldung-" + kennung;
        feld.className = "feld";
        feld.type = art;
        feld.placeholder = platzhalter;
        feld.autocapitalize = "off";
        feld.spellcheck = false;
        const fehler = document.createElement("div");
        fehler.className = "feld-fehler";
        zeile.appendChild(label);
        zeile.appendChild(feld);
        if (hinweis) {
            const h = document.createElement("div");
            h.className = "feld-hinweis";
            h.textContent = hinweis;
            zeile.appendChild(h);
        }
        zeile.appendChild(fehler);
        return { zeile: zeile, feld: feld, fehler: fehler };
    },

    /* Die Passwort-Regel des Studios als Stichworte, aus den Zahlen des Bausteins. */
    _passwortRegel() {
        return KONTO.PASSWORT_MIN + "–" + KONTO.PASSWORT_MAX + " Zeichen · groß · klein · Ziffer · Sonderzeichen";
    },

    _meldung(feld, text) {
        const f = ANMELDUNG.felder;
        f.name.fehler.textContent = "";
        f.passwort.fehler.textContent = "";
        f.allgemein.textContent = "";
        const ziel = (feld === "name") ? f.name.fehler : (feld === "passwort") ? f.passwort.fehler : f.allgemein;
        ziel.textContent = text || "";
    },

    _beschaeftigt(ja) {
        if (ja) {
            ANMELDUNG.ort.setAttribute("aria-busy", "true");
        } else {
            ANMELDUNG.ort.removeAttribute("aria-busy");
        }
    },

    /* Die Konten-Liste für den Baustein — ohne Netz eine leere Liste in Form. */
    async _daten() {
        try {
            return await APP.speicher.konten.laden();
        } catch (fehler) {
            if (typeof UPCREW_OFFLINE !== "undefined" && UPCREW_OFFLINE.istNetzFehler(fehler)) {
                UPCREW_OFFLINE.setzen(true);
            }
            return SPIELER.normalisieren(null);
        }
    },

    _fertig() {
        ANMELDUNG.verbergen();
        if (typeof ANMELDUNG.beiFertig === "function") {
            ANMELDUNG.beiFertig();
        }
    },

    async anmelden() {
        const f = ANMELDUNG.felder;
        const eingabe = f.name.feld.value.trim();
        const passwort = f.passwort.feld.value;
        f.auswahl.textContent = "";
        if (!eingabe) {
            ANMELDUNG._meldung("name", "Name fehlt");
            return;
        }
        if (!passwort) {
            ANMELDUNG._meldung("passwort", "Passwort fehlt");
            return;
        }
        ANMELDUNG._beschaeftigt(true);
        try {
            const daten = await ANMELDUNG._daten();
            const ergebnis = await KONTO.anmeldenMitEingabe(daten, eingabe, passwort);
            if (ergebnis.ok) {
                ANMELDUNG._fertig();
                return;
            }
            if (ergebnis.fehler === "auswahl" && Array.isArray(ergebnis.auswahl)) {
                ANMELDUNG._auswahlZeigen(ergebnis.auswahl, passwort);
                return;
            }
            ANMELDUNG._meldung(ergebnis.feld, ergebnis.fehler === "netz" ? "Kein Netz" : ergebnis.text);
        } finally {
            ANMELDUNG._beschaeftigt(false);
        }
    },

    /* „Welches Konto?" — der Name kommt mehrmals vor und das Passwort passt mehrfach. */
    _auswahlZeigen(liste, passwort) {
        const f = ANMELDUNG.felder;
        ANMELDUNG._meldung("name", "Welches Konto?");
        f.auswahl.textContent = "";
        for (const spieler of liste) {
            const k = DIALOG.knopf(SPIELER.anzeige(spieler), "still", async () => {
                ANMELDUNG._beschaeftigt(true);
                try {
                    const ergebnis = await KONTO.anmeldenAuswahl(spieler, passwort);
                    if (ergebnis.ok) {
                        ANMELDUNG._fertig();
                        return;
                    }
                    ANMELDUNG._meldung(ergebnis.feld, ergebnis.text);
                } finally {
                    ANMELDUNG._beschaeftigt(false);
                }
            });
            f.auswahl.appendChild(k);
        }
    },

    async anlegen() {
        const f = ANMELDUNG.felder;
        const name = f.name.feld.value.trim();
        const passwort = f.passwort.feld.value;
        ANMELDUNG._beschaeftigt(true);
        try {
            const daten = await ANMELDUNG._daten();
            const ergebnis = await KONTO.kontoAnlegen(APP.speicher.konten, daten, name, passwort);
            if (ergebnis.ok) {
                ANMELDUNG._fertig();
                return;
            }
            ANMELDUNG._meldung(ergebnis.feld, ergebnis.fehler === "netz" ? "Kein Netz" : ergebnis.text);
        } finally {
            ANMELDUNG._beschaeftigt(false);
        }
    },

    async gast() {
        ANMELDUNG._beschaeftigt(true);
        try {
            const daten = await ANMELDUNG._daten();
            const ergebnis = await KONTO.gastAnlegen(APP.speicher.konten, daten);
            if (ergebnis.ok) {
                ANMELDUNG._fertig();
                return;
            }
            ANMELDUNG._meldung("allgemein", ergebnis.fehler === "netz" ? "Kein Netz" : ergebnis.text);
        } finally {
            ANMELDUNG._beschaeftigt(false);
        }
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = ANMELDUNG;
}
