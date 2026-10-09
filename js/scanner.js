/*
 * scanner.js — Strichcode LIVE aus der Kamera lesen (Standard-Web-API `BarcodeDetector`,
 * Rückkamera über getUserMedia). Kein Zugriff auf gespeicherte Fotos, kein Bild verlässt das
 * Gerät (eiserne Regel). Fehlt die API auf dem Gerät, gibt es keinen Scan-Knopf — die Nummer
 * wird von Hand eingegeben (Rückfall, Architektur-Doku).
 *
 *     SCANNER.verfuegbar()                     → true, wenn Kamera-Zugriff und BarcodeDetector da sind
 *     SCANNER.wertPruefen(roh)                 → Ziffern oder "" (rein)
 *     const lauf = await SCANNER.starten(video, beiCode)   → { stoppen() }; beiCode(ean) einmal
 *     SCANNER.stoppen()                        → Kamera aus, Schleife aus
 *
 * Für Tests lassen sich `SCANNER.api` (Klasse wie BarcodeDetector) und `SCANNER.medien`
 * (wie navigator.mediaDevices) ersetzen.
 */

const SCANNER = {

    FORMATE: ["ean_13", "ean_8", "upc_a", "code_128"],
    TAKT_MS: 250,

    api: (typeof BarcodeDetector !== "undefined") ? BarcodeDetector : null,
    medien: (typeof navigator !== "undefined" && navigator.mediaDevices) ? navigator.mediaDevices : null,

    lauf: null,

    verfuegbar() {
        return !!(SCANNER.api && SCANNER.medien && typeof SCANNER.medien.getUserMedia === "function");
    },

    wertPruefen(roh) {
        const ziffern = String(roh || "").replace(/[^0-9]/g, "");
        return (ziffern.length >= 8 && ziffern.length <= 14) ? ziffern : "";
    },

    async starten(video, beiCode) {
        if (!SCANNER.verfuegbar()) {
            throw new Error("Kamera-API fehlt");
        }
        SCANNER.stoppen();
        const strom = await SCANNER.medien.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        const erkenner = new SCANNER.api({ formats: SCANNER.FORMATE });
        video.srcObject = strom;
        video.setAttribute("playsinline", "");
        video.muted = true;
        if (typeof video.play === "function") {
            try {
                await video.play();
            } catch (fehler) {
                /* Autoplay verweigert: das Bild steht trotzdem, sobald der Nutzer tippt. */
            }
        }
        let fertig = false;
        const lauf = {
            stoppen() {
                if (fertig) {
                    return;
                }
                fertig = true;
                if (lauf.uhr) {
                    clearInterval(lauf.uhr);
                    lauf.uhr = null;
                }
                for (const spur of (strom.getTracks ? strom.getTracks() : [])) {
                    spur.stop();
                }
                if (video.srcObject === strom) {
                    video.srcObject = null;
                }
                if (SCANNER.lauf === lauf) {
                    SCANNER.lauf = null;
                }
            },
            uhr: null
        };
        lauf.uhr = setInterval(async () => {
            if (fertig) {
                return;
            }
            try {
                const codes = await erkenner.detect(video);
                for (const c of codes || []) {
                    const wert = SCANNER.wertPruefen(c && c.rawValue);
                    if (wert && !fertig) {
                        lauf.stoppen();
                        beiCode(wert);
                        return;
                    }
                }
            } catch (fehler) {
                /* Ein Bild ohne Code oder noch kein Bild: weiter. */
            }
        }, SCANNER.TAKT_MS);
        SCANNER.lauf = lauf;
        return lauf;
    },

    stoppen() {
        if (SCANNER.lauf) {
            SCANNER.lauf.stoppen();
        }
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = SCANNER;
}
