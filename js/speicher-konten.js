/*
 * speicher-konten.js — die Rückwand der UPCrew-Konten, gleich in jedem UPCrew-Spiel.
 * Gemeinsamer Baustein: in die Apps KOPIEREN, nie abwandeln (Liste: BAUSTEINE.json).
 *
 * Seit 03.10.2026 eine eigene Datei. Bis dahin stand die Klasse zweimal, in Blunderlucks und in
 * Typolucks js\speicher.js, Zeile für Zeile gleich; Typolucks Tests verglichen sie gegen
 * Blunderluck. An der Klasse selbst wurde beim Herausziehen nichts geändert. Versionsangaben in den
 * Kommentaren („seit v0.138.0“) meinen Blunderluck.
 *
 * BRAUCHT: `SpeicherGemeinsam` aus js\speicher.js des Spiels (Basisklasse) — diese Datei wird also
 * NACH js\speicher.js geladen. `speicherErzeugen` dort darf `SpeicherKonten` trotzdem nennen: Es
 * läuft erst, wenn alle Dateien geladen sind. Zur Laufzeit dazu: `KONTO` (js\konto.js) und
 * `FORTSCHRITT` (js\fortschritt.js).
 *
 * DER SCHALTER `REGEL_GRAU_EINGESPIELT` sagt, ob die Datenbank-Regel §13 eingespielt ist. Es gibt
 * EINE Datenbank für alle Spiele, also auch nur EINEN Schalter — hier.
 */

/* ------------------------------------------------------------------ *
 * Rückwand 3: die UPCrew-Konten (seit v0.138.0)
 *
 * WARUM EINE EIGENE RÜCKWAND: Bis v0.137.0 lag die Spielerliste als EINE
 * Liste unter `spieler` und wurde als Ganzes geschrieben (PUT). Die Regeln
 * der UPCrew-Datenbank lassen aber jeden nur seinen EIGENEN Eintrag
 * schreiben — das geht nur, wenn jeder Eintrag seinen eigenen Knoten hat:
 *
 *     spieler/
 *         geaendertAm: 1750000000000        (die Marke, wie bisher)
 *         konten/
 *             <uid>: { id, name, uid, kennung, freunde, abgelehnt, … }
 *
 * `<uid>` ist die Konto-Nummer von Firebase (js\konto.js). Der Rest der
 * App merkt davon nichts: `laden` macht aus den Knoten die gewohnte Liste
 * (`SPIELER.normalisieren` bleibt die eine Nachrüst-Stelle), `speichern`
 * schreibt aus der Liste nur den eigenen Eintrag — und nur, wenn er sich
 * gegenüber dem Server geändert hat. Fremde Einträge ändert allein
 * `eintragSetzen`, und das nur mit den Rechten, die die Regeln geben
 * (eigener Eintrag, Admin, freigegebenes Konto).
 *
 * Passwort-Prüfsummen schreibt diese Rückwand NIE — sie nimmt `pinPruefwert`
 * und `pinSalz` heraus, und die Regeln lehnen einen Eintrag mit ihnen ab.
 * ------------------------------------------------------------------ */

class SpeicherKonten extends SpeicherGemeinsam {

    /* `eigeneUid()` liefert die Konto-Nummer dieses Geräts oder null. */
    constructor(basis, pfad, aufbereiten, eigeneUid) {
        super(basis, pfad, aufbereiten);
        this.eigeneUid = eigeneUid;

        /* Der eigene Eintrag, wie er zuletzt auf dem Server stand (als
           Text) — nur was davon abweicht, wird geschrieben. */
        this.zuletzt = null;
    }

