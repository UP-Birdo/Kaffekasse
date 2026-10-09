/*
 * bildschirm-kasse.js — die Blätter rund um die Kasse (über upcrew-blatt.js, die Seite bleibt
 * dahinter sichtbar): Kasse anlegen oder beitreten, Produkt anlegen, Code zeigen.
 *
 * Kein Rechnen hier: Codes prüft das Modell (KASSE.codePruefen), geschrieben wird über die
 * Steuerung. Texte kurz, keine ganzen Sätze (UPCrew-Standard).
 */

const KASSE_BLATT = {

    /* Erstes Blatt: Kasse anlegen (Hauptaktion) oder mit Code beitreten. */
    kasse() {
        if (typeof UPCREW_BLATT === "undefined") {
            return;
        }
        UPCREW_BLATT.oeffnen({
            titel: "Kasse",
            klasse: "blatt-kasse",
            inhalt: (el) => {
                const anlegen = KASSE_BLATT._abschnitt(el, "Neue Kasse");
                const name = KASSE_BLATT._feld("kasse-name", "Name", "Büro", "text", KASSE.NAME_MAX);
                anlegen.appendChild(name.zeile);
                const knopfAnlegen = DIALOG.knopf("Anlegen", "haupt", async () => {
                    name.fehler.textContent = "";
                    KASSE_BLATT._beschaeftigt(el, true);
                    const e = await STEUERUNG.anlegen(name.feld.value);
                    KASSE_BLATT._beschaeftigt(el, false);
                    if (e.ok) {
                        UPCREW_BLATT.schliessen();
                        KASSE_BLATT.code();
                        return;
                    }
                    name.fehler.textContent = e.text || "Abgelehnt";
                });
                anlegen.appendChild(KASSE_BLATT._knoepfe(knopfAnlegen));
                KASSE_BLATT._enter(name.feld, knopfAnlegen);

                const beitreten = KASSE_BLATT._abschnitt(el, "Beitreten");
                const code = KASSE_BLATT._feld("kasse-code", "Code", "ABC234", "text", KASSE.CODE_LAENGE + 2);
                code.feld.autocapitalize = "characters";
                beitreten.appendChild(code.zeile);
                const knopfBeitreten = DIALOG.knopf("Beitreten", "still", async () => {
                    code.fehler.textContent = "";
                    KASSE_BLATT._beschaeftigt(el, true);
                    const e = await STEUERUNG.beitreten(code.feld.value);
                    KASSE_BLATT._beschaeftigt(el, false);
                    if (e.ok) {
                        UPCREW_BLATT.schliessen();
                        return;
                    }
                    code.fehler.textContent = e.text || "Abgelehnt";
                });
                beitreten.appendChild(KASSE_BLATT._knoepfe(knopfBeitreten));
                KASSE_BLATT._enter(code.feld, knopfBeitreten);
                name.feld.focus();
            }
        });
    },

    /* Den Beitrittscode groß zeigen — zum Vorlesen oder Abschreiben. */
    code() {
        const stand = STEUERUNG.stand;
        if (!stand || typeof UPCREW_BLATT === "undefined") {
            return;
        }
        UPCREW_BLATT.oeffnen({
            art: "karte",
            titel: stand.name,
            inhalt: (el) => {
                const gross = document.createElement("div");
                gross.className = "code-gross";
                gross.textContent = stand.code;
                el.appendChild(gross);
                const unter = document.createElement("p");
                unter.className = "code-unter";
                unter.textContent = "Code zum Beitreten";
                el.appendChild(unter);
                el.appendChild(KASSE_BLATT._knoepfe(DIALOG.knopf("Ok", "haupt", () => UPCREW_BLATT.schliessen())));
            }
        });
    },

    /* Produkt anlegen: Strichcode scannen (Kamera, Stufe 4) oder Nummer von Hand → Suche in der
       Strichcode-Datenbank füllt Name, Marke, Bild; alles bleibt änderbar. Ohne Kamera-API gibt
       es keinen Scan-Knopf. Ohne Treffer: Name von Hand. */
    produkt() {
        if (typeof UPCREW_BLATT === "undefined") {
            return;
        }
        let bild = "";
        let scan = null;
        UPCREW_BLATT.oeffnen({
            titel: "Produkt",
            klasse: "blatt-produkt",
            inhalt: (el) => {
                const abschnitt = KASSE_BLATT._abschnitt(el, "");
                const nummer = KASSE_BLATT._feld("produkt-ean", "Strichcode", "4012345678901", "text", 20);
                nummer.feld.inputMode = "numeric";
                abschnitt.appendChild(nummer.zeile);

                const reihe = document.createElement("div");
                reihe.className = "feld-reihe";
                const scannen = DIALOG.knopf("Scannen", "still", () => KASSE_BLATT._scanStarten(el, abschnitt, nummer, suchen));
                if (typeof SCANNER === "undefined" || !SCANNER.verfuegbar()) {
                    scannen.hidden = true;
                }
                const suchenKnopf = DIALOG.knopf("Suchen", "still", () => suchen());
                reihe.appendChild(scannen);
                reihe.appendChild(suchenKnopf);
                abschnitt.appendChild(reihe);

                const vorschau = document.createElement("div");
                vorschau.className = "vorschau-produkt";
                vorschau.hidden = true;
                abschnitt.appendChild(vorschau);

                const name = KASSE_BLATT._feld("produkt-name", "Name", "Milch", "text", KASSE.NAME_MAX);
                const marke = KASSE_BLATT._feld("produkt-marke", "Marke", "", "text", KASSE.NAME_MAX);
                abschnitt.appendChild(name.zeile);
                abschnitt.appendChild(marke.zeile);

                async function suchen() {
                    nummer.fehler.textContent = "";
                    vorschau.hidden = true;
                    bild = "";
                    const ean = PRODUKTSUCHE.eanPruefen(nummer.feld.value);
                    if (!ean) {
                        nummer.fehler.textContent = "8 bis 14 Ziffern";
                        return;
                    }
                    nummer.feld.value = ean;
                    KASSE_BLATT._beschaeftigt(el, true);
                    try {
                        const e = await PRODUKTSUCHE.suchen(ean);
                        if (!e.ok) {
                            nummer.fehler.textContent = e.text || "Dienst antwortet nicht";
                            return;
                        }
                        if (!e.gefunden) {
                            nummer.fehler.textContent = "Nicht gefunden · Name von Hand";
                            name.feld.focus();
                            return;
                        }
                        name.feld.value = e.name;
                        marke.feld.value = e.marke;
                        bild = e.bild;
                        KASSE_BLATT._vorschauFuellen(vorschau, e);
                    } catch (fehler) {
                        const netz = (typeof UPCREW_OFFLINE !== "undefined") && UPCREW_OFFLINE.istNetzFehler(fehler);
                        nummer.fehler.textContent = netz ? "Kein Netz · Name von Hand" : "Dienst antwortet nicht";
                    } finally {
                        KASSE_BLATT._beschaeftigt(el, false);
                    }
                }

                const knopf = DIALOG.knopf("Anlegen", "haupt", async () => {
                    name.fehler.textContent = "";
                    if (!name.feld.value.trim()) {
                        name.fehler.textContent = "Name fehlt";
                        return;
                    }
                    const ok = await STEUERUNG.produktAnlegen({
                        name: name.feld.value, marke: marke.feld.value,
                        ean: PRODUKTSUCHE.eanPruefen(nummer.feld.value), bild: bild
                    });
                    if (ok) {
                        UPCREW_BLATT.schliessen();
                        return;
                    }
                    name.fehler.textContent = "Abgelehnt";
                });
                abschnitt.appendChild(KASSE_BLATT._knoepfe(knopf));
                KASSE_BLATT._enter(nummer.feld, suchenKnopf);
                KASSE_BLATT._enter(name.feld, knopf);
                KASSE_BLATT._enter(marke.feld, knopf);
                scan = { el: el };
                (scannen.hidden ? name.feld : nummer.feld).focus();
            },
            beimSchliessen: () => {
                if (typeof SCANNER !== "undefined") {
                    SCANNER.stoppen();
                }
                scan = null;
            }
        });
    },

    /* Die Kamera im Blatt: Bild, „Abbrechen"; der erste Code füllt die Nummer und sucht. */
    async _scanStarten(el, abschnitt, nummer, suchen) {
        if (typeof SCANNER === "undefined" || !SCANNER.verfuegbar()) {
            return;
        }
        const alt = abschnitt.querySelector(".scan");
        if (alt) {
            alt.remove();
        }
        const huelle = document.createElement("div");
        huelle.className = "scan";
        const video = document.createElement("video");
        video.setAttribute("aria-label", "Kamera");
        huelle.appendChild(video);
        const abbrechen = DIALOG.knopf("Abbrechen", "still", () => { SCANNER.stoppen(); huelle.remove(); });
        abbrechen.classList.add("scan-abbrechen");
        huelle.appendChild(abbrechen);
        abschnitt.insertBefore(huelle, abschnitt.firstChild);
        nummer.fehler.textContent = "";
        try {
            await SCANNER.starten(video, (code) => {
                huelle.remove();
                nummer.feld.value = code;
                suchen();
            });
        } catch (fehler) {
            huelle.remove();
            nummer.fehler.textContent = "Kamera nicht erlaubt";
        }
    },

    _vorschauFuellen(vorschau, e) {
        vorschau.textContent = "";
        if (e.bild) {
            const img = document.createElement("img");
            img.src = e.bild;
            img.alt = "";
            img.referrerPolicy = "no-referrer";
            vorschau.appendChild(img);
        }
        const text = document.createElement("div");
        const name = document.createElement("b");
        name.textContent = e.name;
        const marke = document.createElement("small");
        marke.textContent = e.marke || "";
        text.appendChild(name);
        text.appendChild(marke);
        vorschau.appendChild(text);
        vorschau.hidden = false;
    },

    /* ---------------------------------------------------------------- *
     * Helfer (dieselbe Form wie die Felder der Anmeldung)
     * ---------------------------------------------------------------- */

    _abschnitt(el, titel) {
        const a = document.createElement("section");
        a.className = "blatt-abschnitt";
        if (titel) {
            const h = document.createElement("h3");
            h.className = "blatt-abschnitt-titel";
            h.textContent = titel;
            a.appendChild(h);
        }
        el.appendChild(a);
        return a;
    },

    _feld(kennung, titel, platzhalter, art, maxLaenge) {
        const zeile = document.createElement("div");
        zeile.className = "feld-zeile";
        const label = document.createElement("label");
        label.textContent = titel;
        label.htmlFor = "blatt-" + kennung;
        const feld = document.createElement("input");
        feld.id = "blatt-" + kennung;
        feld.className = "feld";
        feld.type = art || "text";
        feld.placeholder = platzhalter || "";
        feld.autocomplete = "off";
        feld.spellcheck = false;
        if (maxLaenge) {
            feld.maxLength = maxLaenge;
        }
        const fehler = document.createElement("div");
        fehler.className = "feld-fehler";
        fehler.setAttribute("role", "alert");
        zeile.appendChild(label);
        zeile.appendChild(feld);
        zeile.appendChild(fehler);
        return { zeile: zeile, feld: feld, fehler: fehler };
    },

    _knoepfe(...liste) {
        const k = document.createElement("div");
        k.className = "blatt-knoepfe";
        for (const knopf of liste) {
            k.appendChild(knopf);
        }
        return k;
    },

    _enter(feld, knopf) {
        feld.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                knopf.click();
            }
        });
    },

    _beschaeftigt(el, ja) {
        if (ja) {
            el.setAttribute("aria-busy", "true");
        } else {
            el.removeAttribute("aria-busy");
        }
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = KASSE_BLATT;
}
