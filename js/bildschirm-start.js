/*
 * bildschirm-start.js — der Tab „Bestand“ (Mitte, beim Start offen; bis 0.6.0 „Start“; Nutzer
 * 09.10.2026: „in der mitte … das wichtigste … der bestand“). Oben der Profil-Kopf wie in den
 * Spielen (js\profil.js; ohne Profil-Baustein eine schlichte Kopfzeile), rechts der Anker des
 * Offline-Zeichens (seit 0.8.0 am Profilbild); darunter die Kasse-Karte (Name, Mitglieder,
 * Code als Etikett) und je Produkt eine Bestand-Karte mit seinen PACKUNGEN (0.8.0): offene
 * mit „bis …“ und Balken, verschlossene mit MHD, bei langer Liste hinter „Im Schrank“ — und
 * seit 0.9.0 das runde „+“ rechts neben dem Produkt (statt „+ Gekauft“ unten), Tipp auf Bild und
 * Name öffnet alle Fakten des Produkts (Blatt aus js\bildschirm-produkte.js). Nach dem „+“ die
 * kleine Leiste „Laden · Angebot · MHD“ (vorbefüllt); „Eben …“ und jede Zeile öffnen das
 * Packungs-Blatt. Seit 0.11.0 unter der Kasse die Zeile „Einkaufsliste“ (nur wenn etwas bald
 * leer ist) und „haltbar bis“ statt „MHD“ (das Kürzel nur noch in der engen Leiste).
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
        /* Hinweis „Als App nutzen“ (0.10.0, Baustein upcrew-homescreen): nur am Handy, nur solange
           nicht installiert, das Kreuz blendet ihn für immer aus. */
        if (typeof UPCREW_HOMESCREEN !== "undefined") {
            const hinweis = UPCREW_HOMESCREEN.hinweis({ app: KONFIG.APP_NAME, oeffnen: () => EINSTELLUNGEN.homescreenOeffnen() });
            if (hinweis) {
                inhalt.appendChild(hinweis);
            }
        }
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
        START._einkaufZeile(ort);
        const produkte = KASSE.produkteAktiv(S.stand);
        if (produkte.length === 0) {
            const karte = START._karte(ort, "Produkte");
            karte.appendChild(ZUSTAND.leer({ zeichen: "plus", text: "Noch kein Produkt", aktion: { text: "Neues Produkt", bei: () => KASSE_BLATT.produkt() } }));
            return;
        }
        for (const produkt of produkte) {
            ort.appendChild(START._produktKarte(S.stand, produkt));
        }
        /* „Neues Produkt“ (0.9.0, Nutzer 12.10.2026: statt nur „Produkt“). */
        const fuss = document.createElement("div");
        fuss.className = "start-fuss";
        fuss.appendChild(DIALOG.knopf("Neues Produkt", "still", () => KASSE_BLATT.produkt()));
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

    /* „Teilen“ und „Kopieren“ der offenen Liste (0.12.0, wie der Einladen-Block der Kasse-Karte):
       z. B. an den, der gerade einkaufen geht. Ohne offene Zeile keine Knöpfe. */
    _einkaufTeilen(el, liste, jetzt) {
        if (!UPCREW_FREIGABE.darf("einkauf-teilen")) {
            return;
        }
        const text = BESTAND.einkaufTeilen(liste, jetzt, STEUERUNG.stand ? STEUERUNG.stand.name : "");
        if (!text) {
            return;
        }
        const reihe = document.createElement("div");
        reihe.className = "kasse-einladen-knoepfe einkauf-teilen";
        const meldung = document.createElement("div");
        meldung.className = "feld-hinweis einkauf-meldung";
        meldung.setAttribute("role", "status");
        const kopieren = () => {
            const ablage = (typeof navigator !== "undefined") ? navigator.clipboard : null;
            if (!ablage || typeof ablage.writeText !== "function") {
                meldung.textContent = "Kopieren geht hier nicht";
                return;
            }
            ablage.writeText(text).then(() => { meldung.textContent = "Liste kopiert"; },
                () => { meldung.textContent = "Kopieren geht hier nicht"; });
        };
        if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
            reihe.appendChild(DIALOG.knopf("Teilen", "still", () => {
                /* Abbruch durch den Menschen (AbortError) bleibt still; jeder andere Fehler fällt
                   auf „Kopieren“ zurück (Gegenprüfung 0.12.0). */
                navigator.share({ text: text }).catch((fehler) => {
                    if (!fehler || fehler.name !== "AbortError") {
                        kopieren();
                    }
                });
            }));
        }
        reihe.appendChild(DIALOG.knopf("Kopieren", "still", kopieren));
        el.appendChild(reihe);
        el.appendChild(meldung);
    },

    /* ---------------------------------------------------------------- *
     * Einkaufsliste (0.11.0): eine Zeile unter der Kasse, nur wenn etwas bald leer ist; Tipp →
     * Blatt mit je Produkt einem Haken (nur am Gerät) und dem „+“ (EIN Tipp = gekauft).
     * ---------------------------------------------------------------- */

    _einkaufZeile(ort) {
        if (!UPCREW_FREIGABE.darf("einkaufsliste")) {
            return;
        }
        const liste = STEUERUNG.einkauf();
        if (!liste.length) {
            return;
        }
        const offen = liste.filter((x) => !x.abgehakt).length;
        const menue = document.createElement("div");
        menue.className = "menue einkauf-menue";
        menue.appendChild(PRODUKTE.menueZeile("Einkaufsliste",
            offen + (offen === 1 ? " Produkt" : " Produkte") + (offen < liste.length ? " · " + (liste.length - offen) + " abgehakt" : ""),
            () => START.einkaufBlatt()));
        ort.appendChild(menue);
    },

    /* Was in DIESEM Blatt schon per „+“ eingetragen ist ({ produktId: eintragId }) — gilt bis
       zum nächsten Öffnen; so trägt ein zweiter Tipp keine zweite Packung ein. */
    einkaufEben: {},

    einkaufBlatt() {
        if (typeof UPCREW_BLATT === "undefined" || !STEUERUNG.stand) {
            return;
        }
        START.einkaufEben = {};
        UPCREW_BLATT.oeffnen({
            titel: "Einkaufsliste",
            klasse: "blatt-einkauf",
            inhalt: (el) => START._einkaufZeichnen(el)
        });
    },

    /* Neu gezeichnet wird erst NACH dem Tipp (setTimeout 0, Lehre der App): sonst hängt der
       getippte Knopf schon nicht mehr im Blatt, und das Blatt hält den Tipp für einen auf den
       Grund. */
    _einkaufZeichnen(el) {
        el.textContent = "";
        const jetzt = STEUERUNG.jetzt();
        const liste = STEUERUNG.einkauf();
        /* Dieselbe Kennung wie beim Schreiben (Gegenprüfung 0.12.0). */
        const uid = STEUERUNG._uid();
        if (!liste.length) {
            el.appendChild(ZUSTAND.leer({ zeichen: "tasse", text: "Nichts bald leer" }));
            return;
        }
        const gruppe = document.createElement("div");
        gruppe.className = "einkauf-liste";
        for (const x of liste) {
            const eben = !!START.einkaufEben[x.produkt.id];
            const zeile = document.createElement("div");
            zeile.className = "einkauf-zeile" + (x.abgehakt || eben ? " einkauf-ab" : "") + (x.art === "kaufen" && !eben ? " einkauf-kaufen" : "");
            const haken = document.createElement("button");
            haken.type = "button";
            haken.className = "einkauf-haken";
            haken.setAttribute("aria-pressed", x.abgehakt ? "true" : "false");
            haken.setAttribute("aria-label", x.produkt.name + (x.abgehakt ? " · Haken weg" : " · abhaken"));
            const kasten = document.createElement("span");
            kasten.className = "einkauf-kasten";
            kasten.setAttribute("aria-hidden", "true");
            haken.appendChild(kasten);
            const text = document.createElement("span");
            text.className = "einkauf-text";
            const b = document.createElement("b");
            b.textContent = x.produkt.name;
            const s = document.createElement("small");
            s.textContent = eben ? "Eben eingetragen" : BESTAND.einkaufText(x, jetzt, uid);
            text.appendChild(b);
            text.appendChild(s);
            haken.appendChild(text);
            haken.addEventListener("click", () => {
                STEUERUNG.abhaken(x.produkt.id, !x.abgehakt);
                setTimeout(() => {
                    START._einkaufZeichnen(el);
                    NAVIGATION.veralten("start");
                }, 0);
            });
            zeile.appendChild(haken);
            const plus = DIALOG.knopf("", "still", async () => {
                plus.disabled = true;
                const eintragId = await STEUERUNG.kaufen(x.produkt.id, 1);
                if (!eintragId) {
                    plus.disabled = false;
                    DIALOG.hinweis({ titel: x.produkt.name, text: "Nicht eingetragen" });
                    return;
                }
                START.einkaufEben[x.produkt.id] = eintragId;
                START.schnellZeigen(x.produkt.id, eintragId);
                setTimeout(() => START._einkaufZeichnen(el), 0);
            });
            plus.classList.add("einkauf-plus");
            plus.appendChild(ZUSTAND.zeichen("plus", "bk-plus-zeichen"));
            plus.setAttribute("aria-label", x.produkt.name + " gekauft");
            plus.title = "Gekauft";
            if (eben) {
                /* Eben eingetragen: kein zweites „+“ in diesem Blatt (Gegenprüfung 0.11.0). */
                haken.disabled = true;
                haken.setAttribute("aria-pressed", "true");
            } else {
                zeile.appendChild(plus);
            }
            gruppe.appendChild(zeile);
        }
        el.appendChild(gruppe);
        START._einkaufTeilen(el, liste, jetzt);
        const fuss = document.createElement("p");
        fuss.className = "feld-hinweis einkauf-fuss";
        fuss.textContent = BESTAND.ERKLAERUNG.einkauf;
        el.appendChild(fuss);
    },

    /* Die Bestand-Karte eines Produkts (seit 0.8.0, Nutzer 10.10.2026: „nicht das Produkt
       beschrieben, sondern von wann bis wann es offen haltbar ist und wie viele im Bestand
       sind, mit dem Bild … jedes Produkt untereinander … alles was im Vorrat ist und was offen
       ist, darunter das Plus; wird die Liste zu lang, nur die offenen, der Rest in einem
       Untermenü“):
         Kopf    Bild · Name · „1 offen · 2 im Schrank“ (Leer rot) · Hinweis nur, wenn etwas zu
                 tun ist (Jetzt kaufen, MHD bald) · rechts das runde „+“ (0.9.0). Tipp auf Bild
                 und Name → alle Fakten (Nutzer 12.10.2026: „bei Bestand soll man auch auf das
                 Produkt klicken können, um alle Infos zum Produkt selbst zu bekommen“)
         Liste   je OFFENE Packung: „bis Sa 12.10.“, geöffnet am, noch n Tage, Balken, „Leer“;
                 je VERSCHLOSSENE: MHD, gekauft am, „Öffnen“. Mehr als ZEILEN_MAX Zeilen: die
                 offenen bleiben, die verschlossenen klappen hinter „Im Schrank: n ›“
         Fuß     Kurz-Leiste nach dem Kauf und „Eben …“ (das „+“ sitzt seit 0.9.0 im Kopf)
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
        const infos = document.createElement("button");
        infos.type = "button";
        infos.className = "bk-infos";
        infos.setAttribute("aria-label", produkt.name + " · Fakten");
        infos.addEventListener("click", () => PRODUKTE.blatt(produkt.id));
        infos.appendChild(START._produktBild(produkt));
        const text = document.createElement("span");
        text.className = "produkt-text";
        const titel = document.createElement("b");
        titel.className = "produkt-name";
        titel.textContent = produkt.name;
        text.appendChild(titel);
        const lage = document.createElement("span");
        lage.className = "bk-lage" + (l.leer ? " bestand-leer" : "");
        /* Seit 0.10.0 ohne „n im Schrank“ — das steht in der Zeile „Im Schrank“ darunter. */
        lage.textContent = l.leer ? "Leer" : (p.offen.length ? p.offen.length + " offen" : "Nichts offen");
        text.appendChild(lage);
        if (l.tipp && (l.tipp.art === "kaufen" || l.tipp.art === "mhd")) {
            const tipp = document.createElement("span");
            tipp.className = "bestand-tipp tipp-" + l.tipp.art;
            tipp.textContent = l.tipp.text;
            text.appendChild(tipp);
        }
        infos.appendChild(text);
        kopf.appendChild(infos);
        kopf.appendChild(START._plusKnopf(produkt));
        karte.appendChild(kopf);

        const liste = document.createElement("div");
        liste.className = "bk-liste";
        for (const e of p.offen) {
            liste.appendChild(START._zeileOffen(e, jetzt));
        }
        /* Seit 0.10.0 (Nutzer 12.10.2026: „noch zu viele Infos … nur das Wichtigste vorn“): die
           verschlossenen Packungen stehen IMMER hinter „Im Schrank“ (bis 0.9.0 erst ab vier Zeilen);
           vorn bleiben die offenen. */
        const zuViele = p.zu.length > 0;
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
        const rueck = START._rueckLeiste(produkt);
        if (rueck) {
            karte.appendChild(rueck);
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

    /* „+“ = ich habe eine Packung gekauft (kommt verschlossen in den Schrank). Seit 0.9.0 ein
       rundes Zeichen rechts neben dem Produkt (Nutzer 12.10.2026: „statt den großen Gekauft-Knopf
       soll neben dem Produkt ein + Symbol kommen“) — die EINE Hauptaktion je Karte. */
    _plusKnopf(produkt) {
        const plus = DIALOG.knopf("", "haupt", async () => {
            plus.disabled = true;
            const eintragId = await STEUERUNG.kaufen(produkt.id, 1);
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
        plus.setAttribute("aria-label", produkt.name + " gekauft");
        plus.title = "Gekauft";
        return plus;
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
        /* „geöffnet am“ steht seit 0.10.0 nur noch in der Packung (Tipp auf die Zeile). */
        const oben = e.bis ? "bis " + START._tag(e.bis, jetzt) : "offen";
        /* Ohne „offen haltbar“ seit 0.12.0 „offen seit n Tagen“, länger als üblich markiert;
           Freigabe aus → wie bis 0.11.0 „seit Sa 12.10.“ (Freigabe-Kanal 0.13.0). */
        const laenger = UPCREW_FREIGABE.darf("laenger-als-ueblich");
        const unten = e.bis ? BESTAND.restText(e.restTage)
            : (laenger ? BESTAND.seitText(e) : "seit " + START._tag(e.geoeffnetAm, jetzt));
        const z = START._zeile("bk-offen" + (e.restTage !== null && e.restTage <= 0 ? " bk-drueber"
            : (e.restTage !== null && e.restTage <= 1) || (laenger && e.laenger) ? " bk-knapp" : ""),
            "Offen", oben, unten, "Leer",
            () => START._mitRueckgaengig(e, "leer", { leerAm: STEUERUNG.jetzt() }), e.id,
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
        const oben = e.mhd ? "haltbar bis " + START._tag(e.mhd, jetzt) : "ohne Haltbarkeit";
        const unten = "gekauft " + START._tag(e.kauf, jetzt) + (e.abgelaufen ? " · abgelaufen" : "");
        return START._zeile("bk-zu" + (e.abgelaufen ? " bk-drueber" : ""), "Zu", oben, unten, "Öffnen",
            () => START._oeffnen(e), e.id,
            e.menge > 1 ? " · " + e.menge + " Stk." : "").zeile;
    },

    /* ---------------------------------------------------------------- *
     * Rückgängig nach „Leer“ und „Öffnen“ (0.12.0, dritte Welle): ein paar Sekunden lang steht
     * in der Karte „Leer eingetragen · Rückgängig“; ein Tipp löscht das Datum wieder (dieselbe
     * Änderung wie im Packungs-Blatt, kein neues Feld). Danach verschwindet die Zeile von selbst.
     * ---------------------------------------------------------------- */

    rueck: null,
    rueckUhr: null,

    RUECK_TEXT: { leer: "Leer eingetragen", offen: "Geöffnet" },

    /* `START.rueck` = { produktId, art, schritte: [{ id, feld, wert }] } — jeder Schritt merkt sich
       den geschriebenen Wert; zurückgenommen wird nur, was noch genau so dasteht
       (BESTAND.rueckgaengigFelder, Gegenprüfung Welle 3). */
    async _mitRueckgaengig(e, art, felder) {
        const ergebnis = await STEUERUNG.packungAendern(e.id, felder);
        /* Freigabe aus → wie bis 0.11.0 ohne die Rückgängig-Zeile (Freigabe-Kanal 0.13.0). */
        if (ergebnis && ergebnis.ok !== false && UPCREW_FREIGABE.darf("rueckgaengig")) {
            const feld = art === "leer" ? "leerAm" : "geoeffnetAm";
            START.rueck = { produktId: e.produktId, art: art, schritte: [{ id: e.id, feld: feld, wert: felder[feld] }] };
            START._rueckUhrStarten();
        }
        return ergebnis;
    },

    _rueckUhrStarten() {
        if (START.rueckUhr) {
            clearTimeout(START.rueckUhr);
        }
        START.rueckUhr = setTimeout(() => {
            START.rueckUhr = null;
            START.rueck = null;
            NAVIGATION.veralten("start");
        }, KONFIG.rueckgaengigMs);
        NAVIGATION.veralten("start");
    },

    _rueckLeiste(produkt) {
        const r = START.rueck;
        if (!r || r.produktId !== produkt.id) {
            return null;
        }
        const zeile = document.createElement("div");
        zeile.className = "produkt-eben bk-rueck";
        zeile.setAttribute("role", "status");
        const text = document.createElement("span");
        text.className = "bk-rueck-text";
        text.textContent = START.RUECK_TEXT[r.art] || "";
        zeile.appendChild(text);
        const knopf = DIALOG.knopf("Rückgängig", "still", async () => {
            knopf.disabled = true;
            if (START.rueckUhr) {
                clearTimeout(START.rueckUhr);
                START.rueckUhr = null;
            }
            START.rueck = null;
            const plan = STEUERUNG.stand ? BESTAND.rueckgaengigFelder(STEUERUNG.stand, r.schritte) : [];
            if (!plan.length) {
                NAVIGATION.veralten("start");
                DIALOG.hinweis({ titel: produkt.name, text: "Schon geändert · nichts zurückgenommen" });
                return;
            }
            let fehler = "";
            for (const p of plan) {
                const ergebnis = await STEUERUNG.packungAendern(p.id, p.felder);
                if (!ergebnis || ergebnis.ok === false) {
                    fehler = (ergebnis && ergebnis.text) || "Abgelehnt";
                }
            }
            NAVIGATION.veralten("start");
            if (fehler) {
                DIALOG.hinweis({ titel: produkt.name, text: "Nicht zurückgenommen · " + fehler });
            }
        });
        knopf.classList.add("produkt-zurueck");
        zeile.appendChild(knopf);
        return zeile;
    },

    /* „Öffnen“ (seit 0.12.0 mit Nachfrage): Ist vom selben Produkt noch eine andere Packung offen,
       schlägt die App GENAU EINE als leer vor — die älteste offene (BESTAND.alteOffene; nach der
       Gegenprüfung nie mehrere mit einem Tipp). Nach dem Dialog wird frisch nachgesehen (ein
       anderes Gerät kann sie inzwischen geleert haben); Fehler beim Leer-Schreiben werden gemeldet. */
    async _oeffnen(e) {
        const ergebnis = await START._mitRueckgaengig(e, "offen", { geoeffnetAm: STEUERUNG.jetzt() });
        const vorschlag = (ergebnis && ergebnis.ok !== false && STEUERUNG.stand
                && UPCREW_FREIGABE.darf("alte-packung-leer"))
            ? BESTAND.alteOffene(STEUERUNG.stand, e.produktId, e.id, STEUERUNG.jetzt()) : null;
        if (!vorschlag) {
            return ergebnis;
        }
        const produkt = STEUERUNG.stand.produkte[e.produktId];
        const ja = await DIALOG.frage({ titel: produkt ? produkt.name : "Packung", text: vorschlag.text, ja: "Leer", nein: "Noch nicht" });
        if (!ja) {
            return ergebnis;
        }
        const nochOffen = STEUERUNG.stand && BESTAND.andereOffene(STEUERUNG.stand, e.produktId, e.id).some((x) => x.id === vorschlag.id);
        if (!nochOffen) {
            return ergebnis;
        }
        const leerAm = STEUERUNG.jetzt();
        const leer = await STEUERUNG.packungAendern(vorschlag.id, { leerAm: leerAm });
        if (!leer || leer.ok === false) {
            DIALOG.hinweis({ titel: produkt ? produkt.name : "Packung", text: "Leer nicht gespeichert" + (leer && leer.text ? " · " + leer.text : "") });
            return ergebnis;
        }
        /* „Rückgängig“ nimmt dieses Leer mit zurück (Gegenprüfung Welle 3) — und läuft ab hier neu. */
        const r = START.rueck;
        if (r && r.art === "offen" && r.schritte[0].id === e.id) {
            r.schritte.push({ id: vorschlag.id, feld: "leerAm", wert: leerAm });
            START._rueckUhrStarten();
        }
        return ergebnis;
    },

    /* Das Untermenü der verschlossenen Packungen (nur bei langer Liste). */
    _schrankKnopf(produktId, p, jetzt, offen) {
        const knopf = document.createElement("button");
        knopf.type = "button";
        knopf.className = "bk-schrank";
        knopf.setAttribute("aria-expanded", offen ? "true" : "false");
        const mhd = p.zu.find((e) => e.mhd);
        const text = document.createElement("span");
        text.textContent = "Im Schrank: " + p.vorrat + (mhd ? " · haltbar bis " + START._tag(mhd.mhd, jetzt) : "");
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

    /* Das eigene Foto (0.9.0), sonst das Bild aus der Strichcode-Datenbank, sonst ein Platz mit
       dem Anfangsbuchstaben. */
    _produktBild(produkt) {
        const huelle = document.createElement("span");
        huelle.className = "produkt-bild";
        if (KASSE.fotoPruefen(produkt.foto)) {
            const bild = document.createElement("img");
            bild.src = produkt.foto;
            bild.alt = "";
            huelle.appendChild(bild);
            return huelle;
        }
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
