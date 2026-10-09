/*
 * kasse.js — DAS MODELL: Datenvertrag der Kasse, Zähler, Nächster-dran, Rücknahme, Verlauf,
 * Übersicht. Reine Funktionen: kein DOM, kein Netz, kein eigener Zufall, keine eigene Uhr —
 * Zufall und Zeit kommen von außen (eiserne Regel; ein Test wacht darüber).
 *
 * Jede Änderung liefert ZWEI Dinge: den neuen Stand (für die Anzeige am Gerät) und die
 * `aenderungen` als Mehrpfad-Objekt RELATIV ZUR KASSE (für die Datenbank, PATCH):
 *     { "eintraege/<id>": {…}, "geaendertAm": 1750000000000 }
 * Die Speicher-Schicht setzt `kassen/<kasseId>/` davor. So schreibt die App nur die eigenen
 * Knoten — nie die ganze Kasse, nie fremde Einträge (eiserne Regel).
 *
 * Datenvertrag (Architektur-Doku, „Datenmodell"), additiv: Felder werden nur ergänzt;
 * `normalisieren` ist die EINE Nachrüst-Stelle.
 *
 * Regeln (Erklärtexte in KASSE.ERKLAERUNG, Bildschirme zeigen sie nur):
 *   - Nächster dran je Produkt: wenigste gültige Käufe im Zeitraum; Gleichstand → wer am
 *     längsten nicht gekauft hat (nie gekauft zählt als „am längsten"); weiterer Gleichstand →
 *     Name alphabetisch. Mitglieder ohne Kauf zählen mit 0.
 *   - Rücknahme nur des eigenen Eintrags innerhalb der Frist (KONFIG.ruecknahmeMinuten); der
 *     Eintrag bleibt stehen (`zurueckgenommen` = Zeitpunkt) und zählt nicht mehr.
 *   - Zähler = Summe `menge` der gültigen Einträge je Person und Produkt im Zeitraum.
 */

