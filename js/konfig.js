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

    APP_VERSION: "0.7.0",

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

    /* Schlüssel im Gerätespeicher. Alle UPCrew-Apps liegen auf demselben Ursprung und
       teilen den Browser-Speicher — deshalb der eigene Vorsatz. Das Konto liegt unter
       `kaffekasse.konto` (Baustein), das Aussehen unter dem Schlüssel des Aussehen-Bausteins. */
    schluessel: {
        kasse: "kaffekasse.kasse",
        stand: "kaffekasse.stand",
        wartend: "kaffekasse.wartend"
    },

    /* Wie lange der Notfall-Weg in index.html wartet, bis er die Seite selbst anzeigt.
       Das Intro endet spätestens nach rund 9 s (Baustein), also davor. */
    notfallMs: 10000
};

/* Damit die Regressionstests die Datei außerhalb des Browsers laden können. */
if (typeof module !== "undefined" && module.exports) {
    module.exports = KONFIG;
}
