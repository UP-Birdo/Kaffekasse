/*
 * spieler.js — die Konto-Regeln dieser App (reine Funktionen, kein DOM, kein Netz).
 *
 * Die Konten gehören allen UPCrew-Apps (eiserne Regel): Kaffekasse legt keine eigenen
 * Felder an, fremde Felder (Fortschritt, Besitz, Aussehen der Spiele …) wandern unverändert
 * durch, und jede Änderung am eigenen Eintrag zieht `geaendertAm` hoch. Geschrieben wird
 * ein Eintrag nur mit Zusammenführen gegen den Server-Stand — in Stufe 1 schreibt die App
 * noch gar nichts ans Konto (nur der Baustein beim Anlegen).
 *
 * `normalisieren` ist die EINE Nachrüst-Stelle für die Konten-Liste (additiver Datenvertrag):
 * jede Erweiterung bekommt hier ihren Fall und einen Test.
 *
 * UP#Plus ist in jeder UPCrew-App nur der Rollen-Verteiler: nie Mitglied, nie in einer
 * Liste von Menschen. Jede Liste geht über `SPIELER.mitspieler`, erkennen über
 * `SPIELER.istVerteiler`.
 */

const SPIELER = {

    /* Name und Nummer des obersten Kontos (wie KONTO.OBER_NAME / OBER_TAG im Baustein). */
    OBER_NAME: "UP",
    OBER_TAG: "Plus",

    /* Listen, die jedes Konto trägt (Baustein konto.js, `_neuerEintrag`). Firebase liefert
       eine Liste mit Lücken als Objekt mit Zahlen-Schlüsseln — auch die zählt. */
    LISTEN: ["freunde", "abgelehnt", "abzeichen"],

    _alsListe(werte) {
        if (Array.isArray(werte)) {
            return werte.slice();
        }
        if (werte && typeof werte === "object") {
            return Object.keys(werte).sort((a, b) => Number(a) - Number(b)).map((k) => werte[k]);
        }
        return [];
    },

    _text(wert) {
        return (typeof wert === "string") ? wert : (wert === undefined || wert === null ? "" : String(wert));
    },

    /* Ein einzelner Konto-Eintrag in Form — fremde Felder bleiben, wie sie sind. */
    eintragNormalisieren(roh) {
        const e = Object.assign({}, (roh && typeof roh === "object") ? roh : {});
        e.id = SPIELER._text(e.id);
        e.name = SPIELER._text(e.name);
        e.tag = SPIELER._text(e.tag);
        e.uid = SPIELER._text(e.uid);
        e.kennung = SPIELER._text(e.kennung);
        for (const feld of SPIELER.LISTEN) {
            e[feld] = SPIELER._alsListe(e[feld]).filter((w) => typeof w === "string" && w !== "");
        }
        if (e.gast !== undefined) {
            e.gast = e.gast === true;
        }
        if (e.geaendertAm !== undefined) {
            e.geaendertAm = Number(e.geaendertAm) > 0 ? Number(e.geaendertAm) : 0;
        }
        return e;
    },

    /*
     * Die ganze Konten-Liste in Form. Kommt aus `SpeicherKonten.alsListe`:
     *     { geaendertAm, rollen, namen?, spieler: [ {…}, … ] }
     * Liefert immer dieselbe Form, auch aus null.
     */
    normalisieren(roh) {
        const daten = Object.assign({}, (roh && typeof roh === "object") ? roh : {});
        daten.geaendertAm = Number(daten.geaendertAm) > 0 ? Number(daten.geaendertAm) : 0;
        daten.rollen = (daten.rollen && typeof daten.rollen === "object") ? daten.rollen : {};
        daten.spieler = SPIELER._alsListe(daten.spieler)
            .filter((e) => e && typeof e === "object")
            .map(SPIELER.eintragNormalisieren);
        return daten;
    },

    /* Der eigene Eintrag zu einer Konto-Nummer oder null. */
    eigener(daten, uid) {
        if (!daten || !Array.isArray(daten.spieler) || !uid) {
            return null;
        }
        return daten.spieler.find((e) => e.uid === uid) || null;
    },

    /* Name#Nummer, wie er überall angezeigt wird. */
    anzeige(eintrag) {
        if (!eintrag) {
            return "";
        }
        const name = SPIELER._text(eintrag.name);
        const tag = SPIELER._text(eintrag.tag);
        return tag ? name + "#" + tag : name;
    },

    /* UP#Plus: erkannt an der festen Konto-Nummer des Bausteins oder an Name und Nummer. */
    istVerteiler(eintrag) {
        if (!eintrag) {
            return false;
        }
        const oberUid = (typeof KONTO !== "undefined" && KONTO && KONTO.OBER_UID) || null;
        if (oberUid && eintrag.uid === oberUid) {
            return true;
        }
        return SPIELER._text(eintrag.name).toLowerCase() === SPIELER.OBER_NAME.toLowerCase()
            && SPIELER._text(eintrag.tag) === SPIELER.OBER_TAG;
    },

    /* Alle Menschen — ohne den Verteiler, sortiert nach Anzeige. */
    mitspieler(daten) {
        const liste = (daten && Array.isArray(daten.spieler)) ? daten.spieler : [];
        return liste.filter((e) => !SPIELER.istVerteiler(e))
            .slice()
            .sort((a, b) => SPIELER.anzeige(a).localeCompare(SPIELER.anzeige(b), "de", { sensitivity: "base" }));
    },

    /* Eine Änderung am eigenen Eintrag: Kopie mit den neuen Feldern, Marke hochgezogen.
       `zeit` kommt von außen (kein Date.now() im Modell). */
    aendern(eintrag, teil, zeit) {
        const neu = Object.assign({}, eintrag || {}, teil || {});
        neu.geaendertAm = Math.max(Number(zeit) || 0, (Number(eintrag && eintrag.geaendertAm) || 0) + 1);
        return neu;
    },

    /*
     * Zwei Fassungen des EIGENEN Eintrags zusammenführen (Gerät gegen Server). Die neuere
     * Marke gewinnt feldweise für alles, was beide kennen; was nur eine Seite kennt, bleibt
     * erhalten (fremde Felder anderer Apps gehen nie verloren). Die Listen des Kontos werden
     * vereinigt — eine Freundschaft, die auf einem Gerät geschlossen wurde, verschwindet nicht,
     * weil das andere sie noch nicht kannte.
     */
    zusammenfuehren(geraet, server) {
        const a = geraet && typeof geraet === "object" ? geraet : null;
        const b = server && typeof server === "object" ? server : null;
        if (!a) {
            return b ? SPIELER.eintragNormalisieren(b) : null;
        }
        if (!b) {
            return SPIELER.eintragNormalisieren(a);
        }
        const geraetNeuer = (Number(a.geaendertAm) || 0) > (Number(b.geaendertAm) || 0);
        const alt = geraetNeuer ? b : a;
        const neu = geraetNeuer ? a : b;
        const ergebnis = Object.assign({}, alt, neu);
        for (const feld of SPIELER.LISTEN) {
            const vereinigt = SPIELER._alsListe(a[feld]).concat(SPIELER._alsListe(b[feld]));
            ergebnis[feld] = vereinigt.filter((w, i) => typeof w === "string" && w !== "" && vereinigt.indexOf(w) === i);
        }
        ergebnis.geaendertAm = Math.max(Number(a.geaendertAm) || 0, Number(b.geaendertAm) || 0);
        return SPIELER.eintragNormalisieren(ergebnis);
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = SPIELER;
}