    /* Aus den Knoten die gewohnte Liste — sortiert nach Konto-Nummer, damit
       jedes Gerät dieselbe Reihenfolge sieht (`inhaltGleich` vergleicht der
       Reihe nach). */
    static alsListe(roh) {
        if (!roh || typeof roh !== "object") {
            return null;
        }

        const stand = {};
        for (const schluessel of Object.keys(roh)) {
            if (schluessel !== "konten") {
                stand[schluessel] = roh[schluessel];
            }
        }

        const konten = (roh.konten && typeof roh.konten === "object") ? roh.konten : {};
        stand.spieler = Object.keys(konten).sort()
            .filter((uid) => konten[uid] && typeof konten[uid] === "object")
            .map((uid) => Object.assign({}, konten[uid], { uid: uid }));
        return stand;
    }

    /*
     * Ein Eintrag, wie er auf den Server darf: ohne Passwort-Prüfsummen, und
     * (seit v0.151.1, Regel §11a + §11b eingespielt am 27.09.2026) die Felder
     * `aussehen` und `fortschritt` nur so, wie die Regel sie erlaubt.
     * WARUM HIER: Blunderluck schreibt immer den GANZEN Konto-Eintrag. Ein
     * einziges Feld ausserhalb der Regel, und die Datenbank lehnt alles ab —
     * auch Freunde und Abzeichen. Das ist die eine Stelle, durch die jeder
     * Schreibvorgang eines Konto-Eintrags geht (`speichern`, `eintragSetzen`).
     */
    static eintragFuerServer(spieler) {
        const eintrag = JSON.parse(JSON.stringify(spieler));
        delete eintrag.pinPruefwert;
        delete eintrag.pinSalz;
        if (eintrag.aussehen !== undefined) {
            const aussehen = SpeicherKonten.aussehenFuerRegel(eintrag.aussehen);
            if (aussehen) {
                eintrag.aussehen = aussehen;
            } else {
                delete eintrag.aussehen;
            }
        }
        /* Das Aussehen je Spiel (seit v0.151.17, Regel §11c): nur die zwei
           Spiele, je Spiel nur die sechs Felder. */
        if (eintrag.aussehenJe !== undefined) {
            const je = {};
            const roh = (eintrag.aussehenJe && typeof eintrag.aussehenJe === "object") ? eintrag.aussehenJe : {};
            for (const app of ["blunderluck", "typoluck"]) {
                const sauber = SpeicherKonten.aussehenFuerRegel(roh[app]);
                if (sauber) {
                    je[app] = sauber;
                }
            }
            if (Object.keys(je).length > 0) {
                eintrag.aussehenJe = je;
            } else {
                delete eintrag.aussehenJe;
            }
        }
        /* Der Haken „Spielzeit öffentlich" (seit v0.155.2): nur Ja/Nein
           (Regel §14 `spielzeitOeffentlich`). */
        if ("spielzeitOeffentlich" in eintrag && typeof eintrag.spielzeitOeffentlich !== "boolean") {
            delete eintrag.spielzeitOeffentlich;
        }
        if (eintrag.fortschritt && typeof eintrag.fortschritt === "object"
                && typeof FORTSCHRITT !== "undefined" && typeof FORTSCHRITT.fuerKonto === "function") {
            eintrag.fortschritt = FORTSCHRITT.fuerKonto(eintrag.fortschritt);
        }
        return eintrag;
    }

    /*
     * DIE WERTE DER REGEL §11a (SICHERHEIT.md) — dieselben wie `WAHL` in
     * js\upcrew-aussehen.js; `test-konto-regel.js` prüft, dass Regel,
     * Baustein und diese Liste übereinstimmen.
     */
    static get REGEL_AUSSEHEN() {
        return {
            darstellung: ["geraet", "hell", "dunkel"],
            farbwelt: ["grau", "werkstatt", "studio", "feld", "tiefsee", "gold"],
            schrift: ["S1", "S2", "S3", "S4", "S5", "S6"],
            knoepfe: ["K1", "K2", "K3", "K4", "K5", "K6"]
        };
    }

