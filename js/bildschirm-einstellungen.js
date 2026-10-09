/*
 * bildschirm-einstellungen.js — die Einstellungen über den Studio-Baustein
 * (upcrew-einstellungen.js): Abschnitte `konto`, `aussehen`, `ueber`. Kein Abschnitt
 * `spiel`, kein `admin` (Stufe 1).
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

    zeichnen(ort) {
        ort.textContent = "";
        const titel = document.createElement("h1");
        titel.className = "seite-titel";
        titel.textContent = "Einstellungen";
        ort.appendChild(titel);

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

        /* Abschnitt „Nur in Kaffekasse": die Kasse (Stufe 2). */
        const abschnitte = [konto, aussehen];
        if (STEUERUNG.hatKasse() && STEUERUNG.stand) {
            const stand = STEUERUNG.stand;
            abschnitte.push({
                art: "spiel",
                zeilen: [
                    { zeichen: "liste", titel: stand.name, unter: "Code " + stand.code, rechts: "pfeil", beiKlick: () => KASSE_BLATT.code() },
                    { zeichen: "verlassen", titel: "Kasse verlassen", gefahr: true, beiKlick: () => EINSTELLUNGEN.kasseVerlassen() }
                ]
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
                    beiKlick: () => EINSTELLUNGEN.meldungOeffnen(KONFIG.wunsch.vorlageFehler) }
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
