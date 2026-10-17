/*
 * konfig.js — die EINE Stelle für Versionsnummer, Adressen, Pfade und Zeiten.
 *
 * APP_VERSION ist die einzige Quelle der Nummer (Haus-Regel „Versionierung").
 * sw.js trägt dieselbe Nummer in SPEICHER_NAME; ein Test
 * prüft, dass Code, sw.js, CHANGELOG.md und STATUS.md übereinstimmen.
 *
 * Die Datenbank ist die UPCrew-Datenbank (Firebase-Projekt upcrew-7a29d): Konten unter
 * `spieler` (gehören dem Studio, Baustein konto.js / speicher-konten.js), die Zähler dieser
 * App im Bereich `kaffekasse` (ab Stufe 2). Adressen stehen NUR hier und werden von keiner
 * Sitzung per Befehl abgefragt (Nutzer-Vorgabe 08.10.2026) — ausprobiert wird in der App.
 */

const KONFIG = {

    APP_VERSION: "0.14.2",

    /*
     * DER FREIGABE-KANAL (seit 0.13.0, Baustein js\freigabe.js, Einbau: UPCrew
     * bausteine\EINBAU-FREIGABE.md). Jede sichtbare Neuerung hat hier einen Namen und eine Stufe:
     *     "alle"   jeder (auch Gast)
     *     "beta"   nur Konten mit Rolle „beta“ und Admins
     *     "admin"  nur Admins
     *     "aus"    gebaut, niemand sieht es (Stand davor)
     * Bildschirme fragen nur `UPCREW_FREIGABE.darf(name)`. Ein Name, der hier fehlt, heißt „nein“
     * (ein Regressionstest hält Code und Tabelle gleich).
     * REGEL FÜR KÜNFTIGE LÄUFE: sichtbar Neues kommt als "beta" (nie direkt "alle"); Freigabe für
     * alle = hier auf "alle" + Version hochzählen.
     * Startbelegung 0.13.0: die Neuerungen aus 0.11.0/0.12.0, die heute alle sehen, stehen auf
     * "alle" — Notfall-Schalter, nichts verschwindet. `beitrittMitCode` unten bleibt ein eigener
     * Regel-Schalter (hängt an der Datenbank, nicht an der Rolle).
     */
    FREIGABEN: {
        "einkaufsliste": "alle",       /* 0.11.0 Einkaufsliste unter der Kasse (Haken nur am Gerät) */
        "einkauf-teilen": "alle",      /* 0.12.0 „Teilen“/„Kopieren“ unter der Einkaufsliste */
        "zuletzt-gekauft": "alle",     /* 0.11.0 „Zuletzt gekauft“ in der Kasse-Karte und je Mitglied */
        "alte-packung-leer": "alle",   /* 0.12.0 „Öffnen“ fragt „Alte Packung leer?“ */
        "rueckgaengig": "alle",        /* 0.12.0 „Rückgängig“ nach „Leer“ und „Öffnen“ */
        "laenger-als-ueblich": "alle", /* 0.12.0 „offen seit n Tagen · länger als üblich“ */
        "ausgaben-monat": "alle",      /* 0.12.0 Ausgaben je Monat in „Mehr Zahlen“ */
        "scan-hinweise": "alle",       /* 0.11.0 Schon da, Prüfziffer, „Nochmal“ beim Suchen */
        "verwaltung": "admin"          /* 0.14.0 Verwaltung der Konten (Baustein upcrew-verwaltung), sieht ohnehin nur Admin */
    },

    /* Name und Nummer im Studio-Intro (die Reihe der Nummern führt das Studio). */
    APP_NAME: "Kaffekasse",
    INTRO_NR: "04",

    /* Wunsch- und Fehler-Weg: ein vorbefülltes Formular auf GitHub (kein Schlüssel, kein
       Geheimnis in der App — angemeldet wird der Melder von GitHub). Vorlagen liegen im
       Repository unter .github. */
    wunsch: {
        basis: "https://github.com/up-birdo/Kaffekasse/issues/new",
        vorlageWunsch: "wunsch.yml",
        vorlageFehler: "fehler.yml"
    },

    /* Welche Datenbank und welche Pfade. `pfad` ist der Konten-Bereich des Studios,
       `bereich` der eigene Bereich dieser App. */
    speicher: {
        modus: "gemeinsam",
        firebaseBasis: "https://upcrew-7a29d-default-rtdb.europe-west1.firebasedatabase.app",
        pfad: "spieler",
        bereich: "kaffekasse"
    },

    /* Firebase Authentication für das UPCrew-Konto (Baustein konto.js). Der Web-Schlüssel
       ist in jeder Web-App öffentlich sichtbar; was ein Konto darf, entscheidet allein die
       Datenbank-Regel. Die erfundene Adresse `<kennung>@<domain>` ist nie zustellbar. */
    konto: {
        apiKey: "AIzaSyC-oWrTMnUaUbb7Sb14TvzfdYcRIOIYcmU",
        domain: "konten.upcrew.invalid"
    },

    /* Jeder Netzaufruf hat ein Zeitlimit (eiserne Regel). */
    zeitlimit: {
        ladenMs: 12000,
        schreibenMs: 12000
    },

    /* Wie oft andere Geräte nach einer Änderung der Kasse fragen (Stufe 2). */
    abfrageIntervallMs: 30000,

    /* Wie lange ein eigener Eintrag zurückgenommen werden darf (Modell, Stufe 2). */
    ruecknahmeMinuten: 10,

    /* Wie lange die Leiste „Laden · Angebot · MHD“ nach dem „+“ stehen bleibt (0.7.0). */
    vorbelegungMs: 8000,

    /* Wie lange „Rückgängig“ nach „Leer“ und „Öffnen“ in der Bestand-Karte steht (0.12.0). */
    rueckgaengigMs: 6000,

    /* Schlüssel im Gerätespeicher. Alle UPCrew-Apps liegen auf demselben Ursprung und
       teilen den Browser-Speicher — deshalb der eigene Vorsatz. Das Konto liegt unter
       `kaffekasse.konto` (Baustein), das Aussehen unter dem Schlüssel des Aussehen-Bausteins. */
    schluessel: {
        kasse: "kaffekasse.kasse",
        stand: "kaffekasse.stand",
        wartend: "kaffekasse.wartend",
        /* Haken der Einkaufsliste (0.11.0), nur am Gerät: { kasseId: { produktId: Zeit } }. */
        einkauf: "kaffekasse.einkauf"
    },

    /* Beitritt mit Code als Beleg (0.11.0, Regel-Vorschlag „Beitritt“): erst auf true, wenn
       die Regel Schritt 1 (Feld `code` im Mitglieds-Knoten erlaubt) LIVE ist — die heutige Regel
       lehnt das Feld ab, mit false geht der Beitritt wie bisher. */
    beitrittMitCode: false,

    /* Wie lange der Notfall-Weg in index.html wartet, bis er die Seite selbst anzeigt.
       Das Intro endet spätestens nach rund 9 s (Baustein), also davor. */
    notfallMs: 10000
};

/* Die Freigabe-Tabelle so früh wie möglich melden (seit 0.13.0): js\freigabe.js lädt in
   index.html VOR dieser Datei. APP.starten meldet sie noch einmal (Einbau-Anleitung). */
if (typeof UPCREW_FREIGABE !== "undefined" && UPCREW_FREIGABE && typeof UPCREW_FREIGABE.tabelle === "function") {
    UPCREW_FREIGABE.tabelle(KONFIG.FREIGABEN);
}

/* Damit die Regressionstests die Datei außerhalb des Browsers laden können. */
if (typeof module !== "undefined" && module.exports) {
    module.exports = KONFIG;
}
