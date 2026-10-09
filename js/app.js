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

    starten() {
        window.KAFFEKASSE_GESTARTET = true;

        KONTO.einrichten(KONFIG);
        KONTO.beiVerloren = () => APP.sitzungVerloren();
        APP.speicher = speicherErzeugen();
        APP.werkstattEinrichten();
        STEUERUNG.einrichten();

        NAVIGATION.einrichten({
            leiste: document.getElementById("leiste"),
            band: document.getElementById("band"),
            ebenen: document.getElementById("ebenen"),
            bildschirme: { start: START, verlauf: VERLAUF, einstellungen: EINSTELLUNGEN },
            erlaubt: () => APP.bereit
        });

        if (typeof UPCREW_OFFLINE !== "undefined") {
            UPCREW_OFFLINE.lauschen();
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
        APP.kontenLaden().then(() => STEUERUNG.nachsenden()).then(() => STEUERUNG.laden());
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

    /* Die Konten-Liste holen (unter Regel §12: Marke, Rollen, eigener Eintrag, Auszüge). */
    async kontenLaden() {
        if (!APP.speicher || !KONTO.angemeldet()) {
            return;
        }
        APP.zustand = "wartet";
        try {
            APP.daten = await APP.speicher.konten.laden();
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
        NAVIGATION.veralten("einstellungen");
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

    async abmelden() {
        const ja = await DIALOG.frage({ titel: "Abmelden", text: "UPCrew-Konto abmelden?", ja: "Abmelden" });
        if (!ja) {
            return;
        }
        KONTO.abmelden();
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
