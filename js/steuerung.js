/*
 * steuerung.js — der Vermittler zwischen Modell (KASSE), Speicher (SpeicherKasse), Gerät
 * (localStorage) und den Bildschirmen. Die EINE Stelle, die Zufall und Zeit kennt und sie
 * dem Modell gibt; die Bildschirme rufen nur hier an und zeichnen, was `stand` sagt.
 *
 *     STEUERUNG.einrichten()                 beim Start, nach speicherErzeugen
 *     STEUERUNG.beobachten(fn) → loesen      bei jeder Änderung des Standes oder Zustands
 *     STEUERUNG.hatKasse() · .stand · .zustand ("leer" | "laden" | "ok" | "fehler")
 *     await STEUERUNG.laden()                die Kasse vom Server (sonst der Stand vom Gerät)
 *     await STEUERUNG.anlegen(name) / beitreten(codeEingabe) / verlassen()
 *     await STEUERUNG.kaufen(produktId, menge) → eintragId / zuruecknehmen(eintragId)
 *     STEUERUNG.vorbelegung(eintragId) / await vorbelegungUebernehmen(eintragId, angebot)   (0.7.0)
 *     await STEUERUNG.produktAnlegen(felder) / produktAusblenden(produktId)
 *     await STEUERUNG.packungAendern(eintragId, felder)   Kaufdatum, Preis, geöffnet, leer
 *     STEUERUNG.darfZuruecknehmen(eintrag) / darfKaufAendern(eintrag) / darfZustandAendern(eintrag)
 *
 * Offline wie die Spiele: Jede Änderung landet sofort im Stand (Anzeige) und am Gerät, dann in
 * der Warteschlange (schon mit `kassen/<id>/`-Pfaden, also unabhängig von der gerade
 * gewählten Kasse) und wird gesendet. Kein Netz → Zeichen des Offline-Bausteins, nachgesendet
 * beim `online`-Ereignis, beim Verbergen der Seite und beim nächsten Start. Solange etwas
 * wartet, wird die Kasse nicht vom Server neu geladen (sonst verschwänden die eigenen,
 * noch nicht gesendeten Einträge aus der Anzeige).
 *
 * Andere Geräte: im Takt KONFIG.abfrageIntervallMs nur die Stand-Marke fragen; ist sie neuer,
 * die Kasse neu laden.
 */

