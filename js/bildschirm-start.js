/*
 * bildschirm-start.js — der Tab „Bestand“ (Mitte, beim Start offen; bis 0.6.0 „Start“; Nutzer
 * 09.10.2026: „in der mitte … das wichtigste … der bestand“). Oben der Profil-Kopf wie in den
 * Spielen (js\profil.js; ohne Profil-Baustein eine schlichte Kopfzeile), rechts der Anker des
 * Offline-Zeichens (seit 0.8.0 am Profilbild); darunter die Kasse-Karte (Name, Mitglieder,
 * Code als Etikett) und je Produkt eine Bestand-Karte mit seinen PACKUNGEN (0.8.0): offene
 * mit „bis …“ und Balken, verschlossene mit MHD, bei langer Liste hinter „Im Schrank“ — und
 * unten „+ Gekauft“. Nach dem „+“ die kleine Leiste „Laden · Angebot · MHD“ (vorbefüllt);
 * „Eben …“ und jede Zeile öffnen das Packungs-Blatt.
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
        kopf.appendChild(profil);
        ort.appendChild(kopf);
        START.profilEl = profil;
        PROFIL.kopf(profil);

        if (START.offlineGriff) {
            START.offlineGriff.aus();
            START.offlineGriff = null;
        }
        if (typeof UPCREW_OFFLINE !== "undefined") {
            /* Am Profilbild unten links wie in Blunderluck (0.8.0) — bis 0.7.2 hielt ein leerer
               Platz rechts im Kopf 42 px frei und schob den Menü-Knopf nach innen. Eigene Texte: hier wird
               nichts gespielt, es warten Einträge. */
            START.offlineGriff = UPCREW_OFFLINE.an(profil.querySelector(".up-pf-kz-feld") || profil, { ecke: "unten-links",
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

    /* Die Bestand-Karte eines Produkts (seit 0.8.0, Nutzer 10.10.2026: „nicht das Produkt
       beschrieben, sondern von wann bis wann es offen haltbar ist und wie viele im Bestand
       sind, mit dem Bild … jedes Produkt untereinander … alles was im Vorrat ist und was offen
       ist, darunter das Plus; wird die Liste zu lang, nur die offenen, der Rest in einem
       Untermenü“):
         Kopf    Bild · Name · „1 offen · 2 im Schrank“ (Leer rot) · Hinweis nur, wenn etwas zu
                 tun ist (Jetzt kaufen, MHD bald)
         Liste   je OFFENE Packung: „bis Sa 12.10.“, geöffnet am, noch n Tage, Balken, „Leer“;
                 je VERSCHLOSSENE: MHD, gekauft am, „Öffnen“. Mehr als ZEILEN_MAX Zeilen: die
                 offenen bleiben, die verschlossenen klappen hinter „Im Schrank: n ›“
         Fuß     Kurz-Leiste nach dem Kauf, „Eben …“ und „+ Gekauft“ (= eine neue Packung)
       Tipp auf eine Zeile → das Packungs-Blatt (Preis, Laden, Daten ändern). Angebote, Reicht
       bis und Dran stehen in Statistik und im Produkt-Blatt. */
    ZEILEN_MAX: 3,
    aufgeklappt: {},

    _produktKarte(stand, produkt) {
        const S = STEUERUNG;
        const jetzt = S.jetzt();
        const l = BESTAND.lage(stand, produkt.id, jetzt);
        const p = BESTAND.packungen(stand, produkt.id, jetzt);

        const karte = document.createElement("section");
        karte.className = "produkt bk" + (l.leer ? " produkt-leer" : "");
        karte.setAttribute("aria-label", produkt.name);

        const kopf = document.createElement("div");
        kopf.className = "bk-kopf";
        kopf.appendChild(START._produktBild(produkt));
        const text = document.createElement("div");
        text.className = "produkt-text";
        const titel = document.createElement("b");
        titel.className = "produkt-name";
        titel.textContent = produkt.name;
        text.appendChild(titel);
        const lage = document.createElement("span");
        lage.className = "bk-lage" + (l.leer ? " bestand-leer" : "");
        lage.textContent = l.leer ? "Leer" : [
            p.offen.length ? p.offen.length + " offen" : "",
            p.vorrat ? p.vorrat + " im Schrank" : ""
        ].filter(Boolean).join(" · ");
        text.appendChild(lage);
        kopf.appendChild(text);
        if (l.tipp && (l.tipp.art === "kaufen" || l.tipp.art === "mhd")) {
            const tipp = document.createElement("span");
            tipp.className = "bestand-tipp tipp-" + l.tipp.art;
            tipp.textContent = l.tipp.text;
            kopf.appendChild(tipp);
        }
        karte.appendChild(kopf);

        const liste = document.createElement("div");
        liste.className = "bk-liste";
        for (const e of p.offen) {
            liste.appendChild(START._zeileOffen(e, jetzt));
        }
        const zuViele = p.offen.length + p.zu.length > START.ZEILEN_MAX && p.zu.length > 0;
        const offenZu = !zuViele || START.aufgeklappt[produkt.id];
        if (zuViele) {
            liste.appendChild(START._schrankKnopf(produkt.id, p, jetzt, offenZu));
        }
        if (offenZu) {
            for (const e of p.zu) {
                liste.appendChild(START._zeileZu(e, jetzt));
            }
        }
        if (liste.childNodes.length) {
            karte.appendChild(liste);
        }

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

        /* „+“ = ich habe eine Packung gekauft (kommt verschlossen in den Schrank). */
        const plus = DIALOG.knopf("", "haupt", async () => {
            plus.disabled = true;
            const eintragId = await S.kaufen(produkt.id, 1);
            if (eintragId) {
                START.schnellZeigen(produkt.id, eintragId);
                return;
            }
            /* Abgelehnt (nicht mehr Mitglied, Produkt ausgeblendet …): Knopf wieder frei und
               sagen, warum nichts passiert — bis 0.7.2 blieb er grau ohne Meldung. */
            plus.disabled = false;
            DIALOG.hinweis({ titel: produkt.name, text: "Nicht eingetragen" });
        });
        plus.classList.add("produkt-plus", "bk-plus");
        plus.appendChild(ZUSTAND.zeichen("plus", "bk-plus-zeichen"));
        plus.appendChild(document.createTextNode("Gekauft"));
        plus.setAttribute("aria-label", produkt.name + " gekauft");
        karte.appendChild(plus);
        return karte;
    },

    /* „Sa 12.10.“ · „heute“ · „gestern“ (mit Jahr, wenn es ein anderes ist). */
    _tag(ms, jetzt) {
        const kurz = KASSE.datumKurz(ms, jetzt);
        if (kurz === "heute" || kurz === "gestern" || kurz === "–") {
            return kurz;
        }
        return ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][new Date(ms).getDay()] + " " + kurz;
    },

    /* Eine Zeile der Liste: Haupttext (Tipp → Packungs-Blatt) und rechts EIN Knopf. */
    _zeile(klasse, marke, oben, unten, knopfText, beiKnopf, eintragId, mengeText) {
        const zeile = document.createElement("div");
        zeile.className = "bk-zeile " + klasse;
        const haupt = document.createElement("button");
        haupt.type = "button";
        haupt.className = "bk-zeile-text";
        haupt.addEventListener("click", () => KASSE_BLATT.packung(eintragId));
        const m = document.createElement("span");
        m.className = "bk-marke";
        m.textContent = marke;
        haupt.appendChild(m);
        const mitte = document.createElement("span");
        mitte.className = "bk-mitte";
        const b = document.createElement("b");
        b.textContent = oben + (mengeText || "");
        mitte.appendChild(b);
        const s = document.createElement("small");
        s.textContent = unten;
        mitte.appendChild(s);
        haupt.appendChild(mitte);
        zeile.appendChild(haupt);
        const knopf = DIALOG.knopf(knopfText, "still", async () => {
            knopf.disabled = true;
            const e = await beiKnopf();
            if (e && e.ok === false) {
                knopf.disabled = false;
                DIALOG.hinweis({ titel: knopfText, text: e.text || "Abgelehnt" });
            }
        });
        knopf.classList.add("bk-knopf");
        zeile.appendChild(knopf);
        return { zeile: zeile, mitte: mitte };
    },

    _zeileOffen(e, jetzt) {
        const oben = e.bis ? "bis " + START._tag(e.bis, jetzt) : "offen";
        const unten = "geöffnet " + START._tag(e.geoeffnetAm, jetzt) + (e.bis ? " · " + BESTAND.restText(e.restTage) : "");
        const z = START._zeile("bk-offen" + (e.restTage !== null && e.restTage <= 0 ? " bk-drueber" : e.restTage !== null && e.restTage <= 1 ? " bk-knapp" : ""),
            "Offen", oben, unten, "Leer",
            () => STEUERUNG.packungAendern(e.id, { leerAm: STEUERUNG.jetzt() }), e.id,
            e.menge > 1 ? " · " + e.menge + " Stk." : "");
        if (e.anteil !== null) {
            const balken = document.createElement("span");
            balken.className = "bk-balken";
            const fuell = document.createElement("span");
            fuell.style.width = Math.round((1 - e.anteil) * 100) + "%";
            balken.appendChild(fuell);
            z.mitte.appendChild(balken);
        }
        return z.zeile;
    },

    _zeileZu(e, jetzt) {
        const oben = e.mhd ? "MHD " + START._tag(e.mhd, jetzt) : "ohne MHD";
        const unten = "gekauft " + START._tag(e.kauf, jetzt) + (e.abgelaufen ? " · abgelaufen" : "");
        return START._zeile("bk-zu" + (e.abgelaufen ? " bk-drueber" : ""), "Zu", oben, unten, "Öffnen",
            () => STEUERUNG.packungAendern(e.id, { geoeffnetAm: STEUERUNG.jetzt() }), e.id,
            e.menge > 1 ? " · " + e.menge + " Stk." : "").zeile;
    },

    /* Das Untermenü der verschlossenen Packungen (nur bei langer Liste). */
    _schrankKnopf(produktId, p, jetzt, offen) {
        const knopf = document.createElement("button");
        knopf.type = "button";
        knopf.className = "bk-schrank";
        knopf.setAttribute("aria-expanded", offen ? "true" : "false");
        const mhd = p.zu.find((e) => e.mhd);
        const text = document.createElement("span");
        text.textContent = "Im Schrank: " + p.vorrat + (mhd ? " · MHD ab " + START._tag(mhd.mhd, jetzt) : "");
        knopf.appendChild(text);
        knopf.appendChild(ZUSTAND.zeichen("pfeil", "bk-schrank-pfeil"));
        knopf.addEventListener("click", () => {
            START.aufgeklappt[produktId] = !START.aufgeklappt[produktId];
            NAVIGATION.veralten("start");
        });
        return knopf;
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
