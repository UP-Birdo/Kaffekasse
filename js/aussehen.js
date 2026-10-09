/*
 * aussehen.js — das Aussehen anwenden, BEVOR etwas sichtbar wird (kein Aufblitzen).
 *
 * Läuft im Kopf der Seite direkt nach den Bausteinen upcrew-intro.js, upcrew-farbwelten.js
 * und upcrew-aussehen.js. Mehr tut diese Datei nicht: Hell/Dunkel, Farbwelt, Schrift und
 * Knöpfe liegen beim Studio-Baustein, geändert werden sie im Blatt „Anpassen" der
 * Einstellungen (Baustein upcrew-anpassen.js).
 *
 * Der Baustein kennt je App ein eigenes Aussehen (`<app>.aussehen`). Seit dem 09.10.2026
 * kennt die Quelle auch "kaffekasse" (Schlüssel `kaffekasse.aussehen`); eine ältere Kopie
 * des Bausteins fällt still auf den gemeinsamen Schlüssel `upcrew.aussehen` zurück
 * (siehe Erkenntnisse der Entscheidungs-Doku). Die Zeile hier bleibt in beiden Fällen gleich.
 */
(function () {
    "use strict";

    if (typeof UPCREW_AUSSEHEN === "undefined") {
        return;
    }
    UPCREW_AUSSEHEN.app = "kaffekasse";
    UPCREW_AUSSEHEN.schriftPfad = "schrift/";
    UPCREW_AUSSEHEN.anwenden();
})();
