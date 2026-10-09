/*
 * produktsuche.js — Strichcode → Name, Marke, Vorschaubild aus der Strichcode-Datenbank
 * (Open Food Facts, Nutzer-Vorgabe 08./09.10.2026). Die EINZIGE Stelle mit dieser Adresse;
 * neben js\speicher.js die einzige Datei, die ins Netz darf (ein Test wacht darüber).
 *
 * Nur die Nummer verlässt das Gerät. Gespeichert wird am Produkt nur die Bild-ADRESSE, nie
 * das Bild. Jeder Aufruf hat ein Zeitlimit (eiserne Regel), Fehler ohne Netz tragen
 * `name === "TimeoutError"` oder sind der TypeError von fetch — beides erkennt
 * `UPCREW_OFFLINE.istNetzFehler`.
 *
 *     PRODUKTSUCHE.eanPruefen(text)        → "4012345678901" oder "" (8, 12, 13 oder 14 Ziffern)
 *     PRODUKTSUCHE.zuordnen(antwort)       → { gefunden, name, marke, bild } (rein, für Tests)
 *     await PRODUKTSUCHE.suchen(ean)       → { ok: true, gefunden, name, marke, bild, ean }
 *                                             oder { ok: false, netz: true|false, text }
 *     PRODUKTSUCHE.roh                     die letzte rohe Antwort (nur für die Werkstatt)
 *
 * Keine Sitzung ruft diese Adresse per Befehl auf; ob der Dienst antwortet, prüft der Nutzer
 * über die Werkstatt-Seite im Browser (Nutzer-Vorgabe: kein Netz per Befehl).
 */

const PRODUKTSUCHE = {

    BASIS: "https://world.openfoodfacts.org/api/v2/product/",
    FELDER: "product_name,product_name_de,brands,image_front_small_url,image_small_url",
    ZEITLIMIT_MS: 8000,

    /* Attrappe für Tests; im Browser bleibt es bei fetch. */
    netz: null,
    roh: null,

    eanPruefen(text) {
        const ziffern = String(text || "").replace(/[^0-9]/g, "");
        return [8, 12, 13, 14].indexOf(ziffern.length) !== -1 ? ziffern : "";
    },

    _text(wert, max) {
        const t = (typeof wert === "string") ? wert.trim() : "";
        return t.slice(0, max || 40);
    },

    /* Aus der Antwort der Datenbank die drei Felder — oder „nicht gefunden". */
    zuordnen(antwort) {
        const a = (antwort && typeof antwort === "object") ? antwort : {};
        const p = (a.product && typeof a.product === "object") ? a.product : null;
        if (!p || Number(a.status) === 0 || a.status === "failure") {
            return { gefunden: false, name: "", marke: "", bild: "" };
        }
        const name = PRODUKTSUCHE._text(p.product_name_de) || PRODUKTSUCHE._text(p.product_name);
        const marke = PRODUKTSUCHE._text(p.brands).split(",")[0].trim();
        let bild = PRODUKTSUCHE._text(p.image_front_small_url, 400) || PRODUKTSUCHE._text(p.image_small_url, 400);
        if (!/^https:\/\//.test(bild)) {
            bild = "";
        }
        return { gefunden: !!name, name: name, marke: marke, bild: bild };
    },

    async suchen(eingabe) {
        const ean = PRODUKTSUCHE.eanPruefen(eingabe);
        if (!ean) {
            return { ok: false, netz: false, text: "Nummer ungültig" };
        }
        const adresse = PRODUKTSUCHE.BASIS + encodeURIComponent(ean) + ".json?fields=" + encodeURIComponent(PRODUKTSUCHE.FELDER);
        const holen = PRODUKTSUCHE.netz || ((a, e) => fetch(a, e));
        const einstellungen = { cache: "no-store", headers: { "Accept": "application/json" } };
        let abbruch = null;
        let uhr = null;
        if (typeof AbortController !== "undefined") {
            abbruch = new AbortController();
            einstellungen.signal = abbruch.signal;
            uhr = setTimeout(() => abbruch.abort(), PRODUKTSUCHE.ZEITLIMIT_MS);
        }
        try {
            const antwort = await holen(adresse, einstellungen);
            if (antwort.status === 404) {
                PRODUKTSUCHE.roh = null;
                return { ok: true, gefunden: false, name: "", marke: "", bild: "", ean: ean };
            }
            if (!antwort.ok) {
                return { ok: false, netz: false, text: "Dienst antwortet nicht (HTTP " + antwort.status + ")" };
            }
            const daten = await antwort.json();
            PRODUKTSUCHE.roh = daten;
            return Object.assign({ ok: true, ean: ean }, PRODUKTSUCHE.zuordnen(daten));
        } catch (fehler) {
            if (fehler && fehler.name === "AbortError") {
                const zuLange = new Error("Die Suche hat zu lange gedauert");
                zuLange.name = "TimeoutError";
                throw zuLange;
            }
            throw fehler;
        } finally {
            if (uhr) {
                clearTimeout(uhr);
            }
        }
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = PRODUKTSUCHE;
}