    /*
     * DIE REGEL MIT GRAU (seit v0.159.0,
     * Regeltext SICHERHEIT.md Abschnitt 15 = Regel mit 13):
     * Sie erlaubt `farbwelt: "grau"` und das Feld `umstellung` (Merker der
     * einmaligen Umstellung, 0–9). EINGESPIELT am 30.09.2026 (Regel §13,
     * Entscheid „REGEL §13 LIVE") — der Schalter steht deshalb AN. Aus
     * (false) liesse die Schleuse beides weg; das war nur nötig, solange die
     * alte Regel den GANZEN Konto-Eintrag abgelehnt hätte.
     */
    static get REGEL_GRAU_EINGESPIELT() {
        return true;
    }

    /* Nur die sechs Felder mit erlaubten Werten (dazu `umstellung`, sobald
       die Regel mit Grau gilt) — oder null, wenn nichts Gültiges übrig
       bleibt. `grau` (Test) überstimmt den Schalter. */
    static aussehenFuerRegel(roh, grau) {
        if (!roh || typeof roh !== "object" || Array.isArray(roh)) {
            return null;
        }
        const erlaubt = SpeicherKonten.REGEL_AUSSEHEN;
        const mitGrau = typeof grau === "boolean" ? grau : SpeicherKonten.REGEL_GRAU_EINGESPIELT;
        const aus = {};
        for (const feld of Object.keys(erlaubt)) {
            if (erlaubt[feld].indexOf(roh[feld]) !== -1
                    && (mitGrau || feld !== "farbwelt" || roh[feld] !== "grau")) {
                aus[feld] = roh[feld];
            }
        }
        if (mitGrau && Number.isInteger(roh.umstellung) && roh.umstellung >= 0 && roh.umstellung <= 9) {
            aus.umstellung = roh.umstellung;
        }
        if (typeof roh.leseschrift === "boolean") {
            aus.leseschrift = roh.leseschrift;
        }
        if (typeof roh.stand === "number" && isFinite(roh.stand) && roh.stand >= 0) {
            aus.stand = roh.stand;
        }
        return Object.keys(aus).length > 0 ? aus : null;
    }

    /*
     * LADEN — UNTER BEIDEN REGELN (seit v0.154.0, Regel §12 Phase A,
     * Datenbank-Konzept 12, Abschnitt 4).
     *
     * Beim ersten Laden fragt `KONTO.regelErkennen`, welche Regel gilt.
     *   alt  — wie bisher: der ganze Knoten `spieler`.
     *   §12  — `geaendertAm` und `rollen`; dann
     *          Admins/UP#Plus: `konten` ganz und `namen` (Verwaltung);
     *          alle anderen: `oeffentlich` (fremde Auszüge) und nur
     *          `konten/<ich>` (der eigene, volle Eintrag);
     *          nicht angemeldet: keine Spieler.
     * Antwortet die Datenbank mit 401, wird die Regel neu erkannt und
     * einmal auf dem anderen Weg geladen. Das Ergebnis hat in beiden Fällen
     * dieselbe Form (`alsListe`); fremde Einträge tragen unter §12 statt
     * `fortschritt`, `tag`, `kennung` nur `auszug`.
     */
    async laden() {
        /* Nur das ERSTE Laden darf den früh geholten Eintrag nehmen (kern\wer-spielt.js); danach ist er weg. */
        const start = !this._startGeladen;
        this._startGeladen = true;
        try {
            return await this._ladenInnen(start);
        } finally {
            const merker = start ? SpeicherKonten._merker() : null;
            if (merker) {
                merker.verwerfen();
            }
        }
    }

