/*
 * freigabe.js — wer sieht welche Neuerung: eine Tabelle je App, die Rolle der Person, ein Ja oder Nein.
 * Gemeinsamer Baustein: in die Apps KOPIEREN, nie abwandeln (Liste: BAUSTEINE.json). Einbau: EINBAU-FREIGABE.md.
 * Neu seit 17.10.2026 (Freigabe-Kanal „beta“, Weg A: EIN Stand draußen, zwei Sichten).
 *
 * DIE TABELLE meldet die App beim Start (`FREIGABEN` in ihrer konfig.js): Name → Stufe.
 *     "alle"   jeder sieht es (auch Gast)
 *     "beta"   nur Konten mit der Rolle „beta“ — und Admins
 *     "admin"  nur Admins (UP#Plus zählt als Admin)
 *     "aus"    gebaut, niemand sieht es
 *   Ein Name, der nicht in der Tabelle steht, ist „nein“ — ein Tippfehler zeigt nichts, statt alles zu zeigen.
 *
 * DIE ROLLE setzt der Konto-Kern (kern\speicher-konten.js), wenn er `spieler/rollen` ohnehin liest — kein eigener
 * Abruf. `KONTO.abmelden()` setzt sie zurück. Gast und abgemeldet: keine Rolle. Diese Datei spricht nie das Netz an,
 * hat kein DOM und rechnet nur.
 *
 * WERKSTATT (nur auf dem eigenen Rechner, Adresse localhost / 127.0.0.1): `?beta` oder `?rolle=beta|admin` in der
 * Adresse setzt die Rolle zum Ansehen. Sie überstimmt die Rolle aus dem Konto, solange die Seite offen ist. Auf jeder
 * anderen Adresse wird der Zusatz nicht beachtet.
 *
 * Nutzung:
 *     UPCREW_FREIGABE.tabelle(KONFIG.FREIGABEN)     // beim Start; → die gemerkte Tabelle (Kopie)
 *     UPCREW_FREIGABE.rolle("beta")                 // "admin" | "beta" | null; ohne Wert → die Rolle jetzt
 *     UPCREW_FREIGABE.darf("duell")                 // → true | false
 *     UPCREW_FREIGABE.istBeta("duell")              // → true, wenn die Stufe "beta" ist UND die Person darf
 *     const weg = UPCREW_FREIGABE.beiWechsel(fn)    // fn(neueRolle, alteRolle) nach einer Änderung (setTimeout 0);
 *     weg()                                         //   → Funktion zum Abmelden des Horchers
 *     UPCREW_FREIGABE.werkstatt(adresse)            // beim Start; liest den Zusatz, nur auf localhost
 */
(function () {
    "use strict";

    const STUFEN = ["alle", "beta", "admin", "aus"];
    const ROLLEN = ["admin", "beta"];

    let tabelleJetzt = {};
    let rolleKonto = null;      /* aus dem Konto-Kern */
    let rolleWerkstatt = null;  /* nur localhost, überstimmt */
    const horcher = [];

    const istObjekt = (w) => !!w && typeof w === "object" && !Array.isArray(w);
    const sauber = (w) => (ROLLEN.indexOf(w) !== -1 ? w : null);
    const wirksam = () => rolleWerkstatt || rolleKonto;

    function melden(neu, alt) {
        if (neu === alt) {
            return;
        }
        for (const fn of horcher.slice()) {
            setTimeout(() => {
                try {
                    fn(neu, alt);
                } catch (fehler) {
                    /* ein kaputter Horcher hält die anderen nicht auf */
                }
            }, 0);
        }
    }

    /* Die Tabelle der App. Nur bekannte Stufen kommen hinein; ein Name mit falscher Stufe zählt als "aus". */
    function tabelle(obj) {
        if (arguments.length > 0) {
            const neu = {};
            if (istObjekt(obj)) {
                for (const name of Object.keys(obj)) {
                    neu[name] = STUFEN.indexOf(obj[name]) !== -1 ? obj[name] : "aus";
                }
            }
            tabelleJetzt = neu;
        }
        return Object.assign({}, tabelleJetzt);
    }

    /* Die Rolle aus dem Konto. Alles außer "admin" und "beta" heißt: keine Rolle. */
    function rolle(wert) {
        if (arguments.length === 0) {
            return wirksam();
        }
        const alt = wirksam();
        rolleKonto = sauber(wert);
        melden(wirksam(), alt);
        return wirksam();
    }

    function darf(name) {
        if (typeof name !== "string" || !Object.prototype.hasOwnProperty.call(tabelleJetzt, name)) {
            return false;
        }
        const stufe = tabelleJetzt[name];
        const r = wirksam();
        if (stufe === "alle") {
            return true;
        }
        if (stufe === "beta") {
            return r === "beta" || r === "admin";
        }
        if (stufe === "admin") {
            return r === "admin";
        }
        return false;
    }

    function istBeta(name) {
        return typeof name === "string" && Object.prototype.hasOwnProperty.call(tabelleJetzt, name)
            && tabelleJetzt[name] === "beta" && darf(name);
    }

    function beiWechsel(fn) {
        if (typeof fn !== "function") {
            return () => {};
        }
        horcher.push(fn);
        return () => {
            const i = horcher.indexOf(fn);
            if (i !== -1) {
                horcher.splice(i, 1);
            }
        };
    }

    /* Werkstatt: `?beta` → beta, `?rolle=beta|admin`. `adresse` = location (oder etwas mit hostname + search). */
    function werkstatt(adresse) {
        const ort = adresse || (typeof location !== "undefined" ? location : null);
        let neu = null;
        try {
            const host = ort && typeof ort.hostname === "string" ? ort.hostname : "";
            if (host === "localhost" || host === "127.0.0.1") {
                const such = new URLSearchParams(typeof ort.search === "string" ? ort.search : "");
                if (such.has("rolle")) {
                    neu = sauber(such.get("rolle"));
                } else if (such.has("beta")) {
                    neu = "beta";
                }
            }
        } catch (fehler) {
            neu = null;
        }
        const alt = wirksam();
        rolleWerkstatt = neu;
        melden(wirksam(), alt);
        return neu;
    }

    const UPCREW_FREIGABE = { tabelle, rolle, darf, istBeta, beiWechsel, werkstatt, STUFEN: STUFEN.slice() };

    if (typeof window !== "undefined") {
        window.UPCREW_FREIGABE = UPCREW_FREIGABE;
    }
    if (typeof globalThis !== "undefined") {
        globalThis.UPCREW_FREIGABE = UPCREW_FREIGABE;
    }
    if (typeof module !== "undefined" && module.exports) {
        module.exports = UPCREW_FREIGABE;
    }
    if (typeof location !== "undefined" && location) {
        werkstatt(location);
    }
})();
