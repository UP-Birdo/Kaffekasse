/*
 * bildschirm-start.js — der Tab „Bestand“ (Mitte, beim Start offen; bis 0.6.0 „Start“; Nutzer
 * 09.10.2026: „in der mitte … das wichtigste … der bestand“). Oben der Profil-Kopf wie in den
 * Spielen (js\profil.js; ohne Profil-Baustein eine schlichte Kopfzeile), rechts der Anker des
 * Offline-Zeichens; darunter die Kasse-Karte (Name, Mitglieder, Code als Etikett) und je
 * Produkt eine Bestand-Karte: reicht bis ~, Tipp, offen seit (von wem klein), Vorrat
 * verschlossen (Anzahl, älteste seit, MHD), Angebot je Laden, „Dran“ klein — und die EINE
 * Hauptaktion „+“. Nach dem „+“ die kleine Leiste „Laden · Angebot · MHD“ (vorbefüllt);
 * „Eben …“ öffnet das Packungs-Blatt.
 *
 * Der Bildschirm rechnet nichts — Zahlen und Regeln kommen aus dem Modell (js\kasse.js,
 * js\bestand.js),
 * geschrieben wird über die Steuerung (js\steuerung.js). Er zeichnet neu, wenn die
 * Steuerung meldet (`beobachten`). Ohne Kasse: der Zustand „Leer" mit dem Knopf „Kasse".
 * Der Quellenhinweis der Produktdaten steht NICHT hier (Nutzer 09.10.2026), sondern im
 * Produkt-Blatt und unter „Über Kaffekasse“.
 */

