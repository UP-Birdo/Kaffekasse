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
 *   - Seit 0.6.0 ist ein Eintrag eine PACKUNG mit wahlfreiem Kaufdatum, Preis (Cent),
 *     geöffnet und leer (packungAendern, Rechte in ERKLAERUNG.rechte), dazu die Statistik
 *     (statistik, produktFakten, prognose) und kurze Texte für Geld und Zeit.
 *   - Seit 0.7.0 dazu `laden`, `angebot`, `mhd` (Kauf-Felder, nur Käufer); Bestand, Angebote
 *     und Tipp rechnet js\bestand.js auf diesem Modell.
 */

const KASSE = {

    VERSION: 1,

    /* Beitrittscode: sechs Zeichen ohne 0/O, 1/I/L — was man vorlesen kann. */
    CODE_LAENGE: 6,
    CODE_ZEICHEN: "ABCDEFGHJKMNPQRSTUVWXYZ23456789",
    NAME_MAX: 40,
    MENGE_MAX: 20,
    /* Preis je Packung in Cent (Datenbank-Regel: ganze Zahl 0 … 100000). */
    PREIS_MAX: 100000,
    /* Wie weit ein Datum in der Zukunft liegen darf (Uhren der Geräte gehen verschieden). */
    ZUKUNFT_MS: 5 * 60 * 1000,
    /* Name des Ladens (seit 0.7.0): getrimmt, höchstens 40 Zeichen. */
    LADEN_MAX: 40,

    /* Die Felder, die nur schreibt, wer gekauft hat (seit 0.7.0 dazu Laden, Angebot, MHD). */
    KAUF_FELDER: ["gekauftAm", "preis", "laden", "angebot", "mhd"],

    ERKLAERUNG: {
        dran: "Wenigste Käufe · längste Pause · Name",
        ruecknahme: "Nur eigene · kurze Frist",
        zeitraum: "30 Tage oder alles",
        rechte: "Kauf, Preis, Laden, MHD: Käufer · Geöffnet und leer: alle"
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

    /* Preis in Cent: ganze Zahl 0 … PREIS_MAX, sonst -1 (= kein gültiger Preis). */
    _preis(wert) {
        const z = Number(wert);
        return (wert !== null && wert !== "" && wert !== undefined && Number.isInteger(z) && z >= 0 && z <= KASSE.PREIS_MAX) ? z : -1;
    },

    /* Laden: Leerraum zusammengezogen, getrimmt, höchstens LADEN_MAX Zeichen; "" = keiner. */
    ladenText(wert) {
        return KASSE._text(wert).replace(/\s+/g, " ").trim().slice(0, KASSE.LADEN_MAX).trim();
    },

    /* Ein Eintrag ist EINE Packung („+“). Die Felder seit 0.6.0 sind wahlfrei — alte Einträge
       ohne sie bleiben gültig (Kaufdatum fällt dann auf `wann` zurück, siehe kaufZeit).
       Seit 0.7.0 dazu wahlfrei `laden` (Text), `angebot` (nur true), `mhd` (Datum, ms). */
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
        if (KASSE._zahl(e.gekauftAm) > 0) {
            eintrag.gekauftAm = KASSE._zahl(e.gekauftAm);
        }
        if (KASSE._preis(e.preis) >= 0) {
            eintrag.preis = KASSE._preis(e.preis);
        }
        if (KASSE.ladenText(e.laden)) {
            eintrag.laden = KASSE.ladenText(e.laden);
        }
        if (e.angebot === true) {
            eintrag.angebot = true;
        }
        if (KASSE._zahl(e.mhd) > 0) {
            eintrag.mhd = KASSE._zahl(e.mhd);
        }
        for (const art of ["geoeffnet", "leer"]) {
            if (KASSE._zahl(e[art + "Am"]) > 0) {
                eintrag[art + "Am"] = KASSE._zahl(e[art + "Am"]);
                eintrag[art + "Von"] = KASSE._text(e[art + "Von"]);
            }
        }
        return eintrag;
    },

    /* Wann gekauft: das gewählte Kaufdatum, sonst der Zeitpunkt des „+“. */
    kaufZeit(eintrag) {
        return eintrag ? (KASSE._zahl(eintrag.gekauftAm) || KASSE._zahl(eintrag.wann)) : 0;
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

    /* ---------------------------------------------------------------- *
     * Packung: Kaufdatum, Preis, geöffnet, leer (seit 0.6.0)
     *
     * Rechte (Nutzer-Entscheidung 09.10.2026, ERKLAERUNG.rechte):
     *   gekauftAm, preis, laden, angebot, mhd   nur wer gekauft hat (`wer`; 0.7.0: Laden, Angebot, MHD)
     *   geoeffnetAm/-Von, leerAm/-Von   jedes Mitglied; `…Von` = wer es gesetzt hat
     * `felder`: { gekauftAm, preis, laden, angebot, mhd, geoeffnetAm, leerAm } — undefined =
     * unverändert, null = löschen. Wer „geöffnet“ löscht, löscht „leer“ mit. Das MHD darf in
     * der Zukunft liegen (es liegt meist dort).
     * ---------------------------------------------------------------- */

    darfKaufAendern(stand, eintrag, uid) {
        return KASSE.gueltig(eintrag) && !!uid && eintrag.wer === uid && KASSE.istMitglied(stand, uid);
    },

    darfZustandAendern(stand, eintrag, uid) {
        return KASSE.gueltig(eintrag) && KASSE.istMitglied(stand, uid);
    },

    /* Wie die Packung nach der Änderung aussähe — oder ein kurzer Fehlertext. */
    _packungNeu(stand, eintragId, felder, uid, jetzt) {
        const s = (stand && stand.eintraege) ? stand : KASSE.normalisieren(stand);
        const alt = s.eintraege[eintragId];
        const f = KASSE._objekt(felder);
        if (!alt || !KASSE.gueltig(alt)) {
            return { fehler: "Packung fehlt" };
        }
        if (!KASSE.istMitglied(s, uid)) {
            return { fehler: "Kein Mitglied" };
        }
        const neu = Object.assign({}, alt);
        const grenze = KASSE._zahl(jetzt) + KASSE.ZUKUNFT_MS;
        const zeit = (wert) => (wert === null) ? null : KASSE._zahl(wert);
        for (const feld of KASSE.KAUF_FELDER) {
            if (f[feld] === undefined) {
                continue;
            }
            const wert = KASSE._kaufWert(feld, f[feld], zeit);
            const bisher = (alt[feld] === undefined) ? null : alt[feld];
            if (wert === bisher) {
                continue;
            }
            if (!KASSE.darfKaufAendern(s, alt, uid)) {
                return { fehler: "Nur Käufer" };
            }
            if (feld === "preis" && wert === -1) {
                return { fehler: "Preis ungültig" };
            }
            if (feld === "mhd" && wert !== null && !(wert > 0)) {
                return { fehler: "Datum fehlt" };
            }
            if (wert === null) {
                delete neu[feld];
            } else {
                neu[feld] = wert;
            }
        }
        for (const art of ["geoeffnet", "leer"]) {
            const wert = f[art + "Am"];
            if (wert === undefined) {
                continue;
            }
            const am = zeit(wert);
            if (am === (alt[art + "Am"] || null)) {
                continue;
            }
            if (am === null) {
                delete neu[art + "Am"];
                delete neu[art + "Von"];
            } else {
                neu[art + "Am"] = am;
                neu[art + "Von"] = KASSE._text(uid);
            }
        }
        if (!neu.geoeffnetAm && neu.leerAm) {
            if (f.geoeffnetAm === null) {
                delete neu.leerAm;
                delete neu.leerVon;
            } else {
                return { fehler: "Erst geöffnet" };
            }
        }
        for (const feld of ["gekauftAm", "geoeffnetAm", "leerAm"]) {
            if (neu[feld] !== undefined && (!(neu[feld] > 0) || neu[feld] > grenze)) {
                return { fehler: neu[feld] > grenze ? "Nicht in Zukunft" : "Datum fehlt" };
            }
        }
        if (neu.geoeffnetAm && neu.geoeffnetAm < KASSE.kaufZeit(neu)) {
            return { fehler: "Geöffnet vor Kauf" };
        }
        if (neu.leerAm && neu.leerAm < neu.geoeffnetAm) {
            return { fehler: "Leer vor geöffnet" };
        }
        return { alt: alt, neu: neu, stand: s };
    },

    /* Ein Kauf-Feld aus der Eingabe in Form: null = löschen; Laden "" und Angebot false
       löschen ebenfalls (das Feld fehlt dann, statt leer dazustehen). */
    _kaufWert(feld, wert, zeit) {
        if (wert === null) {
            return null;
        }
        if (feld === "preis") {
            return KASSE._preis(wert);
        }
        if (feld === "laden") {
            return KASSE.ladenText(wert) || null;
        }
        if (feld === "angebot") {
            return wert === true ? true : null;
        }
        return zeit(wert);
    },

    /* "" = in Ordnung, sonst ein kurzer Text für das Blatt. */
    packungFehler(stand, eintragId, felder, uid, jetzt) {
        return KASSE._packungNeu(stand, eintragId, felder, uid, jetzt).fehler || "";
    },

    /* Die Änderung selbst: nur die geänderten Felder als Pfade (null = löschen). Ohne
       Änderung leere `aenderungen`; bei einem Fehler null. */
    packungAendern(stand, eintragId, felder, uid, jetzt) {
        const p = KASSE._packungNeu(KASSE.normalisieren(stand), eintragId, felder, uid, jetzt);
        if (p.fehler) {
            return null;
        }
        const aenderungen = {};
        for (const feld of KASSE.KAUF_FELDER.concat(["geoeffnetAm", "geoeffnetVon", "leerAm", "leerVon"])) {
            const vorher = (p.alt[feld] === undefined) ? null : p.alt[feld];
            const nachher = (p.neu[feld] === undefined) ? null : p.neu[feld];
            if (vorher !== nachher) {
                aenderungen["eintraege/" + eintragId + "/" + feld] = nachher;
            }
        }
        const s = p.stand;
        if (Object.keys(aenderungen).length === 0) {
            return { stand: s, aenderungen: {} };
        }
        s.eintraege = Object.assign({}, s.eintraege, { [eintragId]: p.neu });
        s.geaendertAm = KASSE._marke(s, jetzt);
        aenderungen.geaendertAm = s.geaendertAm;
        return { stand: s, aenderungen: aenderungen };
    },

    /* Die offene Packung eines Produkts: geöffnet, nicht leer, die zuletzt geöffnete. */
    offenePackung(stand, produktId) {
        const offen = KASSE.eintraegeVon(stand, { produktId: produktId })
            .filter((e) => e.geoeffnetAm && !e.leerAm)
            .sort((a, b) => b.geoeffnetAm - a.geoeffnetAm);
        return offen.length ? offen[0] : null;
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
    },

    /* ---------------------------------------------------------------- *
     * Statistik (seit 0.6.0) — alles hier, die Bildschirme zeigen nur
     *
     * Gezählt werden gültige Packungen; der Zeitraum gilt dem KAUFDATUM (kaufZeit).
     * Preis = je Packung; Ausgaben = Preis × Menge (nur Einträge mit Preis).
     * Lager = Kauf → geöffnet, Verbrauch = geöffnet → leer (je Packung, Mittel).
     * Prognose „leer etwa am“ = geöffnet + Ø Verbrauch des Produkts (alle Zeit).
     * ---------------------------------------------------------------- */

    WOCHE_MS: 7 * 24 * 60 * 60 * 1000,

    /* Gültige Packungen im Zeitraum (nach Kaufdatum), neueste zuerst. */
    packungen(stand, optionen) {
        const o = optionen || {};
        return KASSE.eintraegeVon(stand, { produktId: o.produktId })
            .map((e) => Object.assign({}, e, { kauf: KASSE.kaufZeit(e) }))
            .filter((e) => (!o.von || e.kauf >= o.von) && (!o.bis || e.kauf <= o.bis))
            .sort((a, b) => b.kauf - a.kauf || a.id.localeCompare(b.id));
    },

    _mittel(werte) {
        return werte.length ? Math.round(werte.reduce((a, w) => a + w, 0) / werte.length) : null;
    },

    /* Kennzahlen einer Liste von Packungen. `zeitraum` für „je Woche“ (von 0 = ab dem ersten Kauf). */
    kennzahlen(liste, zeitraum) {
        const l = liste || [];
        const z = zeitraum || {};
        let packungen = 0;
        let mitPreis = 0;
        let ausgaben = 0;
        const lager = [];
        const verbrauch = [];
        for (const e of l) {
            packungen += e.menge;
            if (typeof e.preis === "number") {
                mitPreis += e.menge;
                ausgaben += e.preis * e.menge;
            }
            const kauf = KASSE.kaufZeit(e);
            if (e.geoeffnetAm && e.geoeffnetAm >= kauf) {
                lager.push(e.geoeffnetAm - kauf);
            }
            if (e.leerAm && e.geoeffnetAm && e.leerAm >= e.geoeffnetAm) {
                verbrauch.push(e.leerAm - e.geoeffnetAm);
            }
        }
        const bis = KASSE._zahl(z.bis);
        const erster = l.reduce((a, e) => Math.min(a, KASSE.kaufZeit(e)), bis || Infinity);
        const von = KASSE._zahl(z.von) || (Number.isFinite(erster) ? erster : bis);
        const wochen = Math.max(1, (bis - von) / KASSE.WOCHE_MS);
        return {
            packungen: packungen,
            mitPreis: mitPreis,
            ausgaben: ausgaben,
            schnittPreis: mitPreis > 0 ? Math.round(ausgaben / mitPreis) : null,
            lagerMs: KASSE._mittel(lager),
            verbrauchMs: KASSE._mittel(verbrauch),
            jeWoche: (packungen > 0 && bis > 0) ? Math.round(packungen / wochen * 10) / 10 : null
        };
    },

    /* „Leer etwa am“: geöffnet + Ø Verbrauch des Produkts über alle Zeit; null ohne Grundlage. */
    prognose(stand, produktId) {
        const offen = KASSE.offenePackung(stand, produktId);
        const v = KASSE.kennzahlen(KASSE.packungen(stand, { produktId: produktId })).verbrauchMs;
        return (offen && v !== null) ? offen.geoeffnetAm + v : null;
    },

    /* Die ganze Statistik der Kasse im Zeitraum: gesamt, je Person, je Produkt. */
    statistik(stand, zeitraum) {
        const s = (stand && stand.mitglieder) ? stand : KASSE.normalisieren(stand);
        const z = zeitraum || {};
        const liste = KASSE.packungen(s, { von: z.von, bis: z.bis });
        const gesamt = KASSE.kennzahlen(liste, z);

        const jePerson = {};
        for (const uid of Object.keys(s.mitglieder)) {
            jePerson[uid] = { packungen: 0, ausgaben: 0 };
        }
        for (const e of liste) {
            const p = jePerson[e.wer] || (jePerson[e.wer] = { packungen: 0, ausgaben: 0 });
            p.packungen += e.menge;
            p.ausgaben += (typeof e.preis === "number") ? e.preis * e.menge : 0;
        }
        const hoechste = Object.keys(jePerson).reduce((a, uid) => Math.max(a, jePerson[uid].packungen), 0);
        const personen = Object.keys(jePerson).map((uid) => ({
            uid: uid,
            name: KASSE.mitgliedName(s, uid) || "Ehemals",
            packungen: jePerson[uid].packungen,
            ausgaben: jePerson[uid].ausgaben,
            anteil: hoechste > 0 ? jePerson[uid].packungen / hoechste : 0
        })).sort((a, b) => b.packungen - a.packungen || a.name.localeCompare(b.name, "de", { sensitivity: "base" }));

        const produkte = KASSE.produkteAktiv(s).map((p) => {
            const eigene = liste.filter((e) => e.produktId === p.id);
            const offen = KASSE.offenePackung(s, p.id);
            return Object.assign({ produkt: p }, KASSE.kennzahlen(eigene, z), {
                offen: offen,
                prognose: KASSE.prognose(s, p.id),
                dran: KASSE.naechsterDran(s, p.id)
            });
        });
        return { gesamt: gesamt, personen: personen, produkte: produkte };
    },

    /* Alle Fakten eines Produkts (alle Zeit) für das Produkt-Blatt. */
    produktFakten(stand, produktId, jetzt) {
        const s = (stand && stand.produkte) ? stand : KASSE.normalisieren(stand);
        const produkt = s.produkte[produktId];
        if (!produkt) {
            return null;
        }
        const liste = KASSE.packungen(s, { produktId: produktId });
        return Object.assign({ produkt: Object.assign({ id: produktId }, produkt) },
            KASSE.kennzahlen(liste, { von: 0, bis: KASSE._zahl(jetzt) }), {
                offen: KASSE.offenePackung(s, produktId),
                prognose: KASSE.prognose(s, produktId),
                dran: KASSE.naechsterDran(s, produktId),
                letzte: liste.slice(0, 5).map((e) => Object.assign({}, e, { werName: KASSE.mitgliedName(s, e.wer) }))
            });
    },

    /* ---------------------------------------------------------------- *
     * Texte für Zahlen und Zeiten (kurz, deutsch)
     * ---------------------------------------------------------------- */

    euro(cent) {
        if (typeof cent !== "number" || !Number.isFinite(cent)) {
            return "–";
        }
        const c = Math.round(cent);
        const euro = Math.floor(Math.abs(c) / 100);
        const rest = String(Math.abs(c) % 100).padStart(2, "0");
        return (c < 0 ? "-" : "") + euro + "," + rest + " €";
    },

    /* Eingabe „1,29“, „1.29“, „1“, „1,5 €“ → Cent; "" → null; Unsinn → -1. */
    preisAusText(text) {
        const t = KASSE._text(text).replace(/€/g, "").replace(/\s/g, "").replace(",", ".");
        if (t === "") {
            return null;
        }
        if (!/^\d{1,4}(\.\d{1,2})?$/.test(t)) {
            return -1;
        }
        return KASSE._preis(Math.round(Number(t) * 100));
    },

    /* Preis für ein Eingabefeld: 129 → "1,29". */
    preisAlsText(cent) {
        return (typeof cent === "number" && cent >= 0) ? KASSE.euro(cent).replace(" €", "") : "";
    },

    dauerText(ms) {
        if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) {
            return "–";
        }
        const min = Math.round(ms / 60000);
        if (min < 60) {
            return min + " Min";
        }
        const std = Math.round(ms / 3600000);
        if (std < 48) {
            return std + " Std";
        }
        return Math.round(ms / 86400000) + " Tage";
    },

    /* „Heute“, „Gestern“, sonst „TT.MM.“ (mit Jahr, wenn es ein anderes ist). */
    datumKurz(ms, heute) {
        if (!(KASSE._zahl(ms) > 0)) {
            return "–";
        }
        const schluessel = KASSE.tagSchluessel(ms);
        const name = KASSE.tagName(schluessel, heute);
        if (name === "Heute" || name === "Gestern") {
            return name;
        }
        const t = schluessel.split("-");
        return t[2] + "." + t[1] + "." + (t[0] === KASSE.tagSchluessel(heute).slice(0, 4) ? "" : t[0]);
    },

    /* Für <input type="datetime-local">: Ortszeit "JJJJ-MM-TTTHH:MM" und zurück (0 = leer/ungültig). */
    alsEingabe(ms) {
        if (!(KASSE._zahl(ms) > 0)) {
            return "";
        }
        return KASSE.tagSchluessel(ms) + "T" + KASSE.uhrzeit(ms);
    },

    ausEingabe(text) {
        const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(KASSE._text(text));
        if (!m) {
            return 0;
        }
        const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
        const ms = d.getTime();
        return Number.isFinite(ms) && ms > 0 ? ms : 0;
    },

    /* MHD (seit 0.7.0) ist ein Tag: gespeichert als Beginn des Tages in Ortszeit.
       Für <input type="date">: "JJJJ-MM-TT" hin und zurück (0 = leer/ungültig). */
    tagBeginn(ms) {
        const d = new Date(KASSE._zahl(ms));
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    },

    alsDatum(ms) {
        return (KASSE._zahl(ms) > 0) ? KASSE.tagSchluessel(ms) : "";
    },

    ausDatum(text) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(KASSE._text(text).trim());
        if (!m) {
            return 0;
        }
        const ms = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
        return Number.isFinite(ms) && ms > 0 ? ms : 0;
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = KASSE;
}
