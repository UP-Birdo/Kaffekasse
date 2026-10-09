/*
 * bildschirm-kasse.js — die Blätter rund um die Kasse (über upcrew-blatt.js, die Seite bleibt
 * dahinter sichtbar): Kasse anlegen oder beitreten, Kasse-Karte (Code, Wechseln), Produkt
 * anlegen, Code zeigen und seit 0.6.0 das Packungs-Blatt (Kaufdatum, Preis, geöffnet, leer).
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

    /* Die Kasse-Karte (Tipp auf die Kasse im Start, Menü „Kasse“): Name, Code als Etikett,
       Mitglieder; „Wechseln“ öffnet Anlegen/Beitreten. Ohne Kasse gleich das Blatt „Kasse“. */
    kasseKarte() {
        const stand = STEUERUNG.stand;
        if (typeof UPCREW_BLATT === "undefined") {
            return;
        }
        if (!stand) {
            KASSE_BLATT.kasse();
            return;
        }
        UPCREW_BLATT.oeffnen({
            art: "karte",
            titel: stand.name,
            inhalt: (el) => {
                const gross = document.createElement("div");
                gross.className = "code-gross";
                gross.textContent = stand.code;
                gross.setAttribute("aria-label", "Code " + stand.code.split("").join(" "));
                el.appendChild(gross);
                const unter = document.createElement("p");
                unter.className = "code-unter";
                const anzahl = Object.keys(stand.mitglieder).length;
                unter.textContent = "Code · " + anzahl + (anzahl === 1 ? " Mitglied" : " Mitglieder");
                el.appendChild(unter);
                const wechseln = DIALOG.knopf("Wechseln", "still", () => {
                    UPCREW_BLATT.schliessen();
                    KASSE_BLATT.kasse();
                });
                el.appendChild(KASSE_BLATT._knoepfe(DIALOG.knopf("Ok", "haupt", () => UPCREW_BLATT.schliessen()), wechseln));
            }
        });
    },

    /* Das Packungs-Blatt (Tipp auf „Eben …“, eine Verlauf-Zeile, eine der letzten Packungen):
       Kaufdatum und Preis (nur wer gekauft hat), geöffnet und leer (jedes Mitglied), jedes
       Datum frei wählbar, auch rückwirkend; „Jetzt“ als schneller Knopf. Zum Preis ein
       Vorschlag aus Open Prices, wenn es einen gibt. Rechte und Prüfung: das Modell.
       Seit 0.7.0 dazu Laden (Auswahl = alle Läden der Kasse), Angebot, MHD — nur Käufer.
       `vorgabe` (wahlfrei, aus der Leiste nach dem „+“): { laden, preis, angebot, mhd } füllt
       leere Felder vor; gespeichert wird erst mit „Speichern“. */
    packung(eintragId, vorgabe) {
        const S = STEUERUNG;
        const stand = S.stand;
        const e = (stand && stand.eintraege) ? stand.eintraege[eintragId] : null;
        if (!e || typeof UPCREW_BLATT === "undefined") {
            return;
        }
        const vor = vorgabe || {};
        const eintrag = Object.assign({ id: eintragId }, e);
        const produkt = stand.produkte[e.produktId] || { name: "Produkt", ean: "" };
        const uid = (typeof KONTO !== "undefined") ? KONTO.uid() : null;
        const kauf = S.darfKaufAendern(eintrag);
        const zustand = S.darfZustandAendern(eintrag);
        const name = (wer) => (wer === uid ? "Du" : (KASSE.mitgliedName(stand, wer) || "Ehemals"));
        UPCREW_BLATT.oeffnen({
            titel: produkt.name,
            klasse: "blatt-packung",
            inhalt: (el) => {
                const kopf = document.createElement("p");
                kopf.className = "packung-kopf";
                kopf.textContent = name(e.wer) + (e.menge > 1 ? " · " + e.menge + " Packungen" : "")
                    + (KASSE.gueltig(e) ? "" : " · zurück");
                el.appendChild(kopf);

                const kaufTeil = KASSE_BLATT._abschnitt(el, "Kauf");
                const gekauft = KASSE_BLATT._zeitFeld(kaufTeil, "gekauft", "Gekauft", KASSE.kaufZeit(e), kauf, false);
                const preis = KASSE_BLATT._feld("packung-preis", "Preis je Packung", "1,29", "text", 9);
                preis.feld.inputMode = "decimal";
                preis.feld.value = KASSE.preisAlsText(typeof e.preis === "number" ? e.preis : (kauf ? vor.preis : undefined));
                preis.feld.disabled = !kauf;
                kaufTeil.appendChild(preis.zeile);
                const vorschlag = document.createElement("div");
                vorschlag.className = "packung-vorschlag";
                vorschlag.hidden = true;
                kaufTeil.appendChild(vorschlag);

                const laden = KASSE_BLATT._feld("packung-laden", "Laden", "Lidl", "text", KASSE.LADEN_MAX);
                laden.feld.value = e.laden || (kauf && vor.laden) || "";
                laden.feld.disabled = !kauf;
                const auswahl = document.createElement("datalist");
                auswahl.id = "blatt-packung-laeden";
                for (const l of BESTAND.laeden(stand)) {
                    const o = document.createElement("option");
                    o.value = l.laden;
                    auswahl.appendChild(o);
                }
                laden.feld.setAttribute("list", auswahl.id);
                laden.zeile.appendChild(auswahl);
                kaufTeil.appendChild(laden.zeile);

                const angebotZeile = document.createElement("label");
                angebotZeile.className = "feld-haken";
                const angebot = document.createElement("input");
                angebot.type = "checkbox";
                angebot.id = "blatt-packung-angebot";
                angebot.checked = e.angebot === true || (kauf && vor.angebot === true);
                angebot.disabled = !kauf;
                const angebotText = document.createElement("span");
                angebotText.textContent = "Im Angebot";
                angebotZeile.appendChild(angebot);
                angebotZeile.appendChild(angebotText);
                kaufTeil.appendChild(angebotZeile);

                const mhd = KASSE_BLATT._feld("packung-mhd", "MHD", "", "date", 0);
                mhd.feld.value = KASSE.alsDatum(e.mhd || (kauf ? vor.mhd : 0));
                mhd.feld.disabled = !kauf;
                kaufTeil.appendChild(mhd.zeile);
                if (!kauf) {
                    kaufTeil.appendChild(KASSE_BLATT._hinweis("Nur Käufer"));
                }

                const offenTeil = KASSE_BLATT._abschnitt(el, "Geöffnet");
                const geoeffnet = KASSE_BLATT._zeitFeld(offenTeil, "geoeffnet", "Geöffnet", e.geoeffnetAm, zustand, true);
                if (e.geoeffnetAm) {
                    offenTeil.appendChild(KASSE_BLATT._hinweis("von " + name(e.geoeffnetVon)));
                }
                const leerTeil = KASSE_BLATT._abschnitt(el, "Leer");
                const leer = KASSE_BLATT._zeitFeld(leerTeil, "leer", "Leer", e.leerAm, zustand, true);
                if (e.leerAm) {
                    leerTeil.appendChild(KASSE_BLATT._hinweis("von " + name(e.leerVon)));
                }

                const fehler = document.createElement("div");
                fehler.className = "feld-fehler";
                fehler.setAttribute("role", "alert");
                el.appendChild(fehler);

                const speichern = DIALOG.knopf("Speichern", "haupt", async () => {
                    fehler.textContent = "";
                    const felder = {};
                    const zeitGeaendert = (feld, bisher) => feld.value !== KASSE.alsEingabe(bisher);
                    if (kauf && zeitGeaendert(gekauft, KASSE.kaufZeit(e))) {
                        felder.gekauftAm = gekauft.value ? KASSE.ausEingabe(gekauft.value) : null;
                    }
                    if (kauf && preis.feld.value.trim() !== KASSE.preisAlsText(e.preis)) {
                        const cent = KASSE.preisAusText(preis.feld.value);
                        if (cent === -1) {
                            fehler.textContent = "Preis ungültig";
                            return;
                        }
                        felder.preis = cent;
                    }
                    if (kauf && KASSE.ladenText(laden.feld.value) !== (e.laden || "")) {
                        felder.laden = KASSE.ladenText(laden.feld.value) || null;
                    }
                    if (kauf && angebot.checked !== (e.angebot === true)) {
                        felder.angebot = angebot.checked ? true : null;
                    }
                    if (kauf && mhd.feld.value !== KASSE.alsDatum(e.mhd)) {
                        felder.mhd = mhd.feld.value ? KASSE.ausDatum(mhd.feld.value) : null;
                    }
                    if (zustand && zeitGeaendert(geoeffnet, e.geoeffnetAm)) {
                        felder.geoeffnetAm = geoeffnet.value ? KASSE.ausEingabe(geoeffnet.value) : null;
                    }
                    if (zustand && zeitGeaendert(leer, e.leerAm)) {
                        felder.leerAm = leer.value ? KASSE.ausEingabe(leer.value) : null;
                    }
                    const r = await S.packungAendern(eintragId, felder);
                    if (!r.ok) {
                        fehler.textContent = r.text || "Abgelehnt";
                        return;
                    }
                    UPCREW_BLATT.schliessen();
                });
                speichern.disabled = !(kauf || zustand);
                const knoepfe = [speichern];
                if (S.darfZuruecknehmen(eintrag)) {
                    knoepfe.push(DIALOG.knopf("Zurücknehmen", "still", async () => {
                        const ja = await DIALOG.zweiSchritt({ titel: produkt.name, text: "Eintrag zurücknehmen?", erst: "Zurücknehmen", dann: "Wirklich" });
                        if (ja) {
                            await S.zuruecknehmen(eintragId);
                            UPCREW_BLATT.schliessen();
                        }
                    }));
                }
                el.appendChild(KASSE_BLATT._knoepfe(...knoepfe));

                /* Der Preis-Vorschlag kommt still nach — oder gar nicht. */
                if (kauf && produkt.ean && typeof PRODUKTSUCHE !== "undefined") {
                    PRODUKTSUCHE.preisVorschlag(produkt.ean).then((v) => {
                        if (!v || !v.gefunden || !vorschlag.isConnected) {
                            return;
                        }
                        vorschlag.textContent = "";
                        const text = document.createElement("span");
                        text.textContent = "Vorschlag " + KASSE.euro(v.cent) + " · " + v.anzahl + (v.anzahl === 1 ? " Meldung" : " Meldungen");
                        vorschlag.appendChild(text);
                        vorschlag.appendChild(DIALOG.knopf("Übernehmen", "still", () => {
                            preis.feld.value = KASSE.preisAlsText(v.cent);
                        }));
                        vorschlag.hidden = false;
                    });
                }
            }
        });
    },

    /* Ein Datum mit Uhrzeit, frei wählbar; dazu „Jetzt“ und (wahlfrei) „Löschen“. → das Feld. */
    _zeitFeld(abschnitt, kennung, titel, ms, darf, mitLoeschen) {
        const f = KASSE_BLATT._feld("packung-" + kennung, titel, "", "datetime-local", 0);
        f.feld.value = KASSE.alsEingabe(ms);
        f.feld.disabled = !darf;
        abschnitt.appendChild(f.zeile);
        if (darf) {
            const reihe = document.createElement("div");
            reihe.className = "feld-reihe";
            reihe.appendChild(DIALOG.knopf("Jetzt", "still", () => { f.feld.value = KASSE.alsEingabe(STEUERUNG.jetzt()); }));
            if (mitLoeschen) {
                reihe.appendChild(DIALOG.knopf("Löschen", "still", () => { f.feld.value = ""; }));
            }
            abschnitt.appendChild(reihe);
        }
        return f.feld;
    },

    _hinweis(text) {
        const h = document.createElement("div");
        h.className = "feld-hinweis";
        h.textContent = text;
        return h;
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