const START = {

    offlineGriff: null,
    profilEl: null,
    loesen: null,

    zeichnen(ort) {
        ort.textContent = "";

        const kopf = document.createElement("header");
        kopf.className = "kopf";
        kopf.setAttribute("data-up-bl-kopf", "");
        const profil = document.createElement("div");
        profil.className = "kopf-profil";
        const rechts = document.createElement("div");
        rechts.className = "kopf-rechts";
        kopf.appendChild(profil);
        kopf.appendChild(rechts);
        ort.appendChild(kopf);
        START.profilEl = profil;
        PROFIL.kopf(profil);

        if (START.offlineGriff) {
            START.offlineGriff.aus();
            START.offlineGriff = null;
        }
        if (typeof UPCREW_OFFLINE !== "undefined") {
            /* Eigene Texte: hier wird nichts gespielt, es warten Einträge. */
            START.offlineGriff = UPCREW_OFFLINE.an(rechts, { ecke: "rechts",
                texte: { name: "Offline", blaseTitel: "Offline", blaseText: "Einträge warten aufs Netz", hochgeladen: "Gesendet" } });
        }

        const inhalt = document.createElement("div");
        inhalt.className = "start-inhalt";
        ort.appendChild(inhalt);
        START._inhalt(inhalt);

        if (!START.loesen) {
            START.loesen = STEUERUNG.beobachten(() => NAVIGATION.veralten("start"));
        }
    },

    _inhalt(ort) {
        const S = STEUERUNG;
        if (!S.hatKasse()) {
            const karte = START._karte(ort, "Kasse");
            karte.appendChild(ZUSTAND.leer({ zeichen: "tasse", text: "Noch keine Kasse", aktion: { text: "Kasse", bei: () => KASSE_BLATT.kasse() } }));
            return;
        }
        if (!S.stand) {
            const karte = START._karte(ort, "Kasse");
            if (S.zustand === "fehler") {
                karte.appendChild(ZUSTAND.fehler({ text: S.technik === "Kein Netz" ? "Kein Netz" : "Kasse nicht da", nochmal: () => S.laden(), technik: S.technik }));
            } else {
                karte.appendChild(ZUSTAND.laden({ zeilen: 3, nochmal: () => S.laden() }));
            }
            return;
        }
        START._kasseKopf(ort, S.stand);
        const produkte = KASSE.produkteAktiv(S.stand);
        if (produkte.length === 0) {
            const karte = START._karte(ort, "Produkte");
            karte.appendChild(ZUSTAND.leer({ zeichen: "plus", text: "Noch kein Produkt", aktion: { text: "Produkt", bei: () => KASSE_BLATT.produkt() } }));
            return;
        }
        for (const produkt of produkte) {
            ort.appendChild(START._produktKarte(S.stand, produkt));
        }
        const fuss = document.createElement("div");
        fuss.className = "start-fuss";
        fuss.appendChild(DIALOG.knopf("Produkt", "still", () => KASSE_BLATT.produkt()));
        ort.appendChild(fuss);
    },

    _karte(ort, name) {
        const karte = document.createElement("section");
        karte.className = "karte";
        karte.setAttribute("aria-label", name);
        ort.appendChild(karte);
        return karte;
    },

    /* Name der Kasse, Mitgliederzahl, Code als schlankes Etikett (Tipp → Kasse-Karte). */
    _kasseKopf(ort, stand) {
        const zeile = document.createElement("button");
        zeile.type = "button";
        zeile.className = "kasse-kopf";
        zeile.setAttribute("aria-label", "Kasse " + stand.name);
        const links = document.createElement("div");
        links.className = "kasse-kopf-text";
        const name = document.createElement("b");
        name.textContent = stand.name;
        const unter = document.createElement("small");
        const anzahl = Object.keys(stand.mitglieder).length;
        unter.textContent = anzahl + (anzahl === 1 ? " Mitglied" : " Mitglieder");
        links.appendChild(name);
        links.appendChild(unter);
        const code = document.createElement("span");
        code.className = "kasse-code";
        code.textContent = stand.code;
        zeile.appendChild(links);
        zeile.appendChild(code);
        zeile.addEventListener("click", () => KASSE_BLATT.kasseKarte());
        ort.appendChild(zeile);
    },

    /* Die Bestand-Karte eines Produkts: was DA ist (offen, Vorrat, MHD), reicht bis ~,
       Angebote je Laden, der Tipp — alles aus BESTAND.lage. Mitglieder nur klein („Dran“). */
    _produktKarte(stand, produkt) {
        const S = STEUERUNG;
        const uid = (typeof KONTO !== "undefined") ? KONTO.uid() : null;
        const jetzt = S.jetzt();
        const l = BESTAND.lage(stand, produkt.id, jetzt);
        const dran = KASSE.naechsterDran(stand, produkt.id);
        const name = (wer) => (wer === uid ? "Du" : (KASSE.mitgliedName(stand, wer) || "Ehemals"));

        const karte = document.createElement("section");
        karte.className = "produkt" + (l.leer ? " produkt-leer" : "");
        karte.setAttribute("aria-label", produkt.name);

        karte.appendChild(START._produktBild(produkt));

        const text = document.createElement("div");
        text.className = "produkt-text";
        const titel = document.createElement("b");
        titel.className = "produkt-name";
        titel.textContent = produkt.name;
        text.appendChild(titel);
        const reicht = document.createElement("span");
        reicht.className = "bestand-reicht" + (l.leer ? " bestand-leer" : "");
        reicht.textContent = BESTAND.reichtText(l, jetzt);
        text.appendChild(reicht);
        if (l.tipp) {
            const tipp = document.createElement("span");
            tipp.className = "bestand-tipp tipp-" + l.tipp.art;
            tipp.textContent = l.tipp.text + (l.tipp.menge > 1 ? " · bis " + l.tipp.menge + " Stk." : "");
            text.appendChild(tipp);
        }
        karte.appendChild(text);

        const plus = DIALOG.knopf("+", "haupt", async () => {
            plus.disabled = true;
            const eintragId = await S.kaufen(produkt.id, 1);
            if (eintragId) {
                START.schnellZeigen(produkt.id, eintragId);
            }
        });
        plus.classList.add("produkt-plus", "up-rund");
        plus.setAttribute("aria-label", produkt.name + " eintragen");
        karte.appendChild(plus);

        const fakten = document.createElement("div");
        fakten.className = "bestand-fakten";
        const offen = document.createElement("span");
        if (l.offen) {
            offen.textContent = "Offen seit " + KASSE.datumKurz(l.offen.geoeffnetAm, jetzt);
            const von = document.createElement("small");
            von.textContent = " · " + name(l.offen.geoeffnetVon);
            offen.appendChild(von);
        } else {
            offen.textContent = "Nichts offen";
        }
        fakten.appendChild(offen);
        const vorrat = document.createElement("span");
        vorrat.className = l.abgelaufen > 0 ? "bestand-warnung" : "";
        vorrat.textContent = BESTAND.vorratText(l, jetzt) + (l.abgelaufen > 0 ? " · " + l.abgelaufen + " abgelaufen" : "");
        fakten.appendChild(vorrat);
        for (const a of l.angebote) {
            const zeile = document.createElement("span");
            zeile.className = "bestand-angebot";
            zeile.textContent = BESTAND.angebotText(a, jetzt);
            fakten.appendChild(zeile);
        }
        if (dran) {
            const d = document.createElement("small");
            d.className = "bestand-dran";
            d.textContent = "Dran: " + name(dran);
            fakten.appendChild(d);
        }
        karte.appendChild(fakten);

        const schnell = START._schnellLeiste(stand, produkt);
        if (schnell) {
            karte.appendChild(schnell);
        }

        const eben = S.eigenerLetzter(produkt.id);
        if (eben) {
            const zeile = document.createElement("div");
            zeile.className = "produkt-eben";
            /* Tipp auf „Eben …“ → die Packung: Kaufdatum, Preis, geöffnet, leer. */
            const wann = document.createElement("button");
            wann.type = "button";
            wann.className = "produkt-eben-packung";
            wann.textContent = "Eben · " + KASSE.uhrzeit(eben.wann) + (typeof eben.preis === "number" ? " · " + KASSE.euro(eben.preis) : " · Preis");
            wann.setAttribute("aria-label", "Packung " + produkt.name);
            wann.addEventListener("click", () => KASSE_BLATT.packung(eben.id));
            zeile.appendChild(wann);
            const zurueck = DIALOG.knopf("Zurück", "still", async () => {
                const ja = await DIALOG.zweiSchritt({ titel: produkt.name, text: "Eintrag zurücknehmen?", erst: "Zurücknehmen", dann: "Wirklich" });
                if (ja) {
                    await S.zuruecknehmen(eben.id);
                }
            });
            zurueck.classList.add("produkt-zurueck");
            zeile.appendChild(zurueck);
            karte.appendChild(zeile);
        }
        return karte;
    },

    /* ---------------------------------------------------------------- *
     * Die kleine Leiste nach dem „+“ (seit 0.7.0): „Laden · Angebot · MHD“, vorbefüllt aus
     * dem letzten Kauf. Übernehmen = ein Tipp, Ändern = Packungs-Blatt, nichts tun = sie
     * verschwindet nach KONFIG.vorbelegungMs. Der Kauf selbst steht schon (EIN Tipp auf „+“).
     * ---------------------------------------------------------------- */

    schnell: null,
    schnellUhr: null,

    schnellZeigen(produktId, eintragId) {
        START.schnell = { produktId: produktId, eintragId: eintragId, angebot: false };
        START._schnellUhr();
        NAVIGATION.veralten("start");
    },

    schnellWeg() {
        if (START.schnellUhr) {
            clearTimeout(START.schnellUhr);
            START.schnellUhr = null;
        }
        if (START.schnell) {
            START.schnell = null;
            NAVIGATION.veralten("start");
        }
    },

    _schnellUhr() {
        if (START.schnellUhr) {
            clearTimeout(START.schnellUhr);
        }
        START.schnellUhr = setTimeout(() => {
            START.schnellUhr = null;
            START.schnellWeg();
        }, KONFIG.vorbelegungMs);
    },

    _schnellLeiste(stand, produkt) {
        const sch = START.schnell;
        const e = (sch && sch.produktId === produkt.id && stand.eintraege) ? stand.eintraege[sch.eintragId] : null;
        if (!e || !KASSE.gueltig(e)) {
            return null;
        }
        const jetzt = STEUERUNG.jetzt();
        const vorgabe = STEUERUNG.vorbelegung(sch.eintragId);
        const felder = BESTAND.felder(vorgabe, sch.angebot);
        const leiste = document.createElement("div");
        leiste.className = "bestand-schnell";
        leiste.setAttribute("role", "group");
        leiste.setAttribute("aria-label", "Laden · Angebot · MHD");

        const teile = [];
        if (felder.laden) {
            teile.push(felder.laden);
        }
        if (typeof felder.preis === "number") {
            teile.push(KASSE.euro(felder.preis));
        }
        if (felder.mhd) {
            teile.push("MHD " + KASSE.datumKurz(felder.mhd, jetzt));
        }
        const aendern = document.createElement("button");
        aendern.type = "button";
        aendern.className = "bestand-schnell-text";
        aendern.textContent = teile.length ? teile.join(" · ") : "Laden · Angebot · MHD";
        aendern.setAttribute("aria-label", "Ändern");
        aendern.addEventListener("click", () => {
            const id = sch.eintragId;
            START.schnellWeg();
            KASSE_BLATT.packung(id, felder);
        });
        leiste.appendChild(aendern);

        const angebot = DIALOG.knopf("Angebot", "still", () => {
            sch.angebot = !sch.angebot;
            START._schnellUhr();
            NAVIGATION.veralten("start");
        });
        angebot.classList.add("bestand-schnell-angebot");
        angebot.setAttribute("aria-pressed", sch.angebot ? "true" : "false");
        leiste.appendChild(angebot);

        if (Object.keys(felder).length > 0) {
            const uebernehmen = DIALOG.knopf("Übernehmen", "still", async () => {
                const id = sch.eintragId;
                const mitAngebot = sch.angebot;
                START.schnellWeg();
                await STEUERUNG.vorbelegungUebernehmen(id, mitAngebot);
            });
            leiste.appendChild(uebernehmen);
        }
        return leiste;
    },

    /* Bild aus der Strichcode-Datenbank, sonst ein Platz mit dem Anfangsbuchstaben. */
    _produktBild(produkt) {
        const huelle = document.createElement("div");
        huelle.className = "produkt-bild";
        if (produkt.bild && /^https:\/\//.test(produkt.bild)) {
            const bild = document.createElement("img");
            bild.src = produkt.bild;
            bild.alt = "";
            bild.loading = "lazy";
            bild.referrerPolicy = "no-referrer";
            huelle.appendChild(bild);
            return huelle;
        }
        const kuerzel = document.createElement("span");
        kuerzel.className = "produkt-kuerzel";
        kuerzel.textContent = (produkt.name || "?").charAt(0).toUpperCase();
        if (typeof UPCREW_PLATZ !== "undefined") {
            huelle.appendChild(UPCREW_PLATZ.bauen("produkt/" + (produkt.ean || "ohne-code"), "96x96", { inhalt: kuerzel, klasse: "produkt-platz" }));
        } else {
            huelle.appendChild(kuerzel);
        }
        return huelle;
    },

    /* Nur den Kopf nachziehen (nach dem Laden der Konten), ohne alles neu zu bauen. */
    kopfAktualisieren() {
        if (START.profilEl && START.profilEl.isConnected) {
            PROFIL.kopf(START.profilEl);
        }
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = START;
}
