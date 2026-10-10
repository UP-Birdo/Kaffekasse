/*
 * scanner.js — Strichcode LIVE aus der Kamera lesen (Standard-Web-API `BarcodeDetector`,
 * Rückkamera über getUserMedia). Kein Zugriff auf gespeicherte Fotos, kein Bild verlässt das
 * Gerät (eiserne Regel). Fehlt die API auf dem Gerät (iPhone, Windows), springt seit 0.8.0 ZXing
 * ein (`js\fremd\zxing.min.js`, mitgeliefert, erst beim ersten Scannen geladen; Nutzer 10.10.2026:
 * „den Foto-Knopf habe ich bis jetzt nicht gefunden“ → Entscheidung „nur Bordmittel“ aufgehoben).
 * Ohne Kamera-Zugriff gibt es keinen Scan-Knopf — die Nummer wird von Hand eingegeben.
 *
 *     SCANNER.verfuegbar()                     → true, wenn Kamera-Zugriff da ist (Erkenner: Browser oder ZXing)
 *     SCANNER.wertPruefen(roh)                 → Ziffern oder "" (rein)
 *     const lauf = await SCANNER.starten(video, beiCode)   → { stoppen() }; beiCode(ean) einmal
 *     SCANNER.stoppen()                        → Kamera aus, Schleife aus
 *
 * Für Tests lassen sich `SCANNER.api` (Klasse wie BarcodeDetector), `SCANNER.medien`
 * (wie navigator.mediaDevices), `SCANNER.ersatzLaden` (→ Promise auf eine Klasse wie
 * BarcodeDetector) und `SCANNER.mitErsatz` (false = kein ZXing) ersetzen.
 */

const SCANNER = {

    FORMATE: ["ean_13", "ean_8", "upc_a", "code_128"],
    TAKT_MS: 250,

    api: (typeof BarcodeDetector !== "undefined") ? BarcodeDetector : null,
    medien: (typeof navigator !== "undefined" && navigator.mediaDevices) ? navigator.mediaDevices : null,

    lauf: null,

    /* ZXing als Ersatz, wo der Browser keinen BarcodeDetector hat (seit 0.8.0). */
    mitErsatz: (typeof document !== "undefined"),
    ERSATZ_PFAD: "js/fremd/zxing.min.js",
    _ersatz: null,

    verfuegbar() {
        const kamera = !!(SCANNER.medien && typeof SCANNER.medien.getUserMedia === "function");
        return kamera && !!(SCANNER.api || SCANNER.mitErsatz);
    },

    /* Lädt ZXing einmal (Skript-Tag) und baut daraus eine Klasse wie BarcodeDetector. */
    ersatzLaden() {
        if (!SCANNER._ersatz) {
            SCANNER._ersatz = new Promise((fertig, fehler) => {
                if (typeof ZXing !== "undefined") {
                    fertig(SCANNER._zxingKlasse(ZXing));
                    return;
                }
                const skript = document.createElement("script");
                skript.src = SCANNER.ERSATZ_PFAD;
                skript.onload = () => (typeof ZXing !== "undefined")
                    ? fertig(SCANNER._zxingKlasse(ZXing))
                    : fehler(new Error("Kamera-API fehlt"));
                skript.onerror = () => {
                    SCANNER._ersatz = null;
                    fehler(new Error("Kamera-API fehlt"));
                };
                document.head.appendChild(skript);
            });
        }
        return SCANNER._ersatz;
    },

    /* ZXing hinter der Form von BarcodeDetector: `new K({ formats })`, `detect(video)` →
       [{ rawValue }] oder []. Jedes Bild wird auf höchstens 720 px Breite verkleinert. */
    _zxingKlasse(Z) {
        const ARTEN = {
            ean_13: Z.BarcodeFormat.EAN_13,
            ean_8: Z.BarcodeFormat.EAN_8,
            upc_a: Z.BarcodeFormat.UPC_A,
            code_128: Z.BarcodeFormat.CODE_128
        };
        return class {
            constructor(optionen) {
                const formate = ((optionen && optionen.formats) || []).map((f) => ARTEN[f]).filter((f) => f !== undefined);
                const hinweise = new Map();
                hinweise.set(Z.DecodeHintType.POSSIBLE_FORMATS, formate);
                hinweise.set(Z.DecodeHintType.TRY_HARDER, true);
                this.leser = new Z.MultiFormatReader();
                this.leser.setHints(hinweise);
                this.leinwand = document.createElement("canvas");
            }

            async detect(video) {
                const b = video.videoWidth;
                const h = video.videoHeight;
                if (!b || !h) {
                    return [];
                }
                const f = Math.min(1, 720 / b);
                this.leinwand.width = Math.round(b * f);
                this.leinwand.height = Math.round(h * f);
                this.leinwand.getContext("2d").drawImage(video, 0, 0, this.leinwand.width, this.leinwand.height);
                try {
                    const quelle = new Z.HTMLCanvasElementLuminanceSource(this.leinwand);
                    const ergebnis = this.leser.decodeWithState(new Z.BinaryBitmap(new Z.HybridBinarizer(quelle)));
                    return [{ rawValue: ergebnis.getText() }];
                } catch (fehler) {
                    return [];
                }
            }
        };
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
        const Erkenner = SCANNER.api || await SCANNER.ersatzLaden();
        const strom = await SCANNER.medien.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        const erkenner = new Erkenner({ formats: SCANNER.FORMATE });
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
