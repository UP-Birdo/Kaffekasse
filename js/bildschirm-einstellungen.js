/*
 * bildschirm-einstellungen.js — die Einstellungen über den Studio-Baustein
 * (upcrew-einstellungen.js): Abschnitte `konto`, `aussehen`, `spiel` („Nur in Kaffekasse“:
 * Kasse mit Name, Code, wechseln, verlassen), `ueber` (Version, Speicher, Wunsch, Fehler,
 * Quellen). Seit 0.14.0 kommen `konto`, `admin` (Verwaltung, nur Admins) und `gefahr`
 * (Konto löschen) aus dem Baustein upcrew-konto.js. Seit 0.6.0 ein BLATT, kein Tab mehr.
 *
 * „Anpassen" ist hier EINE Zeile mit Pfeil, die ein Blatt öffnet (Nutzer-Entscheidung
 * 08.10.2026: Anpassen unter Einstellungen, nicht als Tab). Darin läuft der
 * Anpassen-Baustein mit `alleFrei: true` — Kaffekasse hat kein Level; ob die Stücke später
 * an das Spielen in Blunderluck und Typoluck gebunden werden, steht in der ROADMAP
 * (Nutzer-Wunsch 09.10.2026). Die Vorschau im Blatt ist die Form `kaffekasse` des Bausteins
 * (Produktkarten; seit 09.10.2026 in der Quelle) — eine ältere Kopie zeigt die Typoluck-Form.
 */

