/*
 * bildschirm-einstellungen.js — die Einstellungen über den Studio-Baustein
 * (upcrew-einstellungen.js): Abschnitte `konto`, `aussehen`, `spiel` („Nur in Kaffekasse“:
 * Kasse mit Name, Code, wechseln, verlassen), `ueber` (Version, Speicher, Wunsch, Fehler,
 * Quellen). Kein `admin`. Seit 0.6.0 ein BLATT (EINSTELLUNGEN.oeffnen), kein Tab mehr.
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
        const ich = APP.eigener();
        const gast = (typeof KONTO !== "undefined") && KONTO.istGastSitzung();

        const konto = {
            art: "konto",
            zeilen: [
                {
                    zeichen: "person",
                    titel: ich ? ich.name : (gast ? "Gast" : "Konto"),
                    tag: (ich && ich.tag) ? "#" + ich.tag : "",
                    unter: "UPCrew-Konto"
                },
                { zeichen: "verlassen", titel: "Abmelden", beiKlick: () => APP.abmelden() }
            ]
        };

        const aussehen = {
            art: "aussehen",
            zeilen: [
                { zeichen: "farbe", titel: "Anpassen", rechts: "pfeil", beiKlick: () => EINSTELLUNGEN.anpassenOeffnen() }
            ]
        };

        /* Abschnitt „Nur in Kaffekasse": die Kasse — Name, Code, wechseln, verlassen. */
        const abschnitte = [konto, aussehen];
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
                /* Wunsch- und Fehler-Weg: vorbefülltes Formular auf GitHub (Stufe 5). */
                { zeichen: "hilfe", titel: "Wunsch", rechts: "pfeil",
                    beiKlick: () => EINSTELLUNGEN.meldungOeffnen(KONFIG.wunsch.vorlageWunsch) },
                { zeichen: "werkzeug", titel: "Fehler melden", rechts: "pfeil",
                    beiKlick: () => EINSTELLUNGEN.meldungOeffnen(KONFIG.wunsch.vorlageFehler) },
                /* Quellenhinweis der Produktdaten (Nutzer 09.10.2026: nicht auf dem Start). */
                { zeichen: "info", titel: "Quellen", unter: "Open Food Facts", rechts: "pfeil",
                    beiKlick: () => DIALOG.hinweis({ titel: "Quellen", text: PRODUKTSUCHE.QUELLE }) }
            ]
        };

        abschnitte.push(ueber);
        E.bauen(ort, "einstellungen", abschnitte, { spiel: KONFIG.APP_NAME });
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
                    shop: false
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
