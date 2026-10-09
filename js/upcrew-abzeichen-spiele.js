/*
 * upcrew-abzeichen-spiele.js — die Abzeichen der einzelnen UPCrew-Spiele als DATEN, gleich in allen Apps (gehört zu
 * js/upcrew-abzeichen.js, danach laden). Entstanden in Blunderluck v0.156.0.
 *
 * Nutzer, 28.09.2026: „wenn ich in dem einen Spiel ein Abzeichen bekomme, soll es fix im Profil liegen; man soll 3
 * ausrüsten können, egal aus welchem Spiel“ → EINE Liste für alle Spiele. Jedes Spiel steht hier mit seinen
 * Abzeichen; jede App kennt so auch die der anderen und zeigt sie im Profil.
 *
 * Ein Eintrag: { kennung, titel, kurz, pfad (24er-Raster), text, feld, stufen, weiter, einheit }.
 *   kennung  steht im Konto-Feld `abzeichen`, wenn es ausgerüstet ist; Vorsilbe des Spiels („bl-“, „tl-“ …).
 *   feld     der Zähler im EIGENEN Zweig des Spiels (`spiele.<spiel>.zaehler[feld]`, nur Buchstaben — Regel §11b).
 *            Das Spiel schreibt ihn selbst, sobald es das Abzeichen verdient (einmalige: 1).
 *   stufen   wie die gemeinsamen; `weiter: 0` = keine weiteren Stufen.
 *
 * Blunderluck: die 14 Abzeichen aus der Chronik (js\rangliste.js `ABZEICHEN`), je einmalig.
 * Typoluck: fünf einmalige (Kennung „tl-…“, Zähler „az…“), eingetragen in Typoluck 0.25.0; seit Typoluck 0.26.0
 * ohne „Schwer-Profi“ (Nutzer 29.09.2026: Schwer-Modus raus).
 */