const EINSTELLUNGEN = {

    loeseLampe: null,
    anpassen: null,
    ort: null,

    /* Seit 0.6.0 ein Blatt (kein Tab mehr): über das Menü im Profil-Kopf, das Zahnrad im Profil
       oder — ohne Profil-Baustein — den Namen im schlichten Kopf. */
    oeffnen() {
        if (typeof UPCREW_BLATT === "undefined") {
            return;
        }
        UPCREW_BLATT.oeffnen({
            titel: "Einstellungen",
            klasse: "blatt-einstellungen",
            inhalt: (el) => {
                EINSTELLUNGEN.ort = el;
                EINSTELLUNGEN.zeichnen(el);
            },
            beimSchliessen: () => {
                if (typeof EINSTELLUNGEN.loeseLampe === "function") {
                    EINSTELLUNGEN.loeseLampe();
                    EINSTELLUNGEN.loeseLampe = null;
                }
                EINSTELLUNGEN.ort = null;
            }
        });
    },

    /* Neu zeichnen, wenn das Blatt gerade offen ist (nach dem Laden der Konten, Kasse geändert). */
    auffrischen() {
        if (EINSTELLUNGEN.ort && EINSTELLUNGEN.ort.isConnected) {
            EINSTELLUNGEN.zeichnen(EINSTELLUNGEN.ort);
        }
    },

    zeichnen(ort) {
        ort.textContent = "";
        const E = UPCREW_EINSTELLUNGEN;

        /* Konto, Admin (Verwaltung) und Gefahr (Konto löschen) seit 0.14.0 aus dem Baustein
           upcrew-konto.js — gleiche Texte und Abläufe wie in jeder UPCrew-App. */
        const kontoTeile = UPCREW_KONTO.abschnitte();

        const aussehen = {
            art: "aussehen",
            zeilen: [
                { zeichen: "farbe", titel: "Anpassen", rechts: "pfeil", beiKlick: () => EINSTELLUNGEN.anpassenOeffnen() }
            ]
        };
        /* „Als App nutzen“ (0.10.0, Baustein upcrew-homescreen): nur, wenn der Baustein da ist und
           die App NICHT schon vom Home-Bildschirm läuft. */
        if (typeof UPCREW_HOMESCREEN !== "undefined" && !UPCREW_HOMESCREEN.installiert()) {
            aussehen.zeilen.push({ zeichen: "info", titel: "Als App nutzen", unter: "Auf den Home-Bildschirm", rechts: "pfeil",
                beiKlick: () => EINSTELLUNGEN.homescreenOeffnen() });
        }

        /* Abschnitt „Nur in Kaffekasse": die Kasse — Name, Code, wechseln, verlassen. */
        const abschnitte = kontoTeile.concat([aussehen]);
        if (STEUERUNG.hatKasse() && STEUERUNG.stand) {
            const stand = STEUERUNG.stand;
            abschnitte.push({
                art: "spiel",
                zeilen: [
                    { zeichen: "liste", titel: stand.name, unter: "Code " + stand.code, rechts: "pfeil", beiKlick: () => KASSE_BLATT.kasseKarte() },
                    { zeichen: "hoch", titel: "Kasse wechseln", rechts: "pfeil", beiKlick: () => KASSE_BLATT.kasse() },
                    { zeichen: "verlassen", titel: "Kasse verlassen", gefahr: true, beiKlick: () => EINSTELLUNGEN.kasseVerlassen() }
                ]
            });
        } else {
            abschnitte.push({
                art: "spiel",
                zeilen: [{ zeichen: "liste", titel: "Kasse", unter: "Anlegen · Beitreten", rechts: "pfeil", beiKlick: () => KASSE_BLATT.kasse() }]
            });
        }

        const speicher = E.speicherZeile(APP.speicherZustand());
        if (typeof EINSTELLUNGEN.loeseLampe === "function") {
            EINSTELLUNGEN.loeseLampe();
        }
        if (typeof UPCREW_OFFLINE !== "undefined") {
            EINSTELLUNGEN.loeseLampe = UPCREW_OFFLINE.lampe(speicher.lampe);
        }

        const ueber = {
            art: "ueber",
            titel: "Über Kaffekasse",
            zeilen: [
                { zeichen: "info", titel: "Version", rechts: E.wert(KONFIG.APP_VERSION) },
                speicher,
                /* Wunsch- und Fehler-Weg: vorbefülltes Formular auf GitHub (Stufe 5). Seit 0.9.0
                   EINE Zeile mit Zeichen und Namen wie in Blunderluck und Typoluck (Nutzer
                   12.10.2026: „wieso ist das Icon von Fehler melden nicht dasselbe wie bei den
                   anderen Crew-Apps?“); die Wahl Wunsch/Fehler danach als kleine Karte. */
                { zeichen: "hilfe", titel: "Wunsch oder Fehler melden", rechts: "pfeil",
                    beiKlick: () => EINSTELLUNGEN.meldungWaehlen() },
                /* Quellenhinweis der Produktdaten (Nutzer 09.10.2026: nicht auf dem Start). */
                { zeichen: "info", titel: "Quellen", unter: "Open Food Facts", rechts: "pfeil",
                    beiKlick: () => DIALOG.hinweis({ titel: "Quellen", text: PRODUKTSUCHE.QUELLE }) }
            ]
        };

        /* Beta-Zugang (seit 0.13.0, Freigabe-Kanal): nur für Rolle beta/admin sichtbar — Gast und
           alle anderen sehen die Zeile nicht. */
        const rolle = EINSTELLUNGEN.betaRolle();
        if (rolle) {
            ueber.zeilen.push({ zeichen: "schild", titel: "Beta-Zugang",
                unter: rolle === "admin" ? "Als Admin" : "Neues früher",
                rechts: E.wert("Aktiv") });
        }

        abschnitte.push(ueber);
        E.bauen(ort, "einstellungen", abschnitte, { spiel: KONFIG.APP_NAME });
    },

    /* Die Rolle aus dem Freigabe-Kanal: "beta" | "admin" | null (Gast, ohne Rolle, ohne Baustein). */
    betaRolle() {
        if (typeof UPCREW_FREIGABE === "undefined" || typeof UPCREW_FREIGABE.rolle !== "function") {
            return null;
        }
        const r = UPCREW_FREIGABE.rolle();
        return (r === "beta" || r === "admin") ? r : null;
    },

    /* Wunsch oder Fehler? Zwei Knöpfe auf einer Karte; Esc/Grund schließt ohne Wahl. */
    meldungWaehlen() {
        if (typeof UPCREW_BLATT === "undefined") {
            EINSTELLUNGEN.meldungOeffnen(KONFIG.wunsch.vorlageWunsch);
            return;
        }
        UPCREW_BLATT.oeffnen({
            art: "karte",
            titel: "Melden",
            inhalt: (el) => {
                const knoepfe = document.createElement("div");
                knoepfe.className = "blatt-knoepfe";
                knoepfe.appendChild(DIALOG.knopf("Wunsch", "haupt", () => {
                    UPCREW_BLATT.schliessen();
                    EINSTELLUNGEN.meldungOeffnen(KONFIG.wunsch.vorlageWunsch);
                }));
                knoepfe.appendChild(DIALOG.knopf("Fehler", "still", () => {
                    UPCREW_BLATT.schliessen();
                    EINSTELLUNGEN.meldungOeffnen(KONFIG.wunsch.vorlageFehler);
                }));
                el.appendChild(knoepfe);
            }
        });
    },

    /* Das GitHub-Formular in einem neuen Fenster, mit Fassung und Stelle vorbefüllt. Die
       Adresse kommt aus KONFIG; die App schickt nichts selbst (kein Netz hier). */
    meldungOeffnen(vorlage) {
        const w = KONFIG.wunsch;
        if (!w || !w.basis) {
            return;
        }
        const stelle = STEUERUNG.hatKasse() ? "Kasse" : "Start";
        const adresse = w.basis + "?template=" + encodeURIComponent(vorlage)
            + "&fassung=" + encodeURIComponent(KONFIG.APP_VERSION)
            + "&stelle=" + encodeURIComponent(stelle);
        window.open(adresse, "_blank", "noopener");
    },

    async kasseVerlassen() {
        const ja = await DIALOG.frage({ titel: "Kasse verlassen", text: "Einträge bleiben", ja: "Verlassen", gefahr: true });
        if (!ja) {
            return;
        }
        const e = await STEUERUNG.verlassen();
        if (!e.ok) {
            await DIALOG.hinweis({ titel: "Kasse verlassen", text: e.text || "Abgelehnt" });
            return;
        }
        NAVIGATION.alleVeralten();
        EINSTELLUNGEN.auffrischen();
    },

    /* Die Anleitung „Auf den Home-Bildschirm“ (Baustein upcrew-homescreen) als Blatt. */
    homescreenOeffnen() {
        if (typeof UPCREW_BLATT === "undefined" || typeof UPCREW_HOMESCREEN === "undefined") {
            return;
        }
        let griff = null;
        UPCREW_BLATT.oeffnen({
            titel: "Als App nutzen",
            klasse: "blatt-homescreen",
            inhalt: (el) => { griff = UPCREW_HOMESCREEN.anleitung(el, { app: KONFIG.APP_NAME, icon: "bilder/icon-192.png" }); },
            beimSchliessen: () => {
                if (griff) {
                    griff.entfernen();
                }
            }
        });
    },

    anpassenOeffnen() {
        if (typeof UPCREW_BLATT === "undefined" || typeof UPCREW_ANPASSEN === "undefined") {
            return;
        }
        UPCREW_BLATT.oeffnen({
            titel: "Anpassen",
            klasse: "blatt-anpassen",
            inhalt: (el) => {
                EINSTELLUNGEN.anpassen = UPCREW_ANPASSEN.zeigen(el, {
                    app: "kaffekasse",
                    alleFrei: true,
                    shop: false,
                    /* 0.9.0 (Nutzer 12.10.2026: „die Vorschau ist zu groß … die Felder darunter müssen
                       gescrollt werden“): kleine Vorschau, damit alle Kacheln ohne Rollen passen. */
                    kompakt: true
                });
            },
            beimSchliessen: () => {
                if (EINSTELLUNGEN.anpassen && typeof EINSTELLUNGEN.anpassen.entfernen === "function") {
                    EINSTELLUNGEN.anpassen.entfernen();
                }
                EINSTELLUNGEN.anpassen = null;
            }
        });
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = EINSTELLUNGEN;
}
