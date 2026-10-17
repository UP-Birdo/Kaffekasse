/*
 * app.js — der Start und das Zusammenspiel. Wird als letzte Datei geladen.
 *
 * Reihenfolge in `starten` (Vorbild: EINBAU-INTRO-WER-SPIELT.md der Bausteine):
 *   1. `window.KAFFEKASSE_GESTARTET = true` — ZUERST, daran hängt der Notfall-Weg in
 *      index.html (nach 10 s ohne diesen Merker zeigt er eine schlichte Meldung).
 *   2. `KONTO.einrichten(KONFIG)` — das UPCrew-Konto kennt Datenbank und Schlüssel.
 *   3. `speicherErzeugen()` — die Rückwände (Konten; der Bereich `kaffekasse` ab Stufe 2).
 *   4. Leiste, Band, Blätter einrichten; Offline-Baustein lauscht auf online/offline.
 *   5. Das Studio-Intro; danach Anmeldung oder App.
 *
 * Ohne `werSpielt`: Kaffekasse hat keinen Fortschritt und keinen Besitz (Frage 2 der
 * Entscheidungen), der Kern-Baustein wer-spielt.js ist nicht verteilt.
 */

const APP = {

    speicher: null,
    daten: null,            /* die Konten-Liste (SPIELER.normalisieren), null bis geladen */
    zustand: "wartet",      /* Speicher-Lampe: "gespeichert" | "wartet" | "offline" */
    bereit: false,          /* true, sobald die App (nicht die Anmeldung) zu sehen ist */

    /* Ein Einladungslink (`?code=ABC234`, 0.10.0): gelesen beim Start, danach aus der Adresse
       genommen (sonst holte jedes Neuladen die Einladung wieder hervor); eingelöst nach der
       Anmeldung in appZeigen. */
    einladung: "",

    einladungLesen() {
        const code = KASSE_BLATT.codeAusAdresse(location.href);
        if (!code) {
            return;
        }
        APP.einladung = code;
        try {
            const adresse = new URL(location.href);
            adresse.searchParams.delete("code");
            history.replaceState(history.state, "", adresse.pathname + adresse.search + adresse.hash);
        } catch (fehler) {
            /* in einem Vorschau-Rahmen darf das scheitern — die Einladung gilt trotzdem */
        }
    },

    async einladungEinloesen() {
        const code = APP.einladung;
        APP.einladung = "";
        if (!code) {
            return false;
        }
        const e = await STEUERUNG.beitreten(code);
        NAVIGATION.wechseln("start");
        if (!e.ok) {
            await DIALOG.hinweis({ titel: "Einladung", text: e.text || "Abgelehnt" });
        } else if (!e.schonDrin && STEUERUNG.stand) {
            await DIALOG.hinweis({ titel: STEUERUNG.stand.name, text: "Beigetreten" });
        }
        return true;
    },

    starten() {
        window.KAFFEKASSE_GESTARTET = true;
        APP.einladungLesen();

        KONTO.einrichten(KONFIG);
        KONTO.beiVerloren = () => APP.sitzungVerloren();
        APP.speicher = speicherErzeugen();
        APP.werkstattEinrichten();
        APP.kontoEinrichten();
        STEUERUNG.einrichten();

        NAVIGATION.einrichten({
            leiste: document.getElementById("leiste"),
            band: document.getElementById("band"),
            ebenen: document.getElementById("ebenen"),
            bildschirme: { start: START, statistik: STATISTIK, produkte: PRODUKTE },
            erlaubt: () => APP.bereit
        });
        /* Die Einstellungen sind seit 0.6.0 ein Blatt: offen → mit der Kasse mitziehen. */
        STEUERUNG.beobachten(() => EINSTELLUNGEN.auffrischen());
        APP.freigabeEinrichten();

        if (typeof UPCREW_OFFLINE !== "undefined") {
            UPCREW_OFFLINE.lauschen();
        }
        /* Android/Chrome: das Installieren-Angebot früh abfangen (Baustein upcrew-homescreen, 0.10.0). */
        if (typeof UPCREW_HOMESCREEN !== "undefined") {
            UPCREW_HOMESCREEN.lauschen();
        }

        APP.dienstAnmelden();

        const intro = document.getElementById("intro");
        const aussehen = (typeof UPCREW_AUSSEHEN !== "undefined") ? UPCREW_AUSSEHEN.lesen() : null;
        let introFertig = Promise.resolve(null);
        if (typeof UPCREW_INTRO !== "undefined" && intro) {
            introFertig = UPCREW_INTRO.zeigen(intro, {
                modus: (typeof UPCREW_AUSSEHEN !== "undefined") ? UPCREW_AUSSEHEN.modus() : "dunkel",
                welt: aussehen ? aussehen.farbwelt : undefined,
                app: { nr: KONFIG.INTRO_NR, name: KONFIG.APP_NAME, version: KONFIG.APP_VERSION }
            });
        }
        introFertig.then(() => APP.nachIntro(), () => APP.nachIntro());
    },

    nachIntro() {
        const intro = document.getElementById("intro");
        if (intro) {
            intro.hidden = true;
        }
        if (KONTO.aktiv() && !KONTO.angemeldet()) {
            APP.anmeldungZeigen();
            return;
        }
        APP.appZeigen();
    },

    anmeldungZeigen() {
        APP.bereit = false;
        ANMELDUNG.zeigen(document.getElementById("anmeldung"), () => APP.appZeigen());
        NAVIGATION.auffrischen();
    },

    appZeigen() {
        ANMELDUNG.verbergen();
        APP.bereit = true;
        APP.daten = null;
        NAVIGATION.alleVeralten();
        NAVIGATION.wechseln("start");
        NAVIGATION.auffrischen();
        /* Seit 0.9.0 zuerst die eigenen Kassen am Konto: auf neuem Gerät kein Code mehr nötig. */
        APP.kontenLaden().then(() => STEUERUNG.nachsenden()).then(() => STEUERUNG.kassenAbgleichen())
            .then(() => APP.einladungEinloesen()).then((eingeloest) => (eingeloest ? null : STEUERUNG.laden()))
            .then(() => APP.gastErinnern());
    },

    /* Das UPCrew-Konto in den Einstellungen und die Verwaltung (seit 0.14.0, Bausteine
       js\upcrew-konto.js + js\upcrew-verwaltung.js, Einbau: UPCrew bausteine\EINBAU-VERWALTUNG.md).
       Texte und Abläufe (Name, Nummer, Passwort, Gast sichern, Abmelden, Konto löschen, Verwaltung)
       stehen im Baustein; hier nur die Haken. Kein `spiel`: die Datenbank-Regel lässt einen Admin
       keine fremden Kassen lesen, also bleibt „Nur in Kaffekasse“ der Verwaltung leer. Kein
       `spielerWerte`: Kaffekasse hat keinen Fortschritt (Spielerliste nur aus den Konten). */
    kontoEinrichten() {
        if (typeof UPCREW_KONTO === "undefined") {
            return;
        }
        UPCREW_KONTO.einrichten({
            app: KONFIG.APP_NAME,
            daten: () => APP.daten,
            speicher: () => (APP.speicher ? APP.speicher.konten : null),
            nachladen: () => APP.kontenLaden(),
            nachAbmelden: async () => APP.nachAbmelden(),
            nachGastSichern: () => EINSTELLUNGEN.auffrischen(),
            nachKonto: () => {
                START.kopfAktualisieren();
                EINSTELLUNGEN.auffrischen();
            },
            nachAenderung: () => EINSTELLUNGEN.auffrischen(),
            adminErlaubt: () => APP.werkstattAdmin(),
            verwaltungSichtbar: () => (typeof UPCREW_FREIGABE === "undefined" || UPCREW_FREIGABE.darf("verwaltung"))
        });
    },

    /* Werkstatt (nur localhost, `?werkstatt&rolle=admin`): die Zeile „Verwaltung“ auch ohne
       Admin-Konto zeigen. Geschrieben wird trotzdem nur, was die Datenbank-Regel erlaubt. */
    werkstattAdmin() {
        if (typeof location === "undefined") {
            return false;
        }
        const lokal = ["localhost", "127.0.0.1", "[::1]"].indexOf(location.hostname) !== -1;
        return lokal && /[?&]werkstatt/.test(location.search) && /[?&]rolle=admin(&|$)/.test(location.search);
    },

    /* Ein Gast wird jedes dritte Öffnen gefragt, ob er sichern will (Baustein). */
    gastErinnern() {
        if (typeof UPCREW_KONTO === "undefined" || !APP.bereit) {
            return false;
        }
        return UPCREW_KONTO.gastErinnern();
    },

    /* Der Freigabe-Kanal (seit 0.13.0, Baustein js\freigabe.js): die Tabelle melden (konfig.js tut
       es schon beim Laden, hier noch einmal laut Einbau-Anleitung); die Rolle setzt der Konto-Kern
       beim Laden der Konten. Ändert sie sich (Laden, Abmelden, Kontowechsel, Werkstatt `?beta`),
       zeichnen Seiten und das offene Einstellungen-Blatt neu. */
    freigabeEinrichten() {
        if (typeof UPCREW_FREIGABE === "undefined") {
            return;
        }
        UPCREW_FREIGABE.tabelle(KONFIG.FREIGABEN);
        UPCREW_FREIGABE.beiWechsel(() => {
            NAVIGATION.alleVeralten();
            EINSTELLUNGEN.auffrischen();
        });
    },

    /* Die Werkstatt (nur localhost, `?werkstatt`): lädt js\werkstatt.js nach — Attrappe der
       Datenbank, Prüfung der Kamera-API, Strichcode von Hand. In der ausgelieferten App
       passiert hier nichts. */
    werkstattEinrichten() {
        const lokal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
        if (!lokal || !/[?&]werkstatt/.test(location.search)) {
            return;
        }
        const skript = document.createElement("script");
        skript.src = "js/werkstatt.js";
        document.body.appendChild(skript);
    },

    /* Die Konten-Liste holen (unter Regel §12: Marke, Rollen, eigener Eintrag, Auszüge).
       Liefert seit 0.14.0 den frischen Stand (APP.daten) — oder null, wenn das Laden scheitert
       (die Konto-Bausteine schreiben nur auf einem frischen Stand). */
    async kontenLaden() {
        if (!APP.speicher || !KONTO.angemeldet()) {
            return null;
        }
        APP.zustand = "wartet";
        let frisch = null;
        try {
            APP.daten = await APP.speicher.konten.laden();
            frisch = APP.daten;
            APP.zustand = "gespeichert";
            if (typeof UPCREW_OFFLINE !== "undefined") {
                UPCREW_OFFLINE.setzen(false);
            }
        } catch (fehler) {
            if (typeof UPCREW_OFFLINE !== "undefined" && UPCREW_OFFLINE.istNetzFehler(fehler)) {
                APP.zustand = "offline";
                UPCREW_OFFLINE.setzen(true);
            } else {
                APP.zustand = "wartet";
                console.error(fehler);
            }
        }
        START.kopfAktualisieren();
        EINSTELLUNGEN.auffrischen();
        return frisch;
    },

    eigener() {
        return SPIELER.eigener(APP.daten, KONTO.uid());
    },

    anzeigeName() {
        const ich = APP.eigener();
        if (ich) {
            return SPIELER.anzeige(ich);
        }
        if (KONTO.angemeldet() && KONTO.istGastSitzung()) {
            return "Gast";
        }
        /* Angemeldet, aber die Konten-Liste ist noch nicht da: der Kopf zeigt den Strich. */
        return "";
    },

    speicherZustand() {
        return APP.zustand;
    },

    /* Abmelden über den Baustein (seit 0.14.0): fragt immer, warnt einen Gast und räumt dessen
       Eintrag samt Gast-Konto weg; danach der Haken APP.nachAbmelden. */
    abmelden() {
        return UPCREW_KONTO.abmelden();
    },

    /* Haken `nachAbmelden` (auch nach „Konto löschen“): Person vergessen, Anmeldung zeigen. */
    nachAbmelden() {
        APP.daten = null;
        STEUERUNG.vergessen();
        if (typeof UPCREW_BLATT !== "undefined") {
            UPCREW_BLATT.alleSchliessen();
        }
        APP.anmeldungZeigen();
    },

    /* Firebase erkennt die Sitzung nicht mehr an (Konto gelöscht, Schlüssel ungültig). */
    sitzungVerloren() {
        KONTO.abmelden();
        APP.daten = null;
        STEUERUNG.vergessen();
        if (APP.bereit) {
            DIALOG.hinweis({ titel: "Abgemeldet", text: "Bitte neu anmelden" }).then(() => APP.anmeldungZeigen());
        }
    },

    /* Der Service Worker: Gerät zuerst, auf localhost Netz zuerst (Schalter in sw.js). */
    dienstAnmelden() {
        if (!("serviceWorker" in navigator) || location.protocol === "file:") {
            return;
        }
        navigator.serviceWorker.register("sw.js").catch((fehler) => console.error(fehler));
    }
};

if (typeof window !== "undefined" && typeof document !== "undefined") {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => APP.starten());
    } else {
        APP.starten();
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = APP;
}