(function () {
    "use strict";

    const A = (typeof UPCREW_ABZEICHEN !== "undefined") ? UPCREW_ABZEICHEN : null;

    const BLUNDERLUCK = [
        { kennung: "bl-erster-sieg", titel: "Erster Sieg", kurz: "Sieg", feld: "azErsterSieg",
            text: "Die erste Partie gewonnen.",
            pfad: "M12 3 L14.6 8.6 L20.5 9.3 L16 13.3 L17.3 19.2 L12 16.2 L6.7 19.2 L8 13.3 L3.5 9.3 L9.4 8.6 Z" },
        { kennung: "bl-veteran", titel: "Veteran", kurz: "Veteran", feld: "azVeteran",
            text: "Zehn Partien zu Ende gespielt.",
            pfad: "M5 4 H19 V20 H5 Z M9 9 H15 M9 13 H15 M9 17 H13" },
        { kennung: "bl-beidhaendig", titel: "Beidhändig", kurz: "Beide", feld: "azBeidhaendig",
            text: "Als Weiss und als Schwarz gewonnen.",
            pfad: "M3 6 H11 V14 H3 Z M13 10 H21 V18 H13 Z" },
        { kennung: "bl-serie-3", titel: "Serienheld", kurz: "×3", feld: "azSerieDrei",
            text: "Drei Siege in Folge.",
            pfad: "M4 18 L9 11 L13 14 L20 6 M15 6 H20 V11" },
        { kennung: "bl-comeback", titel: "Comeback", kurz: "Comeback", feld: "azComeback",
            text: "Nach einer Niederlage gleich wieder gewonnen.",
            pfad: "M4 12 A8 8 0 1 0 7 6 M4 3 V8 H9" },
        { kennung: "bl-blitzmatt", titel: "Blitzmatt", kurz: "Blitz", feld: "azBlitzmatt",
            text: "Ein Sieg in höchstens 20 Halbzügen.",
            pfad: "M13 2 L5 14 H11 L10 22 L19 9 H13 Z" },
        { kennung: "bl-marathon", titel: "Marathon", kurz: "Marathon", feld: "azMarathon",
            text: "Eine Partie über 100 Halbzüge.",
            pfad: "M12 3 A9 9 0 1 0 12.01 3 Z M12 7 V12 L15 14" },
        { kennung: "bl-nachteule", titel: "Nachteule", kurz: "Nacht", feld: "azNachteule",
            text: "Eine Partie zwischen Mitternacht und fünf Uhr beendet.",
            pfad: "M20 14 A8 8 0 1 1 10 4 A6 6 0 0 0 20 14 Z" },
        { kennung: "bl-sammler", titel: "Sammler", kurz: "Beute", feld: "azSammler",
            text: "50 Punkte allein für geschlagene Figuren.",
            pfad: "M5 20 H19 M7 20 V9 H17 V20 M9 9 V5 H15 V9" },
        { kennung: "bl-allrounder", titel: "Allrounder", kurz: "Bretter", feld: "azAllrounder",
            text: "Auf drei verschiedenen Brettern gespielt.",
            pfad: "M4 4 H10 V10 H4 Z M14 4 H20 V10 H14 Z M4 14 H10 V20 H4 Z M14 14 H20 V20 H14 Z" },
        { kennung: "bl-hunderter", titel: "Hunderter", kurz: "100", feld: "azHunderter",
            text: "100 Punkte in der Rangliste.",
            pfad: "M7 4 H17 V9 A5 5 0 0 1 7 9 Z M12 14 V18 M8 20 H16" },
        { kennung: "bl-unaufhaltsam", titel: "Unaufhaltsam", kurz: "×5", feld: "azUnaufhaltsam",
            text: "Fünf Siege in Folge.",
            pfad: "M5 6 L11 12 L5 18 M12 6 L18 12 L12 18" },
        { kennung: "bl-dauerbrenner", titel: "Dauerbrenner", kurz: "50", feld: "azDauerbrenner",
            text: "Fünfzig Partien zu Ende gespielt.",
            pfad: "M12 3 C15 7 18 9 18 14 A6 6 0 0 1 6 14 C6 11 8 9 9 7 C10 10 11 11 12 11 C12 8 11 6 12 3 Z" },
        { kennung: "bl-legende", titel: "Legende", kurz: "Legende", feld: "azLegende",
            text: "500 Punkte in der Rangliste.",
            pfad: "M4 18 L3 7 L8 11 L12 5 L16 11 L21 7 L20 18 Z" }
    ].map((e) => Object.assign({ stufen: [1], weiter: 0, einheit: "verdient" }, e));

    /* Typoluck (Vorschlag Typoluck 0.26.0): fünf einmalige, gerechnet in Typolucks js\fortschritt.js
       (`FORTSCHRITT.tlAbzeichenFelder`) aus dem eigenen Zweig — Taten der Runde und die Bibliothek. */
    const TYPOLUCK = [
        { kennung: "tl-zwei-versuche", titel: "Blitzmerker", kurz: "≤ 2", feld: "azZweiVersuche",
            text: "Ein Tageswort in höchstens zwei Versuchen gelöst.",
            pfad: "M13 2 L5 14 H11 L10 22 L19 9 H13 Z" },
        { kennung: "tl-koennen", titel: "Wortkönner", kurz: "90 %", feld: "azKoennen",
            text: "90 % Können in einer gelösten Runde.",
            pfad: "M4 18 L9 11 L13 14 L20 6 M15 6 H20 V11" },
        { kennung: "tl-perfekt", titel: "Perfekt", kurz: "100 %", feld: "azPerfekt",
            text: "100 % Können in einer gelösten Runde.",
            pfad: "M12 3 L14.6 8.6 L20.5 9.3 L16 13.3 L17.3 19.2 L12 16.2 L6.7 19.2 L8 13.3 L3.5 9.3 L9.4 8.6 Z" },
        { kennung: "tl-erstes-buch", titel: "Erstes Buch", kurz: "Buch", feld: "azErstesBuch",
            text: "Das erste Buch der Bibliothek geschafft.",
            pfad: "M4 5 C7 4 10 4 12 6 C14 4 17 4 20 5 V19 C17 18 14 18 12 20 C10 18 7 18 4 19 Z M12 6 V20" },
        { kennung: "tl-buecherwurm", titel: "Bücherwurm", kurz: "Alle", feld: "azBuecherwurm",
            text: "Alle Bücher der Bibliothek geschafft.",
            pfad: "M5 4 H9 V20 H5 Z M10 4 H14 V20 H10 Z M15 5 L19 4 L21 19 L17 20 Z" }
    ].map((e) => Object.assign({ stufen: [1], weiter: 0, einheit: "verdient" }, e));

    const UPCREW_ABZEICHEN_SPIELE = {
        blunderluck: { marke: "BL", name: "Blunderluck", abzeichen: BLUNDERLUCK },
        typoluck: { marke: "TL", name: "Typoluck", abzeichen: TYPOLUCK }
    };

    if (A && typeof A.registrieren === "function") {
        for (const spiel of Object.keys(UPCREW_ABZEICHEN_SPIELE)) {
            const s = UPCREW_ABZEICHEN_SPIELE[spiel];
            A.registrieren(spiel, s.abzeichen, { marke: s.marke, name: s.name });
        }
    }

    if (typeof globalThis !== "undefined") {
        globalThis.UPCREW_ABZEICHEN_SPIELE = UPCREW_ABZEICHEN_SPIELE;
    }
    if (typeof module !== "undefined" && module.exports) {
        module.exports = UPCREW_ABZEICHEN_SPIELE;
    }
})();
