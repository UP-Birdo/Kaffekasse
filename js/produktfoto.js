/*
 * produktfoto.js — ein eigenes Bild am Produkt (seit 0.9.0, Nutzer 12.10.2026: „man soll auch ein
 * Bild hinterlegen können, wenn kein Bild aus Food Facts vorhanden ist“).
 *
 * Der Mensch wählt das Bild selbst (Datei-Auswahl des Geräts: Foto machen oder aus der Mediathek) —
 * die App greift nie von sich aus auf die Fotos zu (die Regel „Kamera nur live“ gilt weiter für den
 * Strichcode). Das Bild wird HIER im Gerät verkleinert (Quadrat, KANTE px, JPEG) und als
 * data-Adresse am Produkt gespeichert; es verlässt das Gerät nur in die eigene Datenbank.
 * Höchstlänge und Form prüft das Modell (KASSE.fotoPruefen) und die Datenbank-Regel.
 *
 *     PRODUKTFOTO.waehlen() → Promise<File | null>      die Auswahl des Geräts (null = abgebrochen)
 *     await PRODUKTFOTO.verkleinern(datei) → "data:image/jpeg;base64,…" oder "" (zu groß / kein Bild)
 */

const PRODUKTFOTO = {

    KANTE: 160,
    GUETEN: [0.8, 0.7, 0.6, 0.5, 0.4],

    waehlen() {
        return new Promise((fertig) => {
            const feld = document.createElement("input");
            feld.type = "file";
            feld.accept = "image/*";
            feld.style.display = "none";
            let erledigt = false;
            const ende = (datei) => {
                if (erledigt) {
                    return;
                }
                erledigt = true;
                feld.remove();
                fertig(datei || null);
            };
            feld.addEventListener("change", () => ende(feld.files && feld.files[0]));
            feld.addEventListener("cancel", () => ende(null));
            document.body.appendChild(feld);
            feld.click();
        });
    },

    _bildLaden(datei) {
        return new Promise((fertig, fehler) => {
            const adresse = URL.createObjectURL(datei);
            const bild = new Image();
            bild.onload = () => { URL.revokeObjectURL(adresse); fertig(bild); };
            bild.onerror = () => { URL.revokeObjectURL(adresse); fehler(new Error("Kein Bild")); };
            bild.src = adresse;
        });
    },

    /* Mittig quadratisch zuschneiden, auf KANTE verkleinern, Güte senken, bis es passt. */
    async verkleinern(datei) {
        if (!datei || !/^image\//.test(datei.type || "")) {
            return "";
        }
        let bild = null;
        try {
            bild = await PRODUKTFOTO._bildLaden(datei);
        } catch (fehler) {
            return "";
        }
        const seite = Math.min(bild.naturalWidth, bild.naturalHeight);
        if (!(seite > 0)) {
            return "";
        }
        const leinwand = document.createElement("canvas");
        leinwand.width = PRODUKTFOTO.KANTE;
        leinwand.height = PRODUKTFOTO.KANTE;
        const g = leinwand.getContext("2d");
        g.fillStyle = "#ffffff";
        g.fillRect(0, 0, PRODUKTFOTO.KANTE, PRODUKTFOTO.KANTE);
        g.drawImage(bild, (bild.naturalWidth - seite) / 2, (bild.naturalHeight - seite) / 2, seite, seite,
            0, 0, PRODUKTFOTO.KANTE, PRODUKTFOTO.KANTE);
        for (const guete of PRODUKTFOTO.GUETEN) {
            const daten = leinwand.toDataURL("image/jpeg", guete);
            if (KASSE.fotoPruefen(daten)) {
                return daten;
            }
        }
        return "";
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = PRODUKTFOTO;
}