    async _ladenInnen(start) {
        const regeln = (typeof KONTO !== "undefined" && typeof KONTO.regelErkennen === "function");
        if (regeln && !KONTO.regelBekannt) {
            await KONTO.regelErkennen();
        }
        let roh;
        try {
            roh = await this._rohLaden(start);
        } catch (fehler) {
            if (!regeln || !fehler || fehler.status !== 401) {
                throw fehler;
            }
            const vorher = KONTO.regel;
            await KONTO.regelErkennen();
            if (KONTO.regel === vorher) {
                throw fehler;
            }
            roh = await this._rohLaden(false);
        }
        const daten = this.aufbereiten(SpeicherKonten.alsListe(roh));
        this._merken(daten);
        if (regeln && KONTO.istP12()) {
            this._selbstEintragen(daten);
        }
        return daten;
    }

    async _rohLaden(start) {
        if (typeof KONTO !== "undefined" && typeof KONTO.istP12 === "function" && KONTO.istP12()) {
            return this._ladenP12(start);
        }
        const antwort = await this._rufen({ cache: "no-store" },
            SpeicherGemeinsam.ZEITLIMIT_LADEN_MS, "Das Laden");
        if (!antwort.ok) {
            throw SpeicherKonten._fehler("Laden fehlgeschlagen", antwort.status);
        }
        return antwort.json();
    }

    static _fehler(text, status) {
        const fehler = new Error(text + " (HTTP " + status + ")");
        fehler.status = status;
        return fehler;
    }

    /*
     * KEIN DOPPELTES LADEN, NIE EIN ALTER STAND (seit 04.10.2026,
     * kern\wer-spielt.js): Hat das Spiel beim Intro den eigenen Eintrag
     * schon früh geholt, nimmt NUR das ERSTE `laden()` dieser Rückwand
     * `konten/<eigene uid>` daraus — läuft der frühe Abruf noch, wartet es
     * auf ihn statt ein zweites Mal zu holen. Nach diesem ersten Laden und
     * bei JEDEM Schreiben ist der Merker weg; `teilLaden`, `_teilHolen` und
     * jedes spätere `laden()` (auch das vor dem Schreiben) holen immer
     * frisch. Ohne den Baustein ändert sich nichts.
     */
    static _merker() {
        return (typeof UPCREW_WER_SPIELT !== "undefined" && UPCREW_WER_SPIELT
            && typeof UPCREW_WER_SPIELT.uebernehmen === "function") ? UPCREW_WER_SPIELT : null;
    }

    async _eigenenHolen(uid, start) {
        const merker = start ? SpeicherKonten._merker() : null;
        if (merker) {
            const geholt = await merker.uebernehmen("konten/" + uid, uid);
            if (geholt) {
                return geholt.wert;
            }
        }
        return this._teilHolen("konten/" + uid);
    }

    /* Jedes Schreiben über diese Rückwand (auch `speichern`, `eintragSetzen`,
       der eigene Auszug) macht den frühen Eintrag ungültig. */
    async teilSchreiben(aenderungen) {
        const merker = SpeicherKonten._merker();
        if (merker) {
            merker.verwerfen();
        }
        return super.teilSchreiben(aenderungen);
    }

    /* Einen Unterknoten holen — null, wenn es ihn nicht gibt; wirft mit
       `status` bei einer Absage (401 = Regel lässt es nicht zu). */
    async _teilHolen(unterpfad) {
        const ziel = this.basis + "/" + this.pfad + "/" + unterpfad + ".json";
        const antwort = await this._rufen({ cache: "no-store" },
            SpeicherGemeinsam.ZEITLIMIT_LADEN_MS, "Das Laden", ziel);
        if (!antwort.ok) {
            throw SpeicherKonten._fehler("Laden fehlgeschlagen", antwort.status);
        }
        return antwort.json();
    }

