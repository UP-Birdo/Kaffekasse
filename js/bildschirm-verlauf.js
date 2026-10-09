/*
 * bildschirm-verlauf.js — der Verlauf nach Tagen (neueste zuerst), seit 0.6.0 unten im Tab
 * „Statistik“ (js\bildschirm-statistik.js ruft VERLAUF.liste). Jede Zeile ist eine Packung:
 * Tipp → Packungs-Blatt (Kaufdatum, Preis, geöffnet, leer); die Zeile zeigt Preis und
 * Zustand kurz. Rücknahme des eigenen Eintrags wie bisher.
 *
 * Alle Zahlen kommen aus dem Modell (KASSE.verlauf, KASSE.nachTag) — der Bildschirm rechnet
 * nichts.
 */

const VERLAUF = {

    liste(ort, stand, zeitraum) {
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
                gruppe.appendChild(VERLAUF._zeile(e, uid));
            }
            ort.appendChild(gruppe);
        }
    },

    /* Kurz, was die Packung weiß: Laden, Preis, Angebot, offen, leer. */
    _zustandText(e) {
        const teile = [];
        if (e.laden) {
            teile.push(e.laden);
        }
        if (typeof e.preis === "number") {
            teile.push(KASSE.euro(e.preis));
        }
        if (e.angebot) {
            teile.push("Angebot");
        }
        if (e.leerAm) {
            teile.push("leer");
        } else if (e.geoeffnetAm) {
            teile.push("offen");
        }
        return teile.join(" · ");
    },

    _zeile(e, uid) {
        const zeile = document.createElement("div");
        zeile.className = "verlauf-zeile" + (e.gueltig ? "" : " verlauf-zurueck") + (e.wer === uid ? " verlauf-ich" : "");
        const zeit = document.createElement("span");
        zeit.className = "verlauf-zeit";
        zeit.textContent = KASSE.uhrzeit(e.wann);
        const text = document.createElement("button");
        text.type = "button";
        text.className = "verlauf-text";
        text.setAttribute("aria-label", "Packung " + (e.produktName || "Produkt"));
        text.addEventListener("click", () => KASSE_BLATT.packung(e.id));
        const produkt = document.createElement("b");
        produkt.textContent = e.produktName || "Produkt";
        const wer = document.createElement("small");
        const zustand = VERLAUF._zustandText(e);
        wer.textContent = (e.wer === uid ? "Du" : (e.werName || "Ehemals")) + (e.menge > 1 ? " · " + e.menge : "")
            + (zustand ? " · " + zustand : "");
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
        return zeile;
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = VERLAUF;
}