const KASSE = {

    VERSION: 1,

    /* Beitrittscode: sechs Zeichen ohne 0/O, 1/I/L — was man vorlesen kann. */
    CODE_LAENGE: 6,
    CODE_ZEICHEN: "ABCDEFGHJKMNPQRSTUVWXYZ23456789",
    NAME_MAX: 40,
    MENGE_MAX: 20,

    ERKLAERUNG: {
        dran: "Wenigste Käufe · längste Pause · Name",
        ruecknahme: "Nur eigene · kurze Frist",
        zeitraum: "30 Tage oder alles"
    },

    /* ---------------------------------------------------------------- *
     * Helfer
     * ---------------------------------------------------------------- */

    _text(wert, max) {
        const t = (typeof wert === "string") ? wert : (wert === undefined || wert === null ? "" : String(wert));
        return max ? t.slice(0, max) : t;
    },

    _zahl(wert, standard) {
        const z = Number(wert);
        return (Number.isFinite(z) && z > 0) ? z : (standard || 0);
    },

    _objekt(wert) {
        return (wert && typeof wert === "object" && !Array.isArray(wert)) ? wert : {};
    },

    _zufallsZeichen(zufall, anzahl) {
        let text = "";
        for (let i = 0; i < anzahl; i++) {
            const z = Math.min(KASSE.CODE_ZEICHEN.length - 1, Math.max(0, Math.floor(KASSE._zufallWert(zufall) * KASSE.CODE_ZEICHEN.length)));
            text += KASSE.CODE_ZEICHEN.charAt(z);
        }
        return text;
    },

    _zufallWert(zufall) {
        const w = (typeof zufall === "function") ? Number(zufall()) : 0;
        return (Number.isFinite(w) && w >= 0 && w < 1) ? w : 0;
    },

    /* ---------------------------------------------------------------- *
     * Datenvertrag
     * ---------------------------------------------------------------- */

    mitgliedNormalisieren(roh) {
        const m = KASSE._objekt(roh);
        return { name: KASSE._text(m.name, KASSE.NAME_MAX), seit: KASSE._zahl(m.seit) };
    },

    produktNormalisieren(roh) {
        const p = KASSE._objekt(roh);
        return {
            name: KASSE._text(p.name, KASSE.NAME_MAX),
            marke: KASSE._text(p.marke, KASSE.NAME_MAX),
            ean: KASSE._text(p.ean, 20).replace(/[^0-9]/g, ""),
            bild: KASSE._text(p.bild, 400),
            angelegtVon: KASSE._text(p.angelegtVon),
            angelegtAm: KASSE._zahl(p.angelegtAm),
            aktiv: p.aktiv !== false
        };
    },

    eintragNormalisieren(roh) {
        const e = KASSE._objekt(roh);
        const eintrag = {
            produktId: KASSE._text(e.produktId),
            wer: KASSE._text(e.wer),
            wann: KASSE._zahl(e.wann),
            menge: Math.min(KASSE.MENGE_MAX, Math.max(1, Math.round(KASSE._zahl(e.menge, 1))))
        };
        if (KASSE._zahl(e.zurueckgenommen) > 0) {
            eintrag.zurueckgenommen = KASSE._zahl(e.zurueckgenommen);
        }
        return eintrag;
    },

    /* Die ganze Kasse in Form — aus allem, auch aus null. Unbekannte Felder bleiben erhalten. */
    normalisieren(roh) {
        const r = KASSE._objekt(roh);
        const stand = Object.assign({}, r);
        stand.version = Math.max(KASSE.VERSION, Math.floor(KASSE._zahl(r.version, KASSE.VERSION)));
        stand.name = KASSE._text(r.name, KASSE.NAME_MAX);
        stand.code = KASSE.codePruefen(r.code);
        stand.erstelltVon = KASSE._text(r.erstelltVon);
        stand.erstelltAm = KASSE._zahl(r.erstelltAm);
        stand.geaendertAm = KASSE._zahl(r.geaendertAm);
        stand.mitglieder = {};
        for (const uid of Object.keys(KASSE._objekt(r.mitglieder))) {
            if (uid) {
                stand.mitglieder[uid] = KASSE.mitgliedNormalisieren(r.mitglieder[uid]);
            }
        }
        stand.produkte = {};
        for (const id of Object.keys(KASSE._objekt(r.produkte))) {
            const p = KASSE.produktNormalisieren(r.produkte[id]);
            if (id && p.name) {
                stand.produkte[id] = p;
            }
        }
        stand.eintraege = {};
        for (const id of Object.keys(KASSE._objekt(r.eintraege))) {
            const e = KASSE.eintragNormalisieren(r.eintraege[id]);
            if (id && e.produktId && e.wer && e.wann) {
                stand.eintraege[id] = e;
            }
        }
        return stand;
    },

    /* ---------------------------------------------------------------- *
     * Codes und Kennungen
     * ---------------------------------------------------------------- */

    codeErzeugen(zufall) {
        return KASSE._zufallsZeichen(zufall, KASSE.CODE_LAENGE);
    },

    /* Eingabe des Nutzers → gültiger Code oder "" (Groß/klein egal, Leerzeichen und Striche weg). */
    codePruefen(text) {
        const code = KASSE._text(text).toUpperCase().replace(/[\s-]/g, "");
        if (code.length !== KASSE.CODE_LAENGE) {
            return "";
        }
        for (const z of code) {
            if (KASSE.CODE_ZEICHEN.indexOf(z) === -1) {
                return "";
            }
        }
        return code;
    },

    /* Kennung für Kasse, Produkt, Eintrag: Zeit (36er) + vier Zufallszeichen — sortiert nach
       Zeit, am Gerät erzeugt (ein zweiter Sendeversuch schreibt denselben Knoten). */
    kennungErzeugen(zeit, zufall) {
        return Math.floor(KASSE._zahl(zeit)).toString(36) + "-" + KASSE._zufallsZeichen(zufall, 4).toLowerCase();
    },

    /* ---------------------------------------------------------------- *
     * Kasse, Mitglieder, Produkte
     * ---------------------------------------------------------------- */

    /* Eine neue Kasse mit dem Gründer als erstem Mitglied. */
    anlegen(optionen) {
        const o = optionen || {};
        const name = KASSE._text(o.name, KASSE.NAME_MAX).trim();
        const uid = KASSE._text(o.uid);
        if (!name || !uid) {
            return null;
        }
        const zeit = KASSE._zahl(o.zeit);
        const kasseId = KASSE.kennungErzeugen(zeit, o.zufall);
        const stand = KASSE.normalisieren({
            version: KASSE.VERSION,
            name: name,
            code: KASSE.codeErzeugen(o.zufall),
            erstelltVon: uid,
            erstelltAm: zeit,
            geaendertAm: zeit,
            mitglieder: { [uid]: { name: KASSE._text(o.mitgliedName, KASSE.NAME_MAX) || "Mitglied", seit: zeit } }
        });
        return { kasseId: kasseId, stand: stand };
    },

    istMitglied(stand, uid) {
        return !!(stand && stand.mitglieder && uid && stand.mitglieder[uid]);
    },

    mitgliedName(stand, uid) {
        return KASSE.istMitglied(stand, uid) ? stand.mitglieder[uid].name : "";
    },

    beitreten(stand, uid, mitgliedName, zeit) {
        const s = KASSE.normalisieren(stand);
        const kennung = KASSE._text(uid);
        if (!kennung) {
            return null;
        }
        const neu = Object.assign({}, s.mitglieder[kennung] || {}, {
            name: KASSE._text(mitgliedName, KASSE.NAME_MAX) || (s.mitglieder[kennung] && s.mitglieder[kennung].name) || "Mitglied",
            seit: (s.mitglieder[kennung] && s.mitglieder[kennung].seit) || KASSE._zahl(zeit)
        });
        s.mitglieder = Object.assign({}, s.mitglieder, { [kennung]: neu });
        s.geaendertAm = KASSE._marke(s, zeit);
        return { stand: s, aenderungen: { ["mitglieder/" + kennung]: neu, geaendertAm: s.geaendertAm } };
    },

    /* Die Stand-Marke zieht immer hoch, auch wenn die Uhr des Geräts zurückhängt. */
    _marke(stand, zeit) {
        return Math.max(KASSE._zahl(zeit), (KASSE._zahl(stand && stand.geaendertAm)) + 1);
    },

    produktAnlegen(stand, felder, uid, zeit, zufall) {
        const s = KASSE.normalisieren(stand);
        const f = KASSE._objekt(felder);
        const name = KASSE._text(f.name, KASSE.NAME_MAX).trim();
        if (!name || !KASSE.istMitglied(s, uid)) {
            return null;
        }
        const produktId = KASSE.kennungErzeugen(zeit, zufall);
        const produkt = KASSE.produktNormalisieren({
            name: name, marke: f.marke, ean: f.ean, bild: f.bild,
            angelegtVon: uid, angelegtAm: KASSE._zahl(zeit), aktiv: true
        });
        s.produkte = Object.assign({}, s.produkte, { [produktId]: produkt });
        s.geaendertAm = KASSE._marke(s, zeit);
        return { stand: s, produktId: produktId, produkt: produkt,
            aenderungen: { ["produkte/" + produktId]: produkt, geaendertAm: s.geaendertAm } };
    },

    /* Ausblenden statt löschen: Einträge zeigen weiter auf das Produkt. */
    produktAusblenden(stand, produktId, uid, zeit) {
        const s = KASSE.normalisieren(stand);
        if (!s.produkte[produktId] || !KASSE.istMitglied(s, uid)) {
            return null;
        }
        s.produkte = Object.assign({}, s.produkte, { [produktId]: Object.assign({}, s.produkte[produktId], { aktiv: false }) });
        s.geaendertAm = KASSE._marke(s, zeit);
        return { stand: s, aenderungen: { ["produkte/" + produktId + "/aktiv"]: false, geaendertAm: s.geaendertAm } };
    },

    produkteAktiv(stand) {
        const s = (stand && stand.produkte) ? stand : KASSE.normalisieren(stand);
        return Object.keys(s.produkte)
            .filter((id) => s.produkte[id].aktiv)
            .map((id) => Object.assign({ id: id }, s.produkte[id]))
            .sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));
    },

    /* ---------------------------------------------------------------- *
     * Einträge
     * ---------------------------------------------------------------- */

    kaufEintragen(stand, produktId, uid, zeit, zufall, menge) {
        const s = KASSE.normalisieren(stand);
        const produkt = s.produkte[produktId];
        if (!produkt || !produkt.aktiv || !KASSE.istMitglied(s, uid)) {
            return null;
        }
        const eintragId = KASSE.kennungErzeugen(zeit, zufall);
        const eintrag = KASSE.eintragNormalisieren({ produktId: produktId, wer: uid, wann: KASSE._zahl(zeit), menge: menge });
        s.eintraege = Object.assign({}, s.eintraege, { [eintragId]: eintrag });
        s.geaendertAm = KASSE._marke(s, zeit);
        return { stand: s, eintragId: eintragId, eintrag: eintrag,
            aenderungen: { ["eintraege/" + eintragId]: eintrag, geaendertAm: s.geaendertAm } };
    },

    gueltig(eintrag) {
        return !!eintrag && !(KASSE._zahl(eintrag.zurueckgenommen) > 0);
    },

    ruecknahmeErlaubt(eintrag, uid, jetzt, fristMinuten) {
        if (!KASSE.gueltig(eintrag) || !uid || eintrag.wer !== uid) {
            return false;
        }
        const frist = KASSE._zahl(fristMinuten, 10) * 60 * 1000;
        return KASSE._zahl(jetzt) - eintrag.wann <= frist;
    },

    zuruecknehmen(stand, eintragId, uid, jetzt, fristMinuten) {
        const s = KASSE.normalisieren(stand);
        const eintrag = s.eintraege[eintragId];
        if (!KASSE.ruecknahmeErlaubt(eintrag, uid, jetzt, fristMinuten)) {
            return null;
        }
        const neu = Object.assign({}, eintrag, { zurueckgenommen: KASSE._zahl(jetzt) });
        s.eintraege = Object.assign({}, s.eintraege, { [eintragId]: neu });
        s.geaendertAm = KASSE._marke(s, jetzt);
        return { stand: s, aenderungen: { ["eintraege/" + eintragId + "/zurueckgenommen"]: neu.zurueckgenommen, geaendertAm: s.geaendertAm } };
    },

    /* Einträge als Liste, neueste zuerst. `optionen`: produktId, von, bis (ms), mitZurueckgenommenen. */
    eintraegeVon(stand, optionen) {
        const o = optionen || {};
        const s = (stand && stand.eintraege) ? stand : KASSE.normalisieren(stand);
        const liste = [];
        for (const id of Object.keys(s.eintraege)) {
            const e = s.eintraege[id];
            if (o.produktId && e.produktId !== o.produktId) {
                continue;
            }
            if (o.von && e.wann < o.von) {
                continue;
            }
            if (o.bis && e.wann > o.bis) {
                continue;
            }
            if (!o.mitZurueckgenommenen && !KASSE.gueltig(e)) {
                continue;
            }
            liste.push(Object.assign({ id: id }, e));
        }
        return liste.sort((a, b) => b.wann - a.wann || a.id.localeCompare(b.id));
    },

    /* Zähler je Person für ein Produkt: jedes Mitglied (auch mit 0) und jeder, der je gekauft hat. */
    zaehler(stand, produktId, zeitraum) {
        const s = (stand && stand.mitglieder) ? stand : KASSE.normalisieren(stand);
        const z = zeitraum || {};
        const summen = {};
        for (const uid of Object.keys(s.mitglieder)) {
            summen[uid] = 0;
        }
        for (const e of KASSE.eintraegeVon(s, { produktId: produktId, von: z.von, bis: z.bis })) {
            summen[e.wer] = (summen[e.wer] || 0) + e.menge;
        }
        return summen;
    },

    letzterKauf(stand, produktId, uid, zeitraum) {
        const z = zeitraum || {};
        const eigene = KASSE.eintraegeVon(stand, { produktId: produktId, von: z.von, bis: z.bis }).filter((e) => e.wer === uid);
        return eigene.length ? eigene[0].wann : 0;
    },

    /* Wer ist als Nächstes dran (die feste Regel, ERKLAERUNG.dran). null ohne Mitglieder. */
    naechsterDran(stand, produktId, zeitraum) {
        const s = (stand && stand.mitglieder) ? stand : KASSE.normalisieren(stand);
        const mitglieder = Object.keys(s.mitglieder);
        if (mitglieder.length === 0) {
            return null;
        }
        const summen = KASSE.zaehler(s, produktId, zeitraum);
        const sortiert = mitglieder.map((uid) => ({
            uid: uid,
            anzahl: summen[uid] || 0,
            zuletzt: KASSE.letzterKauf(s, produktId, uid, zeitraum),
            name: s.mitglieder[uid].name
        })).sort((a, b) => a.anzahl - b.anzahl
            || a.zuletzt - b.zuletzt
            || a.name.localeCompare(b.name, "de", { sensitivity: "base" })
            || a.uid.localeCompare(b.uid));
        return sortiert[0].uid;
    },

    /* ---------------------------------------------------------------- *
     * Zeit und Verlauf (Stufe 3 nutzt sie, das Modell trägt sie von Anfang an)
     * ---------------------------------------------------------------- */

    /* Zeitraum ab `jetzt`: "30" = die letzten 30 Tage, sonst alles. */
    zeitraum(jetzt, art) {
        const bis = KASSE._zahl(jetzt);
        if (String(art) === "30") {
            return { von: bis - 30 * 24 * 60 * 60 * 1000, bis: bis, art: "30" };
        }
        return { von: 0, bis: bis, art: "alle" };
    },

    /* Tag eines Zeitpunkts in Ortszeit, als "JJJJ-MM-TT". */
    tagSchluessel(ms) {
        const d = new Date(KASSE._zahl(ms));
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const tt = String(d.getDate()).padStart(2, "0");
        return d.getFullYear() + "-" + mm + "-" + tt;
    },

    tagName(schluessel, heute) {
        const h = KASSE._zahl(heute);
        if (schluessel === KASSE.tagSchluessel(h)) {
            return "Heute";
        }
        if (schluessel === KASSE.tagSchluessel(h - 24 * 60 * 60 * 1000)) {
            return "Gestern";
        }
        const teile = schluessel.split("-");
        return teile.length === 3 ? teile[2] + "." + teile[1] + "." + teile[0] : schluessel;
    },

    uhrzeit(ms) {
        const d = new Date(KASSE._zahl(ms));
        return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    },

    /* Der Verlauf: alle Einträge (auch zurückgenommene) mit Produkt- und Personennamen. */
    verlauf(stand, zeitraum) {
        const s = (stand && stand.eintraege) ? stand : KASSE.normalisieren(stand);
        const z = zeitraum || {};
        return KASSE.eintraegeVon(s, { von: z.von, bis: z.bis, mitZurueckgenommenen: true }).map((e) => Object.assign({}, e, {
            produktName: s.produkte[e.produktId] ? s.produkte[e.produktId].name : "",
            werName: KASSE.mitgliedName(s, e.wer),
            gueltig: KASSE.gueltig(e)
        }));
    },

    /* Den Verlauf nach Tagen bündeln, neueste zuerst: [{ schluessel, name, eintraege }]. */
    nachTag(liste, heute) {
        const tage = [];
        for (const e of liste || []) {
            const schluessel = KASSE.tagSchluessel(e.wann);
            let tag = tage[tage.length - 1];
            if (!tag || tag.schluessel !== schluessel) {
                tag = { schluessel: schluessel, name: KASSE.tagName(schluessel, heute), eintraege: [] };
                tage.push(tag);
            }
            tag.eintraege.push(e);
        }
        return tage;
    },

    /* Übersicht je Produkt: wer wie oft, Anteil am Ganzen (für Balken), wer dran ist. */
    uebersicht(stand, zeitraum) {
        const s = (stand && stand.mitglieder) ? stand : KASSE.normalisieren(stand);
        return KASSE.produkteAktiv(s).map((p) => {
            const summen = KASSE.zaehler(s, p.id, zeitraum);
            const gesamt = Object.keys(summen).reduce((a, uid) => a + summen[uid], 0);
            const hoechste = Object.keys(summen).reduce((a, uid) => Math.max(a, summen[uid]), 0);
            const personen = Object.keys(summen).map((uid) => ({
                uid: uid,
                name: KASSE.mitgliedName(s, uid) || "Ehemals",
                menge: summen[uid],
                anteil: hoechste > 0 ? summen[uid] / hoechste : 0
            })).sort((a, b) => b.menge - a.menge || a.name.localeCompare(b.name, "de", { sensitivity: "base" }));
            return { produkt: p, gesamt: gesamt, personen: personen, dran: KASSE.naechsterDran(s, p.id, zeitraum) };
        });
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = KASSE;
}
