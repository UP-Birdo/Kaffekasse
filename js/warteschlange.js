/*
 * warteschlange.js — Änderungen, die ohne Netz entstanden sind, bis zum Nachsenden aufheben
 * (wie `abgleich.js` der Spiele: sofort anzeigen, später schreiben, bei Fehlschlag mit
 * wachsender Wartezeit). Reine Logik gegen eine Ablage (localStorage oder Attrappe) und eine
 * Uhr von außen — kein DOM, kein Netz hier; gesendet wird über die Funktion, die
 * `nachsenden` bekommt.
 *
 *     WARTESCHLANGE.einrichten({ ablage, schluessel, jetzt })
 *         ablage      { getItem(k), setItem(k, v) } — localStorage oder Attrappe
 *         schluessel  der Schlüssel am Gerät (KONFIG.schluessel.wartend)
 *         jetzt       () => Millisekunden
 *     WARTESCHLANGE.einreihen(id, aenderungen)   derselbe `id` ersetzt den alten Eintrag
 *                                                (ein zweiter Versuch schreibt denselben Knoten)
 *     WARTESCHLANGE.anzahl() · lesen() · entfernen(id) · leeren()
 *     await WARTESCHLANGE.nachsenden(senden, istNetzFehler)
 *         senden(aenderungen) → Promise; istNetzFehler(fehler) → true bei „kein Netz"
 *         → { gesendet, offen, verworfen, netzFehler }
 *
 * Reihenfolge bleibt (älteste zuerst). Kein Netz → der Rest wartet, nächster Versuch nach
 * WARTEZEITEN[versuche]. Eine Absage, die KEIN Netzfehler ist (etwa die Regel lehnt ab),
 * bekommt dieselbe Wartezeit; nach VERSUCHE_MAX fliegt der Eintrag heraus (er würde nie
 * durchgehen) und wird gezählt. Läuft `nachsenden` schon, kehrt ein zweiter Aufruf sofort
 * zurück — nichts wird doppelt gesendet.
 */

const WARTESCHLANGE = {

    WARTEZEITEN: [0, 5000, 15000, 45000, 120000, 300000],
    VERSUCHE_MAX: 8,

    ablage: null,
    schluessel: "kaffekasse.wartend",
    jetzt: () => 0,
    laeuft: false,

    einrichten(optionen) {
        const o = optionen || {};
        WARTESCHLANGE.ablage = o.ablage || null;
        if (o.schluessel) {
            WARTESCHLANGE.schluessel = String(o.schluessel);
        }
        if (typeof o.jetzt === "function") {
            WARTESCHLANGE.jetzt = o.jetzt;
        }
        WARTESCHLANGE.laeuft = false;
    },

    lesen() {
        if (!WARTESCHLANGE.ablage) {
            return [];
        }
        try {
            const roh = JSON.parse(WARTESCHLANGE.ablage.getItem(WARTESCHLANGE.schluessel) || "[]");
            return Array.isArray(roh) ? roh.filter((e) => e && typeof e === "object" && e.id && e.aenderungen) : [];
        } catch (fehler) {
            return [];
        }
    },

    schreiben(liste) {
        if (!WARTESCHLANGE.ablage) {
            return;
        }
        try {
            WARTESCHLANGE.ablage.setItem(WARTESCHLANGE.schluessel, JSON.stringify(liste || []));
        } catch (fehler) {
            /* Speicher voll oder gesperrt: dann nur für diese Sitzung im Gedächtnis nichts. */
        }
    },

    anzahl() {
        return WARTESCHLANGE.lesen().length;
    },

    einreihen(id, aenderungen) {
        const liste = WARTESCHLANGE.lesen();
        const kennung = String(id || "");
        if (!WARTESCHLANGE.ablage || !kennung || !aenderungen || typeof aenderungen !== "object") {
            return liste;
        }
        const neu = { id: kennung, aenderungen: aenderungen, seit: WARTESCHLANGE.jetzt(), versuche: 0, ab: 0 };
        const stelle = liste.findIndex((e) => e.id === kennung);
        if (stelle === -1) {
            liste.push(neu);
        } else {
            liste[stelle] = Object.assign({}, liste[stelle], { aenderungen: aenderungen });
        }
        WARTESCHLANGE.schreiben(liste);
        return liste;
    },

    entfernen(id) {
        const liste = WARTESCHLANGE.lesen().filter((e) => e.id !== String(id));
        WARTESCHLANGE.schreiben(liste);
        return liste;
    },

    leeren() {
        WARTESCHLANGE.schreiben([]);
    },

    wartezeit(versuche) {
        const n = Math.max(0, Math.floor(Number(versuche) || 0));
        return WARTESCHLANGE.WARTEZEITEN[Math.min(n, WARTESCHLANGE.WARTEZEITEN.length - 1)];
    },

    /* Alle Einträge, deren Wartezeit um ist — in Reihenfolge. */
    faellig() {
        const jetzt = WARTESCHLANGE.jetzt();
        return WARTESCHLANGE.lesen().filter((e) => (Number(e.ab) || 0) <= jetzt);
    },

    async nachsenden(senden, istNetzFehler) {
        const ergebnis = { gesendet: 0, offen: 0, verworfen: 0, netzFehler: false };
        if (WARTESCHLANGE.laeuft || typeof senden !== "function") {
            ergebnis.offen = WARTESCHLANGE.anzahl();
            return ergebnis;
        }
        WARTESCHLANGE.laeuft = true;
        try {
            const jetzt = WARTESCHLANGE.jetzt();
            for (const eintrag of WARTESCHLANGE.lesen()) {
                if ((Number(eintrag.ab) || 0) > jetzt) {
                    continue;
                }
                try {
                    await senden(eintrag.aenderungen);
                    WARTESCHLANGE.entfernen(eintrag.id);
                    ergebnis.gesendet++;
                } catch (fehler) {
                    const netz = (typeof istNetzFehler === "function") && istNetzFehler(fehler);
                    const liste = WARTESCHLANGE.lesen();
                    const stelle = liste.findIndex((e) => e.id === eintrag.id);
                    if (stelle !== -1) {
                        const versuche = (Number(liste[stelle].versuche) || 0) + 1;
                        if (!netz && versuche >= WARTESCHLANGE.VERSUCHE_MAX) {
                            liste.splice(stelle, 1);
                            ergebnis.verworfen++;
                        } else {
                            liste[stelle] = Object.assign({}, liste[stelle], {
                                versuche: versuche,
                                ab: WARTESCHLANGE.jetzt() + WARTESCHLANGE.wartezeit(versuche)
                            });
                        }
                        WARTESCHLANGE.schreiben(liste);
                    }
                    if (netz) {
                        ergebnis.netzFehler = true;
                        break;
                    }
                }
            }
        } finally {
            WARTESCHLANGE.laeuft = false;
        }
        ergebnis.offen = WARTESCHLANGE.anzahl();
        return ergebnis;
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = WARTESCHLANGE;
}
