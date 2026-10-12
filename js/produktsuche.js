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
 *     PRODUKTSUCHE.preiseZuordnen(antwort) → { gefunden, cent, anzahl, datum } (rein, für Tests)
 *     await PRODUKTSUCHE.preisVorschlag(ean) → { ok, gefunden, cent, … } — wirft nie (Open Prices)
 *     PRODUKTSUCHE.naehrwerteZuordnen(antwort) → { gefunden, menge, nutri, nova, werte: [...] } (rein)
 *     await PRODUKTSUCHE.naehrwerte(ean)   → dasselbe mit ok — wirft nie, merkt sich je Nummer (0.9.0)
 *     PRODUKTSUCHE.seite(ean)              Adresse der Produktseite (nur zum Öffnen, kein Abruf)
 *     PRODUKTSUCHE.QUELLE                  der Quellenhinweis (Produkt-Blatt, „Über“)
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

    /* Ein Abruf mit Zeitlimit (eiserne Regel). Liefert die Antwort; Zeitüberschreitung als
       TimeoutError, Netzfehler unverändert. */
    async _holen(adresse) {
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
            return await holen(adresse, einstellungen);
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
    },

    async suchen(eingabe) {
        const ean = PRODUKTSUCHE.eanPruefen(eingabe);
        if (!ean) {
            return { ok: false, netz: false, text: "Nummer ungültig" };
        }
        const adresse = PRODUKTSUCHE.BASIS + encodeURIComponent(ean) + ".json?fields=" + encodeURIComponent(PRODUKTSUCHE.FELDER);
        const antwort = await PRODUKTSUCHE._holen(adresse);
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
    },

    /* ---------------------------------------------------------------- *
     * Preis-Vorschlag aus Open Prices (seit 0.6.0, Nutzer-Entscheidung 09.10.2026)
     *
     * Nur ein VORSCHLAG neben der Eingabe von Hand: die gemeldeten Preise in Euro, die
     * neuesten zehn, davon der Median. In Deutschland oft leer — dann still nichts. Auch hier
     * geht nur die Nummer hinaus.
     * ---------------------------------------------------------------- */

    PREISE_BASIS: "https://prices.openfoodfacts.org/api/v1/prices",
    PREISE_ANZAHL: 10,

    /* Aus der Antwort → { gefunden, cent, anzahl, datum } (rein, für Tests). */
    preiseZuordnen(antwort) {
        const a = (antwort && typeof antwort === "object") ? antwort : {};
        const liste = Array.isArray(a.items) ? a.items : [];
        const passend = liste.filter((p) => p && typeof p === "object"
            && String(p.currency || "").toUpperCase() === "EUR"
            && typeof p.price === "number" && Number.isFinite(p.price) && p.price > 0 && p.price < 1000
            && (p.price_per === undefined || p.price_per === null || p.price_per === "UNIT"))
            .slice(0, PRODUKTSUCHE.PREISE_ANZAHL);
        if (passend.length === 0) {
            return { gefunden: false, cent: null, anzahl: 0, datum: "" };
        }
        const cents = passend.map((p) => Math.round(p.price * 100)).sort((x, y) => x - y);
        const mitte = Math.floor(cents.length / 2);
        const median = cents.length % 2 ? cents[mitte] : Math.round((cents[mitte - 1] + cents[mitte]) / 2);
        const daten = passend.map((p) => String(p.date || "")).filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d)).sort();
        return { gefunden: true, cent: median, anzahl: passend.length, datum: daten.length ? daten[daten.length - 1].slice(0, 10) : "" };
    },

    /* Wirft nie: jeder Fehler (Netz, Zeitlimit, Dienst) heißt „kein Vorschlag“. */
    async preisVorschlag(eingabe) {
        const ean = PRODUKTSUCHE.eanPruefen(eingabe);
        if (!ean) {
            return { ok: false, gefunden: false };
        }
        const adresse = PRODUKTSUCHE.PREISE_BASIS + "?product_code=" + encodeURIComponent(ean)
            + "&currency=EUR&order_by=-date&size=" + PRODUKTSUCHE.PREISE_ANZAHL;
        try {
            const antwort = await PRODUKTSUCHE._holen(adresse);
            if (!antwort || !antwort.ok) {
                return { ok: false, gefunden: false };
            }
            return Object.assign({ ok: true }, PRODUKTSUCHE.preiseZuordnen(await antwort.json()));
        } catch (fehler) {
            return { ok: false, gefunden: false, netz: true };
        }
    },

    /* ---------------------------------------------------------------- *
     * Nährwerte (seit 0.9.0, Nutzer 12.10.2026: „wenn ich auf das Produkt gehe, soll aus Open Food
     * Facts auch kcal und andere Fakten gezogen werden, Fett und so“). Beim Öffnen des Produkt-
     * Blatts frisch geholt, nie in der Kasse gespeichert; je Nummer einmal pro Sitzung. Nur die
     * Nummer geht hinaus, Zeitlimit wie die Suche.
     * ---------------------------------------------------------------- */

    NAEHR_FELDER: "nutriments,nutriscore_grade,nova_group,quantity,product_quantity,product_quantity_unit,image_front_url",
    /* Reihenfolge und Beschriftung wie auf der Packung (je 100 g / 100 ml). */
    NAEHR_LISTE: [
        { schluessel: "energy-kcal_100g", titel: "Energie", einheit: "kcal", stellen: 0 },
        { schluessel: "fat_100g", titel: "Fett", einheit: "g", stellen: 1 },
        { schluessel: "saturated-fat_100g", titel: "davon gesättigt", einheit: "g", stellen: 1 },
        { schluessel: "carbohydrates_100g", titel: "Kohlenhydrate", einheit: "g", stellen: 1 },
        { schluessel: "sugars_100g", titel: "davon Zucker", einheit: "g", stellen: 1 },
        { schluessel: "fiber_100g", titel: "Ballaststoffe", einheit: "g", stellen: 1 },
        { schluessel: "proteins_100g", titel: "Eiweiß", einheit: "g", stellen: 1 },
        { schluessel: "salt_100g", titel: "Salz", einheit: "g", stellen: 2 },
        { schluessel: "caffeine_100g", titel: "Koffein", einheit: "g", stellen: 2 }
    ],
    _naehrMerker: {},

    /* Aus der Antwort → { gefunden, menge, nutri ("A"…"E" | ""), nova (1…4 | 0), packung (g/ml | 0),
       einheit ("g" | "ml"), bildGross, werte: [{ titel, wert, einheit, stellen, text }] }.
       Seit 0.10.0 tragen die Werte die ZAHL je 100 g (`wert`), damit der Schalter „je Packung“
       umrechnen kann (naehrText); `text` ist weiter der Wert je 100 g als Text. */
    naehrwerteZuordnen(antwort) {
        const a = (antwort && typeof antwort === "object") ? antwort : {};
        const p = (a.product && typeof a.product === "object") ? a.product : null;
        const leer = { gefunden: false, menge: "", nutri: "", nova: 0, packung: 0, einheit: "g", bildGross: "", werte: [] };
        if (!p || Number(a.status) === 0 || a.status === "failure") {
            return leer;
        }
        const n = (p.nutriments && typeof p.nutriments === "object") ? p.nutriments : {};
        const werte = [];
        for (const f of PRODUKTSUCHE.NAEHR_LISTE) {
            const z = Number(n[f.schluessel]);
            if (n[f.schluessel] === undefined || n[f.schluessel] === null || n[f.schluessel] === "" || !Number.isFinite(z) || z < 0 || z > 10000) {
                continue;
            }
            const w = { titel: f.titel, wert: z, einheit: f.einheit, stellen: f.stellen };
            w.text = PRODUKTSUCHE.naehrText(w, 1);
            werte.push(w);
        }
        const nutri = String(p.nutriscore_grade || "").trim().toUpperCase();
        const nova = Number(p.nova_group);
        /* Packungsinhalt in g oder ml (Open Food Facts führt ihn schon umgerechnet; ohne Einheit = g). */
        const inhalt = Number(p.product_quantity);
        const einheit = String(p.product_quantity_unit || "g").trim().toLowerCase();
        const packung = (Number.isFinite(inhalt) && inhalt > 0 && inhalt <= 100000 && (einheit === "g" || einheit === "ml")) ? inhalt : 0;
        let bildGross = PRODUKTSUCHE._text(p.image_front_url, 400);
        if (!/^https:\/\//.test(bildGross)) {
            bildGross = "";
        }
        return {
            gefunden: werte.length > 0 || /^[A-E]$/.test(nutri) || (nova >= 1 && nova <= 4),
            menge: PRODUKTSUCHE._text(p.quantity, 30),
            nutri: /^[A-E]$/.test(nutri) ? nutri : "",
            nova: (Number.isInteger(nova) && nova >= 1 && nova <= 4) ? nova : 0,
            packung: packung,
            einheit: packung ? einheit : "g",
            bildGross: bildGross,
            werte: werte
        };
    },

    /* Ein Nährwert als Text, mit `faktor` umgerechnet (1 = je 100 g; Packung/100 = je Packung).
       Große Zahlen (ab 100) ohne Nachkommastelle. */
    naehrText(w, faktor) {
        const z = Number(w && w.wert) * (Number(faktor) > 0 ? Number(faktor) : 1);
        if (!Number.isFinite(z)) {
            return "–";
        }
        const stellen = (z >= 100) ? 0 : (w.stellen || 0);
        const text = (stellen ? z.toFixed(stellen).replace(/\.?0+$/, "") : String(Math.round(z))).replace(".", ",");
        return text + " " + w.einheit;
    },

    /* Wirft nie: jeder Fehler heißt „keine Nährwerte“ (ok: false; netz: true ohne Netz). */
    async naehrwerte(eingabe) {
        const ean = PRODUKTSUCHE.eanPruefen(eingabe);
        if (!ean) {
            return { ok: false, gefunden: false };
        }
        if (PRODUKTSUCHE._naehrMerker[ean]) {
            return PRODUKTSUCHE._naehrMerker[ean];
        }
        const adresse = PRODUKTSUCHE.BASIS + encodeURIComponent(ean) + ".json?fields=" + encodeURIComponent(PRODUKTSUCHE.NAEHR_FELDER);
        try {
            const antwort = await PRODUKTSUCHE._holen(adresse);
            if (antwort && antwort.status === 404) {
                return (PRODUKTSUCHE._naehrMerker[ean] = Object.assign({ ok: true }, PRODUKTSUCHE.naehrwerteZuordnen(null)));
            }
            if (!antwort || !antwort.ok) {
                return { ok: false, gefunden: false };
            }
            const ergebnis = Object.assign({ ok: true }, PRODUKTSUCHE.naehrwerteZuordnen(await antwort.json()));
            PRODUKTSUCHE._naehrMerker[ean] = ergebnis;
            return ergebnis;
        } catch (fehler) {
            return { ok: false, gefunden: false, netz: true };
        }
    },

    /* Die Seite des Produkts bei Open Food Facts (zum Öffnen im Browser, kein Abruf). */
    seite(ean) {
        const nummer = PRODUKTSUCHE.eanPruefen(ean);
        return nummer ? "https://world.openfoodfacts.org/product/" + nummer : "";
    },

    QUELLE: "Produktdaten und Preise: Open Food Facts (ODbL) · Bilder CC BY-SA"
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = PRODUKTSUCHE;
}
