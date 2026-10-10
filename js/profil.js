/*
 * profil.js — der Kopf des Starts und das Profil wie in den Spielen (seit 0.6.0, Nutzer
 * 09.10.2026: „das profil oben hin wie bei den spielen“, Entscheidung „Profil oben =
 * Spiele-Kopf“). Gezeichnet wird über den Studio-Baustein upcrew-profil (kopfzeile, menue,
 * oeffnen) — Kreis, Name #Tag, Abzeichen, rechts das Menü mit den Einstellungen.
 *
 * Fehlt der Baustein (noch nicht verteilt), zeigt PROFIL.kopf eine schlichte Kopfzeile:
 * Name #Tag und das Zahnrad, Tipp → Einstellungs-Blatt. Nie ein Absturz: jede Stelle prüft
 * mit `typeof`, ob der Baustein da ist.
 *
 * Woher die Zahlen kommen (Kaffekasse liest nur, schreibt nichts ans Konto):
 *   Name, #Tag   der eigene Konto-Eintrag (APP.eigener)
 *   Level        KEINS (seit 0.8.0, Nutzer 10.10.2026: „bei Kaffekasse den Level-Ring aus dem Profil,
 *                hier bekommst du keine XP“): ohne `level` lässt der Baustein Zahl, Level-Pfad und
 *                Level-Balken weg; den leeren Ring blendet css\stil.css aus.
 *   Abzeichen    die ausgerüsteten (`abzeichen` am Konto) über UPCREW_ABZEICHEN aus dem
 *                gemeinsamen Fortschritt des eigenen Eintrags
 *   Statistik    die eigenen Packungen und Ausgaben in der gewählten Kasse (Modell)
 */

const PROFIL = {

    griff: null,

    mitBaustein() {
        return typeof UPCREW_PROFIL !== "undefined" && typeof UPCREW_PROFIL.kopfzeile === "function";
    },

    /* Der öffentliche Auszug des eigenen Kontos, wenn die Konten-Rückwand ihn geladen hat. */
    _auszug() {
        const ich = (typeof APP !== "undefined") ? APP.eigener() : null;
        if (ich && ich.auszug && typeof ich.auszug === "object") {
            return ich.auszug;
        }
        const konten = (typeof APP !== "undefined" && APP.speicher) ? APP.speicher.konten : null;
        const oeffentlich = konten ? konten._oeffentlichVomServer : null;
        return (oeffentlich && oeffentlich.auszug && typeof oeffentlich.auszug === "object") ? oeffentlich.auszug : null;
    },

    /* Die Daten für Kopfzeile und Profil-Blatt (Form des Bausteins). */
    daten() {
        const ich = (typeof APP !== "undefined") ? APP.eigener() : null;
        const gast = (typeof KONTO !== "undefined") && KONTO.angemeldet() && KONTO.istGastSitzung();
        const d = {
            name: ich ? ich.name : (gast ? "Gast" : ""),
            tag: (ich && ich.tag) ? "#" + ich.tag : "",
            abzeichen: [],
            serie: 0
        };
        const auszug = PROFIL._auszug();
        if (ich && typeof UPCREW_ABZEICHEN !== "undefined" && typeof UPCREW_ABZEICHEN.alle === "function") {
            try {
                const alle = UPCREW_ABZEICHEN.alle(ich.fortschritt || null, auszug ? Number(auszug.serie) || 0 : 0);
                d.abzeichen = UPCREW_ABZEICHEN.ausgeruestet(alle, ich.abzeichen || [], 3);
            } catch (fehler) {
                d.abzeichen = [];
            }
        }
        return d;
    },

    /* Der Kopf in `ort` (ein leerer Platz im Start-Kopf). */
    kopf(ort) {
        ort.textContent = "";
        const d = PROFIL.daten();
        if (PROFIL.mitBaustein()) {
            PROFIL.griff = UPCREW_PROFIL.kopfzeile(ort, d, {
                beiOeffnen: () => PROFIL.oeffnen(),
                menue: [
                    { text: "Kasse", zeichen: ZUSTAND.ZEICHEN.tasse, beiKlick: () => KASSE_BLATT.kasseKarte() },
                    { text: "Einstellungen", zeichen: "zahnrad", beiKlick: () => EINSTELLUNGEN.oeffnen() }
                ]
            });
            return;
        }
        /* Rückfall ohne Baustein: Name #Tag und Zahnrad, beides → Einstellungen. */
        PROFIL.griff = null;
        const name = document.createElement("button");
        name.type = "button";
        name.className = "kopf-name";
        name.setAttribute("aria-label", "Einstellungen");
        name.textContent = d.name;
        if (d.tag) {
            const tag = document.createElement("small");
            tag.className = "kopf-tag";
            tag.textContent = d.tag;
            name.appendChild(tag);
        }
        name.addEventListener("click", () => EINSTELLUNGEN.oeffnen());
        ort.appendChild(name);
        if (typeof UPCREW_EINSTELLUNGEN !== "undefined" && typeof UPCREW_EINSTELLUNGEN.zahnradKnopf === "function") {
            ort.appendChild(UPCREW_EINSTELLUNGEN.zahnradKnopf(() => EINSTELLUNGEN.oeffnen(), "Einstellungen", "kopf-zahnrad"));
        }
    },

    /* Das ausführliche Profil als Blatt (Baustein); ohne Baustein gleich die Einstellungen. */
    oeffnen() {
        if (!PROFIL.mitBaustein() || typeof UPCREW_PROFIL.oeffnen !== "function") {
            EINSTELLUNGEN.oeffnen();
            return;
        }
        UPCREW_PROFIL.oeffnen(PROFIL.daten(), {
            eigen: true,
            beiZahnrad: () => EINSTELLUNGEN.oeffnen(),
            statistik: (el) => PROFIL._statistik(el)
        });
    },

    /* Abschnitt „Statistik“ im Profil: die eigenen Zahlen in der gewählten Kasse. */
    _statistik(el) {
        const S = STEUERUNG;
        const uid = (typeof KONTO !== "undefined") ? KONTO.uid() : null;
        if (!S.stand || !uid) {
            el.appendChild(ZUSTAND.leer({ zeichen: "tasse", text: "Noch keine Kasse" }));
            return;
        }
        const st = KASSE.statistik(S.stand, KASSE.zeitraum(S.jetzt(), "alle"));
        const ich = st.personen.find((p) => p.uid === uid) || { packungen: 0, ausgaben: 0 };
        el.appendChild(STATISTIK.kacheln([
            { titel: "Kasse", wert: S.stand.name },
            { titel: "Packungen", wert: String(ich.packungen) },
            { titel: "Ausgaben", wert: KASSE.euro(ich.ausgaben) }
        ]));
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = PROFIL;
}