    async _ladenP12(start) {
        const uid = this.eigeneUid ? this.eigeneUid() : null;
        const [marke, rollen] = await Promise.all([this._teilHolen(SpeicherGemeinsam.MARKEN_FELD),
            this._teilHolen("rollen")]);
        const roh = { rollen: (rollen && typeof rollen === "object") ? rollen : {} };
        if (typeof marke === "number") {
            roh[SpeicherGemeinsam.MARKEN_FELD] = marke;
        }
        if (!uid) {
            roh.konten = {};
            return roh;
        }
        if (KONTO.istAdmin(roh, uid)) {
            const [konten, namen, meinAuszug] = await Promise.all([this._teilHolen("konten"),
                this._teilHolen("namen"), this._teilHolen("oeffentlich/" + uid)]);
            roh.konten = (konten && typeof konten === "object") ? konten : {};
            roh.namen = (namen && typeof namen === "object") ? namen : {};
            this._oeffentlichVomServer = meinAuszug || null;
            return roh;
        }
        const [oeffentlich, eigen] = await Promise.all([this._teilHolen("oeffentlich"),
            this._eigenenHolen(uid, start)]);
        roh.konten = {};
        const fremde = (oeffentlich && typeof oeffentlich === "object") ? oeffentlich : {};
        this._oeffentlichVomServer = fremde[uid] || null;
        for (const andere of Object.keys(fremde)) {
            if (fremde[andere] && typeof fremde[andere] === "object") {
                roh.konten[andere] = fremde[andere];
            }
        }
        if (eigen && typeof eigen === "object") {
            roh.konten[uid] = eigen;
        }
        return roh;
    }

    /* Den eigenen Auszug sofort neu schreiben (seit v0.155.0: nach dem
       Umschalten „Spielzeit öffentlich"). Unter der alten Regel nichts. */
    oeffentlichNeu(daten) {
        if (typeof KONTO === "undefined" || typeof KONTO.istP12 !== "function" || !KONTO.istP12()) {
            return Promise.resolve();
        }
        this._eingetragen = false;
        this.zuletztOeffentlich = null;
        /* Was zuletzt vom Server kam, kann veraltet sein — sicher schreiben. */
        this._oeffentlichVomServer = { neu: true };
        return this._selbstEintragen(daten);
    }

    /*
     * Unter §12 trägt sich jedes Konto beim ersten Laden je Sitzung selbst
     * in `oeffentlich` und das Anmeldeverzeichnis ein, wenn dort etwas
     * fehlt oder abweicht (Konzept Phase A: „UP#Plus trägt sich beim ersten
     * Start im Modus §12 selbst ein" — und jeder andere auch). Still, im
     * Hintergrund; ein Fehler wird beim nächsten Start wiederholt.
     */
    async _selbstEintragen(daten) {
        if (this._eingetragen) {
            return;
        }
        const eigener = this._eigener(daten);
        if (!eigener || !KONTO.angemeldet()) {
            return;
        }
        this._eingetragen = true;
        try {
            const eintrag = Object.assign(SpeicherKonten.eintragFuerServer(eigener), { uid: eigener.uid });
            const pfade = KONTO.oeffentlichePfade(eintrag, null);
            const soll = KONTO.anmeldungVon(eintrag);
            const verzeichnis = soll ? await KONTO.verzeichnisLesen(eintrag.name) : [];
            if (verzeichnis === null) {
                this._eingetragen = false;
                return;
            }
            const ist = verzeichnis.find((zeile) => zeile.uid === eintrag.uid) || null;
            const verzeichnisPasst = !soll
                || (!!ist && ist.k === soll.k && ist.f === (soll.f === true));
            const text = JSON.stringify(pfade);
            if (verzeichnisPasst && KONTO._gleich(this._oeffentlichVomServer,
                    pfade["oeffentlich/" + eintrag.uid])) {
                this.zuletztOeffentlich = text;
                return;
            }
            pfade[SpeicherGemeinsam.MARKEN_FELD] = Date.now();
            await this.teilSchreiben(pfade);
            this.zuletztOeffentlich = text;
        } catch (fehler) {
            this._eingetragen = false;
        }
    }

    _eigener(daten) {
        const uid = this.eigeneUid ? this.eigeneUid() : null;
        if (!uid || !daten || !Array.isArray(daten.spieler)) {
            return null;
        }
        return daten.spieler.find((spieler) => spieler.uid === uid) || null;
    }