const STEUERUNG = {

    kasseId: null,
    stand: null,
    zustand: "leer",
    technik: "",
    takt: null,
    horcher: [],
    eingerichtet: false,

    /* Die EINE Stelle mit Zufall und Uhr (das Modell bekommt sie als Werte). */
    zufall: () => Math.random(),
    jetzt: () => Date.now(),

    einrichten() {
        if (STEUERUNG.eingerichtet) {
            return;
        }
        STEUERUNG.eingerichtet = true;
        const ablage = STEUERUNG._ablage();
        WARTESCHLANGE.einrichten({ ablage: ablage, schluessel: KONFIG.schluessel.wartend, jetzt: STEUERUNG.jetzt });
        STEUERUNG._vomGeraet();
        if (typeof window !== "undefined") {
            window.addEventListener("online", () => { STEUERUNG.nachsenden().then(() => STEUERUNG.pruefen()); });
            document.addEventListener("visibilitychange", () => {
                if (document.hidden) {
                    STEUERUNG.nachsenden();
                } else {
                    STEUERUNG.nachsenden().then(() => STEUERUNG.pruefen());
                }
            });
        }
        STEUERUNG.taktStarten();
    },

    _ablage() {
        try {
            return (typeof localStorage !== "undefined") ? localStorage : null;
        } catch (fehler) {
            return null;
        }
    },

    _lies(schluessel) {
        const a = STEUERUNG._ablage();
        try {
            return a ? a.getItem(schluessel) : null;
        } catch (fehler) {
            return null;
        }
    },

    _schreib(schluessel, wert) {
        const a = STEUERUNG._ablage();
        try {
            if (!a) {
                return;
            }
            if (wert === null || wert === undefined) {
                a.removeItem(schluessel);
            } else {
                a.setItem(schluessel, wert);
            }
        } catch (fehler) {
            /* Speicher voll oder gesperrt: die Anzeige stimmt trotzdem für diese Sitzung. */
        }
    },

    _vomGeraet() {
        STEUERUNG.kasseId = STEUERUNG._lies(KONFIG.schluessel.kasse) || null;
        let stand = null;
        try {
            stand = JSON.parse(STEUERUNG._lies(KONFIG.schluessel.stand) || "null");
        } catch (fehler) {
            stand = null;
        }
        STEUERUNG.stand = (STEUERUNG.kasseId && stand) ? KASSE.normalisieren(stand) : null;
        STEUERUNG.zustand = STEUERUNG.kasseId ? (STEUERUNG.stand ? "ok" : "laden") : "leer";
    },

    merken() {
        STEUERUNG._schreib(KONFIG.schluessel.kasse, STEUERUNG.kasseId);
        STEUERUNG._schreib(KONFIG.schluessel.stand, STEUERUNG.stand ? JSON.stringify(STEUERUNG.stand) : null);
    },

    /* Beim Abmelden oder Verlassen: die Kasse gehört zum Konto, nicht zum Gerät. */
    vergessen() {
        STEUERUNG.kasseId = null;
        STEUERUNG.stand = null;
        STEUERUNG.zustand = "leer";
        STEUERUNG.technik = "";
        STEUERUNG.merken();
        STEUERUNG._melden();
    },

    beobachten(fn) {
        if (typeof fn === "function") {
            STEUERUNG.horcher.push(fn);
        }
        return () => { STEUERUNG.horcher = STEUERUNG.horcher.filter((h) => h !== fn); };
    },

    _melden() {
        for (const h of STEUERUNG.horcher.slice()) {
            try {
                h();
            } catch (fehler) {
                console.error(fehler);
            }
        }
    },

    hatKasse() {
        return !!STEUERUNG.kasseId;
    },

    _uid() {
        return (typeof KONTO !== "undefined" && KONTO.angemeldet()) ? KONTO.uid() : null;
    },

    _mitgliedName() {
        const name = (typeof APP !== "undefined" && typeof APP.anzeigeName === "function") ? APP.anzeigeName() : "";
        return name || "Mitglied";
    },

    _speicher() {
        return (typeof APP !== "undefined" && APP.speicher) ? APP.speicher.kasse : null;
    },

    _istNetz(fehler) {
        return (typeof UPCREW_OFFLINE !== "undefined") ? UPCREW_OFFLINE.istNetzFehler(fehler) : false;
    },

    _offline(ja) {
        if (typeof UPCREW_OFFLINE !== "undefined") {
            UPCREW_OFFLINE.setzen(!!ja);
        }
        if (typeof APP !== "undefined" && ja) {
            APP.zustand = "offline";
        }
    },

    /* ---------------------------------------------------------------- *
     * Laden und Takt
     * ---------------------------------------------------------------- */

    async laden() {
        const speicher = STEUERUNG._speicher();
        if (!STEUERUNG.kasseId || !speicher) {
            return;
        }
        if (!STEUERUNG.stand) {
            STEUERUNG.zustand = "laden";
            STEUERUNG._melden();
        }
        try {
            const stand = await speicher.kasseLaden(STEUERUNG.kasseId);
            if (!stand) {
                /* Die Kasse gibt es nicht mehr. */
                STEUERUNG.vergessen();
                return;
            }
            STEUERUNG.stand = stand;
            STEUERUNG.zustand = "ok";
            STEUERUNG.technik = "";
            STEUERUNG.merken();
            STEUERUNG._offline(false);
        } catch (fehler) {
            if (STEUERUNG._istNetz(fehler)) {
                STEUERUNG._offline(true);
                STEUERUNG.zustand = STEUERUNG.stand ? "ok" : "fehler";
                STEUERUNG.technik = "Kein Netz";
            } else {
                STEUERUNG.zustand = "fehler";
                STEUERUNG.technik = String(fehler && fehler.message || fehler);
            }
        }
        STEUERUNG._melden();
    },

    /* Nur die Marke fragen; neuer als der eigene Stand → neu laden. Nicht, solange etwas wartet. */
    async pruefen() {
        const speicher = STEUERUNG._speicher();
        if (!STEUERUNG.kasseId || !speicher || WARTESCHLANGE.anzahl() > 0) {
            return;
        }
        if (typeof document !== "undefined" && document.hidden) {
            return;
        }
        try {
            const marke = await speicher.marke(STEUERUNG.kasseId);
            if (!STEUERUNG.stand || marke !== STEUERUNG.stand.geaendertAm) {
                await STEUERUNG.laden();
            }
        } catch (fehler) {
            if (STEUERUNG._istNetz(fehler)) {
                STEUERUNG._offline(true);
            }
        }
    },

    taktStarten() {
        if (STEUERUNG.takt || typeof setInterval === "undefined") {
            return;
        }
        STEUERUNG.takt = setInterval(() => { STEUERUNG.pruefen(); }, KONFIG.abfrageIntervallMs);
    },

    /* ---------------------------------------------------------------- *
     * Kasse anlegen, beitreten, verlassen
     * ---------------------------------------------------------------- */

    async anlegen(name) {
        const speicher = STEUERUNG._speicher();
        const uid = STEUERUNG._uid();
        const neu = KASSE.anlegen({ name: name, uid: uid, mitgliedName: STEUERUNG._mitgliedName(), zeit: STEUERUNG.jetzt(), zufall: STEUERUNG.zufall });
        if (!neu || !speicher) {
            return { ok: false, feld: "name", text: "Name fehlt" };
        }
        try {
            await speicher.kasseAnlegen(neu.kasseId, neu.stand);
        } catch (fehler) {
            return STEUERUNG._absage(fehler);
        }
        STEUERUNG.kasseId = neu.kasseId;
        STEUERUNG.stand = neu.stand;
        STEUERUNG.zustand = "ok";
        STEUERUNG.technik = "";
        STEUERUNG.merken();
        STEUERUNG._gespeichert();
        STEUERUNG._melden();
        return { ok: true };
    },

    async beitreten(eingabe) {
        const speicher = STEUERUNG._speicher();
        const uid = STEUERUNG._uid();
        const code = KASSE.codePruefen(eingabe);
        if (!code) {
            return { ok: false, feld: "code", text: "Sechs Zeichen" };
        }
        if (!speicher || !uid) {
            return { ok: false, feld: "code", text: "Nicht angemeldet" };
        }
        let kasseId = null;
        try {
            kasseId = await speicher.kasseFinden(code);
        } catch (fehler) {
            return STEUERUNG._absage(fehler);
        }
        if (!kasseId) {
            return { ok: false, feld: "code", text: "Code unbekannt" };
        }
        const beitritt = KASSE.beitreten(null, uid, STEUERUNG._mitgliedName(), STEUERUNG.jetzt());
        try {
            await speicher.aendern(kasseId, beitritt.aenderungen);
        } catch (fehler) {
            return STEUERUNG._absage(fehler);
        }
        STEUERUNG.kasseId = kasseId;
        STEUERUNG.stand = null;
        STEUERUNG.zustand = "laden";
        STEUERUNG.merken();
        STEUERUNG._melden();
        await STEUERUNG.laden();
        return { ok: STEUERUNG.zustand !== "fehler", text: STEUERUNG.technik };
    },

    /* Den eigenen Mitglieds-Knoten löschen; die Kasse bleibt für die anderen. */
    async verlassen() {
        const speicher = STEUERUNG._speicher();
        const uid = STEUERUNG._uid();
        if (!STEUERUNG.kasseId || !speicher || !uid) {
            STEUERUNG.vergessen();
            return { ok: true };
        }
        const aenderungen = { ["mitglieder/" + uid]: null, geaendertAm: KASSE._marke(STEUERUNG.stand, STEUERUNG.jetzt()) };
        try {
            await speicher.aendern(STEUERUNG.kasseId, aenderungen);
        } catch (fehler) {
            return STEUERUNG._absage(fehler);
        }
        WARTESCHLANGE.leeren();
        STEUERUNG.vergessen();
        return { ok: true };
    },

    _absage(fehler) {
        if (STEUERUNG._istNetz(fehler)) {
            STEUERUNG._offline(true);
            return { ok: false, feld: "allgemein", text: "Kein Netz", netz: true };
        }
        return { ok: false, feld: "allgemein", text: "Abgelehnt", technik: String(fehler && fehler.message || fehler) };
    },

    /* ---------------------------------------------------------------- *
     * Änderungen an der Kasse — sofort anzeigen, dann senden
     * ---------------------------------------------------------------- */

    /* `nichtWarten`: das Senden läuft hinterher (seit 0.8.0 beim „+“ — die Kurz-Leiste soll
       sofort stehen, nicht erst, wenn die Datenbank geantwortet hat). */
    async _anwenden(ergebnis, kennung, nichtWarten) {
        if (!ergebnis) {
            return false;
        }
        STEUERUNG.stand = ergebnis.stand;
        STEUERUNG.zustand = "ok";
        STEUERUNG.merken();
        STEUERUNG._melden();
        WARTESCHLANGE.einreihen(kennung, SpeicherKasse.praefix(STEUERUNG.kasseId, ergebnis.aenderungen));
        if (typeof APP !== "undefined") {
            APP.zustand = "wartet";
        }
        if (nichtWarten) {
            STEUERUNG.nachsenden().catch((fehler) => console.error("Kaffekasse: Senden", fehler));
            return true;
        }
        await STEUERUNG.nachsenden();
        return true;
    },

    /* „+“: EIN Tipp legt die Packung an. → die Kennung des neuen Eintrags (für die
       Vorbelegung danach) oder "" bei Ablehnung. */
    async kaufen(produktId, menge) {
        const uid = STEUERUNG._uid();
        const e = KASSE.kaufEintragen(STEUERUNG.stand, produktId, uid, STEUERUNG.jetzt(), STEUERUNG.zufall, menge || 1);
        const ok = await STEUERUNG._anwenden(e, e ? "eintrag:" + e.eintragId : "", true);
        return ok ? e.eintragId : "";
    },

    /* Laden · Angebot · MHD aus dem letzten Kauf (seit 0.7.0); null ohne Vorlage. */
    vorbelegung(eintragId) {
        return STEUERUNG.stand ? BESTAND.vorbelegung(STEUERUNG.stand, eintragId) : null;
    },

    /* Die Vorbelegung mit einem Tipp übernehmen (mit oder ohne Angebot). */
    async vorbelegungUebernehmen(eintragId, angebot) {
        const felder = BESTAND.felder(STEUERUNG.vorbelegung(eintragId), angebot);
        return STEUERUNG.packungAendern(eintragId, felder);
    },

    darfZuruecknehmen(eintrag) {
        return KASSE.ruecknahmeErlaubt(eintrag, STEUERUNG._uid(), STEUERUNG.jetzt(), KONFIG.ruecknahmeMinuten);
    },

    async zuruecknehmen(eintragId) {
        const e = KASSE.zuruecknehmen(STEUERUNG.stand, eintragId, STEUERUNG._uid(), STEUERUNG.jetzt(), KONFIG.ruecknahmeMinuten);
        return STEUERUNG._anwenden(e, "ruecknahme:" + eintragId);
    },

    /* Packung ändern (Kaufdatum, Preis, geöffnet, leer). → { ok, text }; die Rechte prüft das
       Modell. Jede Änderung bekommt ihre eigene Kennung in der Warteschlange — zwei Änderungen
       derselben Packung dürfen sich dort nicht ersetzen (die zweite trägt nur ihre Felder). */
    async packungAendern(eintragId, felder) {
        const uid = STEUERUNG._uid();
        const jetzt = STEUERUNG.jetzt();
        const fehler = KASSE.packungFehler(STEUERUNG.stand, eintragId, felder, uid, jetzt);
        if (fehler) {
            return { ok: false, text: fehler };
        }
        const e = KASSE.packungAendern(STEUERUNG.stand, eintragId, felder, uid, jetzt);
        if (!e || Object.keys(e.aenderungen).length === 0) {
            return { ok: true };
        }
        await STEUERUNG._anwenden(e, "packung:" + eintragId + ":" + jetzt);
        return { ok: true };
    },

    darfKaufAendern(eintrag) {
        return KASSE.darfKaufAendern(STEUERUNG.stand, eintrag, STEUERUNG._uid());
    },

    darfZustandAendern(eintrag) {
        return KASSE.darfZustandAendern(STEUERUNG.stand, eintrag, STEUERUNG._uid());
    },

    async produktAnlegen(felder) {
        const e = KASSE.produktAnlegen(STEUERUNG.stand, felder, STEUERUNG._uid(), STEUERUNG.jetzt(), STEUERUNG.zufall);
        return STEUERUNG._anwenden(e, e ? "produkt:" + e.produktId : "");
    },

    /* Name / nach dem Öffnen haltbar (0.8.0). → true, false bei Ablehnung. */
    async produktAendern(produktId, felder) {
        const e = KASSE.produktAendern(STEUERUNG.stand, produktId, felder, STEUERUNG._uid(), STEUERUNG.jetzt());
        if (e && Object.keys(e.aenderungen).length === 0) {
            return true;
        }
        return STEUERUNG._anwenden(e, e ? "produkt-aendern:" + produktId + ":" + STEUERUNG.jetzt() : "");
    },

    async produktAusblenden(produktId) {
        const e = KASSE.produktAusblenden(STEUERUNG.stand, produktId, STEUERUNG._uid(), STEUERUNG.jetzt());
        return STEUERUNG._anwenden(e, "produkt-aus:" + produktId);
    },

    /* Der letzte eigene, gültige Eintrag zu einem Produkt, falls er noch zurückgenommen werden darf. */
    eigenerLetzter(produktId) {
        const uid = STEUERUNG._uid();
        if (!STEUERUNG.stand || !uid) {
            return null;
        }
        const eigene = KASSE.eintraegeVon(STEUERUNG.stand, { produktId: produktId }).filter((e) => e.wer === uid);
        return (eigene.length && STEUERUNG.darfZuruecknehmen(eigene[0])) ? eigene[0] : null;
    },

    /* ---------------------------------------------------------------- *
     * Nachsenden
     * ---------------------------------------------------------------- */

    async nachsenden() {
        const speicher = STEUERUNG._speicher();
        if (!speicher) {
            return;
        }
        const vorher = WARTESCHLANGE.anzahl();
        const e = await WARTESCHLANGE.nachsenden((aenderungen) => speicher.teilSchreiben(aenderungen), STEUERUNG._istNetz);
        if (e.netzFehler) {
            STEUERUNG._offline(true);
        } else if (e.offen === 0 && vorher > 0) {
            STEUERUNG._gespeichert();
            if (typeof UPCREW_OFFLINE !== "undefined") {
                UPCREW_OFFLINE.hochgeladen();
            }
        } else if (e.offen > 0 && typeof APP !== "undefined") {
            APP.zustand = "wartet";
        }
        if (e.verworfen > 0) {
            console.error("Kaffekasse: " + e.verworfen + " Änderung(en) endgültig abgelehnt");
        }
        if (e.gesendet > 0 || e.verworfen > 0 || e.netzFehler) {
            STEUERUNG._melden();
        }
        STEUERUNG._wiederVersuchPlanen();
    },

    /* Bleibt etwas liegen, kommt der nächste Versuch von selbst, sobald die kürzeste
       Wartezeit um ist (dazu weiter: online-Ereignis, Sichtbarkeit, nächster Start). */
    wiederVersuch: null,

    _wiederVersuchPlanen() {
        if (STEUERUNG.wiederVersuch) {
            clearTimeout(STEUERUNG.wiederVersuch);
            STEUERUNG.wiederVersuch = null;
        }
        const liste = WARTESCHLANGE.lesen();
        if (liste.length === 0 || typeof setTimeout === "undefined") {
            return;
        }
        const jetzt = STEUERUNG.jetzt();
        const naechster = liste.reduce((a, e) => Math.min(a, Number(e.ab) || 0), Infinity);
        const inMs = Math.max(1000, naechster - jetzt);
        STEUERUNG.wiederVersuch = setTimeout(() => {
            STEUERUNG.wiederVersuch = null;
            STEUERUNG.nachsenden();
        }, inMs);
    },

    _gespeichert() {
        if (typeof APP !== "undefined") {
            APP.zustand = "gespeichert";
        }
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = STEUERUNG;
}
