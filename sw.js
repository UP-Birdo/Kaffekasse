/*
 * sw.js — der Service Worker: Nach dem ersten Laden läuft die App ohne Netz (Gerät zuerst).
 *
 * SPEICHER_NAME trägt die Versionsnummer und zieht bei JEDER Version im selben Schritt mit
 * wie APP_VERSION in js\konfig.js (Haus-Regel, häufigster Auslieferungsfehler). Bleibt sie
 * stehen, behalten die Geräte tagelang den alten Stand. Ein Test vergleicht beide.
 *
 * BEIM_BAUEN: auf localhost Netz zuerst (sonst sieht man beim Bauen nach jeder Änderung die
 * alte Fassung), im Betrieb Zwischenspeicher zuerst. Die Datenbank (Firebase) und die
 * Anmeldung (googleapis) gehen nie durch den Zwischenspeicher.
 */

const SPEICHER_NAME = "kaffekasse-v0.8.0";

const BEIM_BAUEN = (self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1");

/* Alles, was die App zum Start braucht — eigene Dateien und die Kopien der Bausteine. */
const DATEIEN = [
    "./",
    "index.html",
    "manifest.webmanifest",
    "icon.svg",
    "bilder/icon-180.png",
    "bilder/icon-192.png",
    "bilder/icon-512.png",
    "css/upcrew-intro.css",
    "css/upcrew-knoepfe.css",
    "css/upcrew-platz.css",
    "css/upcrew-anpassen.css",
    "css/upcrew-leiste.css",
    "css/upcrew-wischen.css",
    "css/upcrew-blatt.css",
    "css/upcrew-einstellungen.css",
    "css/upcrew-offline.css",
    "css/upcrew-abzeichen.css",
    "css/upcrew-levelpfad.css",
    "css/upcrew-profil.css",
    "css/stil.css",
    "js/upcrew-intro.js",
    "js/upcrew-farbwelten.js",
    "js/upcrew-aussehen.js",
    "js/aussehen.js",
    "js/konfig.js",
    "js/upcrew-platz.js",
    "js/upcrew-anpassen.js",
    "js/upcrew-leiste.js",
    "js/upcrew-wischen.js",
    "js/upcrew-blatt.js",
    "js/upcrew-einstellungen.js",
    "js/upcrew-offline.js",
    "js/upcrew-abzeichen.js",
    "js/upcrew-abzeichen-spiele.js",
    "js/upcrew-levelpfad.js",
    "js/upcrew-profil.js",
    "js/konto.js",
    "js/speicher.js",
    "js/speicher-konten.js",
    "js/dialog.js",
    "js/zustand.js",
    "js/spieler.js",
    "js/kasse.js",
    "js/bestand.js",
    "js/warteschlange.js",
    "js/steuerung.js",
    "js/produktsuche.js",
    "js/scanner.js",
    "js/navigation.js",
    "js/bildschirm-anmeldung.js",
    "js/bildschirm-kasse.js",
    "js/profil.js",
    "js/bildschirm-start.js",
    "js/bildschirm-verlauf.js",
    "js/bildschirm-statistik.js",
    "js/bildschirm-produkte.js",
    "js/bildschirm-einstellungen.js",
    "js/app.js",
    "schrift/crew-S1-normal.woff2",
    "schrift/crew-S1-fett.woff2",
    "schrift/crew-S2-normal.woff2",
    "schrift/crew-S2-fett.woff2",
    "schrift/crew-S3-normal.woff2",
    "schrift/crew-S3-fett.woff2",
    "schrift/crew-S4-normal.woff2",
    "schrift/crew-S4-fett.woff2",
    "schrift/crew-S5-normal.woff2",
    "schrift/crew-S5-fett.woff2",
    "schrift/crew-S6-normal.woff2",
    "schrift/crew-S6-fett.woff2"
];

/* Jede Datei einzeln holen: Fehlt eine (etwa ein Icon vor Stufe 5), scheitert nicht die
   ganze Einrichtung — nur diese Datei bleibt draußen. */
self.addEventListener("install", (ereignis) => {
    ereignis.waitUntil(
        caches.open(SPEICHER_NAME).then((speicher) =>
            Promise.all(DATEIEN.map((datei) =>
                speicher.add(new Request(datei, { cache: "reload" })).catch(() => null))))
            .then(() => self.skipWaiting())
    );
});

/* Alte Stände wegräumen, sobald die neue Fassung übernimmt. */
self.addEventListener("activate", (ereignis) => {
    ereignis.waitUntil(
        caches.keys().then((namen) => Promise.all(
            namen.filter((name) => name !== SPEICHER_NAME).map((name) => caches.delete(name))))
            .then(() => self.clients.claim())
    );
});

function istEigene(anfrage) {
    const adresse = new URL(anfrage.url);
    return adresse.origin === self.location.origin;
}

self.addEventListener("fetch", (ereignis) => {
    const anfrage = ereignis.request;
    if (anfrage.method !== "GET" || !istEigene(anfrage)) {
        return;     /* Datenbank, Anmeldung, fremde Dienste: immer direkt */
    }
    if (BEIM_BAUEN) {
        ereignis.respondWith(
            fetch(anfrage).then((antwort) => {
                const kopie = antwort.clone();
                caches.open(SPEICHER_NAME).then((speicher) => speicher.put(anfrage, kopie));
                return antwort;
            }).catch(() => caches.match(anfrage, { ignoreSearch: true }))
        );
        return;
    }
    ereignis.respondWith(
        caches.match(anfrage, { ignoreSearch: true }).then((gespeichert) => {
            if (gespeichert) {
                return gespeichert;
            }
            return fetch(anfrage).then((antwort) => {
                if (antwort && antwort.ok) {
                    const kopie = antwort.clone();
                    caches.open(SPEICHER_NAME).then((speicher) => speicher.put(anfrage, kopie));
                }
                return antwort;
            }).catch(() => (anfrage.mode === "navigate" ? caches.match("index.html") : undefined));
        })
    );
});