    _merken(daten) {
        const eigener = this._eigener(daten);
        this.zuletzt = eigener
            ? JSON.stringify(SpeicherKonten.eintragFuerServer(eigener)) : null;
    }

    async speichern(daten) {
        const eigener = this._eigener(daten);
        if (!eigener) {
            /* Ohne eigenen Eintrag gibt es nichts, was dieses Gerät
               schreiben dürfte. */
            return;
        }

        const eintrag = SpeicherKonten.eintragFuerServer(eigener);
        const text = JSON.stringify(eintrag);
        if (text === this.zuletzt) {
            return;
        }

        const aenderungen = {};
        aenderungen["konten/" + eigener.uid] = eintrag;

        /* Regel §12 (seit v0.154.0): Auszug und Verzeichnis-Eintrag im
           SELBEN Schritt — aber nur, wenn sie sich geändert haben, und nur
           dann zieht auch die Marke hoch (Konzept §4: „Marke nur, wenn sich
           der Auszug ändert"). Unter der alten Regel wie bisher. */
        let oeffentlichText = null;
        if (typeof KONTO !== "undefined" && typeof KONTO.istP12 === "function" && KONTO.istP12()) {
            const pfade = KONTO.oeffentlichePfade(Object.assign({}, eintrag, { uid: eigener.uid }), null);
            oeffentlichText = JSON.stringify(pfade);
            if (oeffentlichText !== this.zuletztOeffentlich) {
                Object.assign(aenderungen, pfade);
                aenderungen[SpeicherGemeinsam.MARKEN_FELD] = Date.now();
            }
        } else {
            aenderungen[SpeicherGemeinsam.MARKEN_FELD] = Date.now();
        }
        try {
            await this.teilSchreiben(aenderungen);
        } catch (fehler) {
            /* Eine Absage (401) kann heissen: Die Regel hat gewechselt. Beim
               nächsten Laden wird neu erkannt. */
            if (typeof KONTO !== "undefined" && /HTTP 401/.test(String(fehler && fehler.message))) {
                KONTO.regelBekannt = false;
            }
            throw fehler;
        }
        this.zuletzt = text;
        if (oeffentlichText !== null) {
            this.zuletztOeffentlich = oeffentlichText;
        }
    }

    /*
     * Einen Eintrag gezielt setzen oder mit `null` löschen — für die Fälle,
     * die absichtlich einen FREMDEN Eintrag betreffen (Verwaltung) oder den
     * eigenen entfernen (Konto löschen). `weitere` sind zusätzliche Knoten
     * im selben Schritt (Neu-Verbinden: neuer Eintrag und alter weg, beides
     * oder keins).
     */
    async eintragSetzen(uid, eintrag, weitere) {
        const aenderungen = Object.assign({}, weitere || {});
        aenderungen["konten/" + uid] = (eintrag === null)
            ? null : SpeicherKonten.eintragFuerServer(eintrag);
        /* Regel §12 (seit v0.154.0): Auszug und Verzeichnis ziehen mit. */
        if (typeof KONTO !== "undefined" && typeof KONTO.istP12 === "function" && KONTO.istP12()) {
            if (eintrag === null) {
                aenderungen["oeffentlich/" + uid] = null;
            } else {
                Object.assign(aenderungen, KONTO.oeffentlichePfade(
                    Object.assign({}, aenderungen["konten/" + uid], { uid: uid }), null));
            }
        }
        aenderungen[SpeicherGemeinsam.MARKEN_FELD] = Date.now();
        await this.teilSchreiben(aenderungen);

        if (this.eigeneUid && uid === this.eigeneUid()) {
            this.zuletzt = (eintrag === null)
                ? null : JSON.stringify(SpeicherKonten.eintragFuerServer(eintrag));
        }
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { SpeicherKonten };
}
