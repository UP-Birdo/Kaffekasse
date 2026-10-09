/*
 * bildschirm-verlauf.js — der Tab „Verlauf" (Stufe 3): oben der Zeitraum (30 Tage · Alles)
 * und die Übersicht je Produkt (wer wie oft, als Balken aus Bordmitteln, wer dran ist),
 * darunter der Verlauf nach Tagen (neueste zuerst) mit Rücknahme des eigenen Eintrags.
 *
 * Alle Zahlen kommen aus dem Modell (KASSE.uebersicht, KASSE.verlauf, KASSE.nachTag) — der
 * Bildschirm rechnet nichts. Der Zeitraum-Schalter ist das Segment des
 * Einstellungen-Bausteins. Neu gezeichnet wird, wenn die Steuerung meldet.
 */

const VERLAUF = {

    art: "30",
    loesen: null,

    zeichnen(ort) {
        ort.textContent = "";
        const titel = document.createElement("h1");
        titel.className = "seite-titel";
        titel.textContent = "Verlauf";
        ort.appendChild(titel);

        if (!VERLAUF.loesen) {
            VERLAUF.loesen = STEUERUNG.beobachten(() => NAVIGATION.veralten("verlauf"));
        }

        const S = STEUERUNG;
        if (!S.hatKasse() || !S.stand) {
            const karte = document.createElement("section");
            karte.className = "karte";
            karte.appendChild(ZUSTAND.leer({ zeichen: "liste", text: S.hatKasse() ? "Kasse lädt" : "Noch keine Kasse" }));
            ort.appendChild(karte);
            return;
        }

        const stand = S.stand;
        const zeitraum = KASSE.zeitraum(S.jetzt(), VERLAUF.art);

        if (typeof UPCREW_EINSTELLUNGEN !== "undefined") {
            const huelle = document.createElement("div");
            huelle.className = "verlauf-schalter";
            huelle.appendChild(UPCREW_EINSTELLUNGEN.segment(
                [{ wert: "30", text: "30 Tage" }, { wert: "alle", text: "Alles" }],
                VERLAUF.art,
                (wert) => { VERLAUF.art = wert; NAVIGATION.veralten("verlauf"); },
                "Zeitraum"));
            ort.appendChild(huelle);
        }

        VERLAUF._uebersicht(ort, stand, zeitraum);
        VERLAUF._liste(ort, stand, zeitraum);
    },

    _uebersicht(ort, stand, zeitraum) {
        const uid = (typeof KONTO !== "undefined") ? KONTO.uid() : null;
        for (const p of KASSE.uebersicht(stand, zeitraum)) {
            const karte = document.createElement("section");
            karte.className = "uebersicht";
            karte.setAttribute("aria-label", p.produkt.name);

            const kopf = document.createElement("div");
            kopf.className = "uebersicht-kopf";
            const name = document.createElement("b");
            name.textContent = p.produkt.name;
            const rechts = document.createElement("span");
            rechts.textContent = p.gesamt + " · " + (p.dran ? (p.dran === uid ? "Du" : KASSE.mitgliedName(stand, p.dran)) : "");
            kopf.appendChild(name);
            kopf.appendChild(rechts);
            karte.appendChild(kopf);

            for (const person of p.personen) {
                const zeile = document.createElement("div");
                zeile.className = "balken-zeile" + (person.uid === uid ? " balken-ich" : "");
                const wer = document.createElement("span");
                wer.className = "balken-name";
                wer.textContent = person.uid === uid ? "Du" : person.name;
                const balken = document.createElement("span");
                balken.className = "balken";
                balken.setAttribute("role", "img");
                balken.setAttribute("aria-label", person.name + " " + person.menge);
                const fuellung = document.createElement("i");
                fuellung.style.width = Math.round(person.anteil * 100) + "%";
                balken.appendChild(fuellung);
                const menge = document.createElement("span");
                menge.className = "balken-menge";
                menge.textContent = String(person.menge);
                zeile.appendChild(wer);
                zeile.appendChild(balken);
                zeile.appendChild(menge);
                karte.appendChild(zeile);
            }
            ort.appendChild(karte);
        }
    },

    _liste(ort, stand, zeitraum) {
        const liste = KASSE.verlauf(stand, zeitraum);
        if (liste.length === 0) {
            const karte = document.createElement("section");
            karte.className = "karte";
            karte.appendChild(ZUSTAND.leer({ zeichen: "liste", text: "Noch keine Käufe" }));
            ort.appendChild(karte);
            return;
        }
        const uid = (typeof KONTO !== "undefined") ? KONTO.uid() : null;
        for (const tag of KASSE.nachTag(liste, STEUERUNG.jetzt())) {
            const kopf = document.createElement("h3");
            kopf.className = "verlauf-tag";
            kopf.textContent = tag.name;
            ort.appendChild(kopf);
            const gruppe = document.createElement("div");
            gruppe.className = "verlauf-gruppe";
            for (const e of tag.eintraege) {
                const zeile = document.createElement("div");
                zeile.className = "verlauf-zeile" + (e.gueltig ? "" : " verlauf-zurueck") + (e.wer === uid ? " verlauf-ich" : "");
                const zeit = document.createElement("span");
                zeit.className = "verlauf-zeit";
                zeit.textContent = KASSE.uhrzeit(e.wann);
                const text = document.createElement("span");
                text.className = "verlauf-text";
                const produkt = document.createElement("b");
                produkt.textContent = e.produktName || "Produkt";
                const wer = document.createElement("small");
                wer.textContent = (e.wer === uid ? "Du" : (e.werName || "Ehemals")) + (e.menge > 1 ? " · " + e.menge : "");
                text.appendChild(produkt);
                text.appendChild(wer);
                zeile.appendChild(zeit);
                zeile.appendChild(text);
                if (STEUERUNG.darfZuruecknehmen(e)) {
                    const zurueck = DIALOG.knopf("Zurück", "still", async () => {
                        const ja = await DIALOG.zweiSchritt({ titel: e.produktName, text: "Eintrag zurücknehmen?", erst: "Zurücknehmen", dann: "Wirklich" });
                        if (ja) {
                            await STEUERUNG.zuruecknehmen(e.id);
                        }
                    });
                    zurueck.classList.add("verlauf-knopf");
                    zeile.appendChild(zurueck);
                }
                gruppe.appendChild(zeile);
            }
            ort.appendChild(gruppe);
        }
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = VERLAUF;
}
