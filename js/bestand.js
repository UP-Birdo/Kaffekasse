/*
 * bestand.js — das Modell des BESTANDS (seit 0.7.0; Nutzer 09.10.2026: „in der mitte … der
 * bestand … das was grade da ist mit prognose wann es ausgehen wird … wann einzelne produkte
 * wieder im angebot sind … wie lange welche produkt bei raum temperatur verschlossen steht“).
 *
 * Reine Funktionen wie js\kasse.js: kein DOM, kein Netz, kein Zufall, keine eigene Uhr —
 * `jetzt` kommt immer von außen. Baut auf KASSE auf (Packungen, Kennzahlen, Texte).
 *
 * Was hier gerechnet wird (die Bildschirme zeigen nur):
 *   Lage je Produkt   offene Packung (seit, von wem), Vorrat verschlossen (Anzahl, älteste seit,
 *                     nächstes MHD, abgelaufen), gemessene Lagerzeit verschlossen (Ø/max)
 *   reicht bis ~      offene Packung (geöffnet + Ø Verbrauch, mindestens jetzt) + Vorrat × Ø
 *                     Verbrauch; nichts da = leer; ohne gemessenen Verbrauch keine Schätzung
 *   Angebote          je Laden aus den Angebots-Käufen: Käufe innerhalb AKTION_MS gelten als
 *                     EINE Aktion; ab zwei Aktionen Ø Abstand → nächstes Angebot ~ (rollt über
 *                     verpasste Termine weiter); Ersparnis = Normalpreis (Ø ohne Angebot,
 *                     alle Läden) − Ø Angebotspreis an diesem Laden
 *   Tipp              ERKLAERUNG.tipp; dazu höchstens so viele Packungen, wie bis zum MHD (bzw.
 *                     zur längsten gemessenen Lagerzeit) verbraucht werden
 *   Vorbelegung       nach dem „+“: Laden, Preis, MHD aus dem letzten Kauf dieses Produkts
 *   Einkaufsliste     was bald leer ist (Tipp kaufen/warten), Haken nur am Gerät
 */

const BESTAND = {

    TAG_MS: 24 * 60 * 60 * 1000,
    /* „Bald“: geht in einer Woche aus · MHD in einer Woche. */
    BALD_MS: 7 * 24 * 60 * 60 * 1000,
    /* Angebots-Käufe am selben Laden, die so nah beieinander liegen, sind EINE Aktion. */
    AKTION_MS: 4 * 24 * 60 * 60 * 1000,
    /* „Steht zu lange“ erst, wenn so viele Lagerzeiten gemessen sind. */
    LAGER_MIN_MESSUNGEN: 2,
    /* „Länger als üblich offen“ erst ab so vielen abgeschlossenen Packungen (geöffnet und leer). */
    LAENGER_MIN_MESSUNGEN: 3,

    /* Ein Haken auf der Einkaufsliste (0.11.0) gilt so lange — oder bis jemand das Produkt kauft. */
    ABHAKEN_MS: 7 * 24 * 60 * 60 * 1000,

    /* Seit 0.11.0 „haltbar bis“ statt „MHD“ (Kürzel nur noch in der engen Leiste nach dem „+“). */
    TIPP: {
        kaufen: "Jetzt kaufen",
        warten: "Aufs Angebot warten",
        reicht: "Vorrat reicht",
        mhd: "Läuft bald ab"
    },

    ERKLAERUNG: {
        tipp: "Leer oder vor dem Angebot aus: kaufen · Angebot vorher: warten · haltbar ≤ 7 Tage: läuft bald ab",
        angebot: "Ab 2 Angeboten je Laden",
        reicht: "Offen + Vorrat × Ø Verbrauch",
        einkauf: "Jetzt kaufen und Aufs Angebot warten · Haken gilt bis zum Kauf, höchstens 7 Tage"
    },

    _zahl(wert) {
        const z = Number(wert);
        return Number.isFinite(z) ? z : 0;
    },

    _schluessel(laden) {
        return KASSE.ladenText(laden).toLocaleLowerCase("de");
    },

    /* Ø (nach Menge gewichtet) der Preise einer Liste von Packungen; null ohne Preis. */
    _schnittPreis(liste) {
        let summe = 0;
        let anzahl = 0;
        for (const e of liste) {
            if (typeof e.preis === "number") {
                summe += e.preis * e.menge;
                anzahl += e.menge;
            }
        }
        return anzahl > 0 ? Math.round(summe / anzahl) : null;
    },

    /* ---------------------------------------------------------------- *
     * Läden
     * ---------------------------------------------------------------- */

    /* Alle Läden der Kasse (oder eines Produkts), häufigster zuerst; Groß/klein egal, die
       Schreibweise des neuesten Kaufs gilt. → [{ laden, packungen }] */
    laeden(stand, produktId) {
        const liste = KASSE.packungen(stand, { produktId: produktId });
        const je = {};
        for (const e of liste) {
            if (!e.laden) {
                continue;
            }
            const k = BESTAND._schluessel(e.laden);
            if (!je[k]) {
                je[k] = { laden: e.laden, packungen: 0 };
            }
            je[k].packungen += e.menge;
        }
        return Object.keys(je).map((k) => je[k])
            .sort((a, b) => b.packungen - a.packungen || a.laden.localeCompare(b.laden, "de", { sensitivity: "base" }));
    },

    /* Normalpreis: Ø der Käufe OHNE Angebot (alle Läden). */
    normalpreis(liste) {
        return BESTAND._schnittPreis((liste || []).filter((e) => !e.angebot));
    },

    /* ---------------------------------------------------------------- *
     * Angebote
     * ---------------------------------------------------------------- */

    /* Kaufzeiten → Beginn jeder Aktion (aufsteigend). */
    aktionen(zeiten) {
        const sortiert = (zeiten || []).filter((z) => z > 0).slice().sort((a, b) => a - b);
        const beginn = [];
        let letzte = -Infinity;
        for (const z of sortiert) {
            if (z - letzte > BESTAND.AKTION_MS) {
                beginn.push(z);
            }
            letzte = z;
        }
        return beginn;
    },

    /* Die Schätzung für EINEN Laden; null unter zwei Aktionen. */
    angebotLaden(liste, laden, normal, jetzt) {
        const k = BESTAND._schluessel(laden);
        const eigene = (liste || []).filter((e) => e.angebot && e.laden && BESTAND._schluessel(e.laden) === k);
        const akt = BESTAND.aktionen(eigene.map((e) => KASSE.kaufZeit(e)));
        if (akt.length < 2) {
            return null;
        }
        const abstand = Math.round((akt[akt.length - 1] - akt[0]) / (akt.length - 1));
        const letzte = akt[akt.length - 1];
        let naechstes = letzte + abstand;
        const heute = KASSE.tagBeginn(jetzt);
        if (abstand > 0 && naechstes < heute) {
            /* Verpasst: im selben Takt weiterschätzen. */
            naechstes = letzte + Math.ceil((heute - letzte) / abstand) * abstand;
        }
        const preis = BESTAND._schnittPreis(eigene);
        return {
            laden: laden,
            aktionen: akt.length,
            kaeufe: eigene.reduce((a, e) => a + e.menge, 0),
            abstandMs: abstand,
            letzte: letzte,
            naechstes: naechstes,
            schnittPreis: preis,
            ersparnis: (normal !== null && preis !== null) ? normal - preis : null
        };
    },

    /* ---------------------------------------------------------------- *
     * Lage je Produkt
     * ---------------------------------------------------------------- */

    lage(stand, produktId, jetzt) {
        const j = BESTAND._zahl(jetzt);
        const liste = KASSE.packungen(stand, { produktId: produktId });
        const offen = KASSE.offenePackung(stand, produktId);
        const zu = liste.filter((e) => !e.geoeffnetAm && !e.leerAm);
        const vorrat = zu.reduce((a, e) => a + e.menge, 0);
        const heute = KASSE.tagBeginn(j);

        const k = KASSE.kennzahlen(liste, { von: 0, bis: j });
        const v = (k.verbrauchMs !== null && k.verbrauchMs > 0) ? k.verbrauchMs : null;

        const lager = liste.filter((e) => e.geoeffnetAm && e.geoeffnetAm >= e.kauf).map((e) => e.geoeffnetAm - e.kauf);
        const lagerMax = lager.length ? Math.max.apply(null, lager) : null;
        const mitMhd = liste.filter((e) => e.mhd);
        const mhdSpanne = mitMhd.length
            ? Math.round(mitMhd.reduce((a, e) => a + (e.mhd - KASSE.tagBeginn(e.kauf)), 0) / mitMhd.length)
            : null;

        const zuMhd = zu.filter((e) => e.mhd).map((e) => e.mhd);
        const naechstesMhd = zuMhd.length ? Math.min.apply(null, zuMhd) : null;
        const abgelaufen = zu.filter((e) => e.mhd && e.mhd < heute).reduce((a, e) => a + e.menge, 0);
        const aeltesteKauf = zu.length ? Math.min.apply(null, zu.map((e) => e.kauf)) : null;
        const stehtZuLange = lager.length >= BESTAND.LAGER_MIN_MESSUNGEN && aeltesteKauf !== null
            && (j - aeltesteKauf) > lagerMax;
        const mhdBald = (naechstesMhd !== null && naechstesMhd <= j + BESTAND.BALD_MS) || stehtZuLange;

        const leer = !offen && vorrat === 0;
        let reichtBis = null;
        if (leer) {
            reichtBis = j;
        } else if (v !== null) {
            reichtBis = (offen ? Math.max(j, offen.geoeffnetAm + v) : j) + vorrat * v;
        }

        const normal = BESTAND.normalpreis(liste);
        const laeden = BESTAND.laeden(stand, produktId);
        const angebote = laeden.map((l) => BESTAND.angebotLaden(liste, l.laden, normal, j))
            .filter(Boolean)
            .sort((a, b) => a.naechstes - b.naechstes);
        const imAngebot = liste.filter((e) => e.angebot);
        const angebotPreis = BESTAND._schnittPreis(imAngebot);
        const packungen = k.packungen;

        const lageDaten = {
            offen: offen,
            vorrat: vorrat,
            aeltesteKauf: aeltesteKauf,
            naechstesMhd: naechstesMhd,
            abgelaufen: abgelaufen,
            stehtZuLange: stehtZuLange,
            mhdBald: mhdBald,
            leer: leer,
            verbrauchMs: v,
            reichtBis: reichtBis,
            lagerMs: lager.length ? Math.round(lager.reduce((a, x) => a + x, 0) / lager.length) : null,
            lagerMaxMs: lagerMax,
            mhdSpanneMs: mhdSpanne,
            laeden: laeden,
            normalpreis: normal,
            angebote: angebote,
            naechstesAngebot: angebote.length ? angebote[0] : null,
            angebotsquote: packungen > 0 ? imAngebot.reduce((a, e) => a + e.menge, 0) / packungen : null,
            ersparnis: (normal !== null && angebotPreis !== null) ? normal - angebotPreis : null,
            abstandMs: angebote.length ? angebote[0].abstandMs : null
        };
        lageDaten.tipp = BESTAND.tipp(lageDaten, j);
        return lageDaten;
    },

    /* Die PACKUNGEN eines Produkts für die Bestand-Karte (0.8.0, Nutzer 10.10.2026: „jedes
       Produkt untereinander … alles was im Vorrat ist und was offen ist“):
         offen  geöffnet, nicht leer — neueste zuerst; je Packung `bis` (geöffnet + Tage nach
                dem Öffnen), `restTage` (ganze Tage bis dahin, negativ = drüber) und `anteil`
                (0 = frisch geöffnet … 1 = abgelaufen); ohne Tage nur `seit`
         zu     verschlossen — nächstes MHD zuerst, ohne MHD nach Kauf (älteste zuerst)
       → { offen: [...], zu: [...], vorrat (Stück), tage, vorschlag } */
    packungen(stand, produktId, jetzt) {
        const j = BESTAND._zahl(jetzt);
        const s = (stand && stand.eintraege) ? stand : KASSE.normalisieren(stand);
        const p = s.produkte[produktId];
        const t = KASSE.offenTage(p);
        const heute = KASSE.tagBeginn(j);
        const liste = KASSE.packungen(s, { produktId: produktId });
        /* Ohne „offen haltbar“ (0.12.0): wie lange eine Packung üblich offen ist (Ø geöffnet → leer,
           gemessen) — länger offen = Hinweis „länger als üblich“. */
        const k = KASSE.kennzahlen(liste, { von: 0, bis: j });
        const abgeschlossen = liste.filter((e) => e.geoeffnetAm && e.leerAm).length;
        const ueblich = (abgeschlossen >= BESTAND.LAENGER_MIN_MESSUNGEN && k.verbrauchMs !== null && k.verbrauchMs > 0)
            ? k.verbrauchMs : null;
        const offen = liste.filter((e) => e.geoeffnetAm && !e.leerAm)
            .sort((a, b) => b.geoeffnetAm - a.geoeffnetAm)
            .map((e) => {
                if (!t.tage) {
                    return Object.assign({}, e, {
                        bis: null, restTage: null, anteil: null,
                        seitTage: Math.max(0, Math.round((heute - KASSE.tagBeginn(e.geoeffnetAm)) / BESTAND.TAG_MS)),
                        laenger: ueblich !== null && (j - e.geoeffnetAm) > ueblich && (j - e.geoeffnetAm) >= BESTAND.TAG_MS
                    });
                }
                const bis = KASSE.tagBeginn(e.geoeffnetAm) + t.tage * BESTAND.TAG_MS;
                const rest = Math.round((bis - heute) / BESTAND.TAG_MS);
                const anteil = Math.min(1, Math.max(0, (j - e.geoeffnetAm) / (bis - e.geoeffnetAm || 1)));
                return Object.assign({}, e, { bis: bis, restTage: rest, anteil: anteil });
            });
        const zu = liste.filter((e) => !e.geoeffnetAm && !e.leerAm)
            .sort((a, b) => (a.mhd || Infinity) - (b.mhd || Infinity) || a.kauf - b.kauf)
            .map((e) => Object.assign({}, e, { abgelaufen: !!(e.mhd && e.mhd < heute) }));
        return { offen: offen, zu: zu, vorrat: zu.reduce((a, e) => a + e.menge, 0), tage: t.tage, vorschlag: t.vorschlag };
    },

    /* „Rückgängig“ nach Leer/Öffnen (0.12.0): `schritte` = [{ id, feld, wert }], der erste ist der
       eigentliche Tipp, weitere hingen daran (das „Leer“ der alten Packung aus der Nachfrage).
       Zurückgenommen wird nur, was noch GENAU den geschriebenen Wert hat; passt der erste nicht
       mehr (anderes Gerät, Packungs-Blatt), wird gar nichts zurückgenommen.
       → [{ id, felder: { <feld>: null } }] (leer = nichts zu tun) */
    rueckgaengigFelder(stand, schritte) {
        const s = (stand && stand.eintraege) ? stand : KASSE.normalisieren(stand);
        const passt = (x) => !!(x && s.eintraege[x.id] && KASSE.gueltig(s.eintraege[x.id]) && s.eintraege[x.id][x.feld] === x.wert);
        const liste = Array.isArray(schritte) ? schritte : [];
        if (!liste.length || !passt(liste[0])) {
            return [];
        }
        return liste.filter(passt).map((x) => ({ id: x.id, felder: { [x.feld]: null } }));
    },

    /* Offene Packung OHNE Tage (0.12.0): „offen seit heute“ · „offen seit 1 Tag“ · „offen seit
       5 Tagen · länger als üblich“. */
    seitText(e) {
        const n = (e && e.seitTage) || 0;
        const seit = n === 0 ? "offen seit heute" : (n === 1 ? "offen seit 1 Tag" : "offen seit " + n + " Tagen");
        return seit + (e && e.laenger ? " · länger als üblich" : "");
    },

    /* „noch 2 Tage“ · „heute“ · „seit 1 Tag drüber“ — für eine offene Packung mit Tagen. */
    restText(restTage) {
        if (restTage === null || restTage === undefined) {
            return "";
        }
        if (restTage > 1) {
            return "noch " + restTage + " Tage";
        }
        if (restTage === 1) {
            return "noch 1 Tag";
        }
        if (restTage === 0) {
            return "bis heute";
        }
        return -restTage === 1 ? "1 Tag drüber" : -restTage + " Tage drüber";
    },

    /* Der Bestand der Kasse: je aktivem Produkt die Lage (alphabetisch wie die Produkte). */
    bestand(stand, jetzt) {
        const s = (stand && stand.eintraege) ? stand : KASSE.normalisieren(stand);
        return KASSE.produkteAktiv(s).map((p) => Object.assign({ produkt: p }, BESTAND.lage(s, p.id, jetzt)));
    },

    /* ---------------------------------------------------------------- *
     * Tipp
     * ---------------------------------------------------------------- */

    /* `l`: { leer, mhdBald, reichtBis, verbrauchMs, naechstesAngebot, mhdSpanneMs, lagerMaxMs }.
       → { art, text, menge } oder null (keine Grundlage). Reihenfolge: leer → MHD bald →
       geht bald aus (vor dem Angebot: kaufen, sonst warten) → reicht. */
    tipp(l, jetzt) {
        const j = BESTAND._zahl(jetzt);
        const angebot = l.naechstesAngebot ? l.naechstesAngebot.naechstes : null;
        let art = null;
        if (l.leer) {
            art = "kaufen";
        } else if (l.mhdBald) {
            art = "mhd";
        } else if (l.reichtBis === null || l.reichtBis === undefined) {
            return null;
        } else if (l.reichtBis <= j + BESTAND.BALD_MS) {
            art = (angebot !== null && angebot <= l.reichtBis) ? "warten" : "kaufen";
        } else {
            art = "reicht";
        }
        return { art: art, text: BESTAND.TIPP[art], menge: BESTAND.menge(l, art, j) };
    },

    /* Wie viele Packungen sinnvoll sind (nur für kaufen/warten): genug bis zum nächsten
       Angebot danach, aber nie mehr, als bis zum MHD (sonst längste gemessene Lagerzeit)
       verbraucht wird. null ohne Grundlage. */
    menge(l, art, jetzt) {
        const v = l.verbrauchMs;
        if ((art !== "kaufen" && art !== "warten") || !(v > 0)) {
            return null;
        }
        const a = l.naechstesAngebot;
        const kaufAm = (art === "warten" && a) ? a.naechstes : jetzt;
        const start = Math.max(kaufAm, l.reichtBis || jetzt);
        let bedarf = null;
        if (art === "warten" && a && a.abstandMs > 0) {
            bedarf = Math.ceil((a.naechstes + a.abstandMs - start) / v);
        } else if (art === "kaufen" && a) {
            bedarf = Math.ceil((a.naechstes - start) / v);
        }
        if (bedarf === null) {
            return null;
        }
        bedarf = Math.max(1, bedarf);
        const haltbar = (l.mhdSpanneMs !== null && l.mhdSpanneMs !== undefined) ? l.mhdSpanneMs : l.lagerMaxMs;
        if (haltbar !== null && haltbar !== undefined) {
            const grenze = Math.max(1, Math.floor((kaufAm + haltbar - start) / v) + 1);
            bedarf = Math.min(bedarf, grenze);
        }
        return bedarf;
    },

    /* ---------------------------------------------------------------- *
     * Vorbelegung nach dem „+“ (Nutzer: „nicht jedes mal beim kauf viel eintragen“)
     * ---------------------------------------------------------------- */

    /* Aus dem letzten Kauf dieses Produkts (ohne den neuen): Laden, Preis am Laden ohne
       Angebot, Angebotspreis am Laden, MHD = neues Kaufdatum + derselbe Abstand wie damals.
       → { laden, preis, preisAngebot, mhd } (null = unbekannt) oder null ohne Vorlage. */
    vorbelegung(stand, eintragId) {
        const neu = (stand && stand.eintraege) ? stand.eintraege[eintragId] : null;
        if (!neu) {
            return null;
        }
        const liste = KASSE.packungen(stand, { produktId: neu.produktId }).filter((e) => e.id !== eintragId);
        const vorlage = liste.find((e) => e.laden || typeof e.preis === "number" || e.mhd);
        if (!vorlage) {
            return null;
        }
        const k = vorlage.laden ? BESTAND._schluessel(vorlage.laden) : "";
        const amLaden = liste.filter((e) => typeof e.preis === "number" && (e.laden ? BESTAND._schluessel(e.laden) : "") === k);
        const ohne = amLaden.find((e) => !e.angebot);
        const mit = amLaden.find((e) => e.angebot);
        let mhd = null;
        if (vorlage.mhd) {
            mhd = KASSE.tagBeginn(KASSE.tagBeginn(KASSE.kaufZeit(neu)) + (vorlage.mhd - KASSE.tagBeginn(vorlage.kauf)) + BESTAND.TAG_MS / 2);
        }
        return {
            laden: vorlage.laden || "",
            preis: ohne ? ohne.preis : null,
            preisAngebot: mit ? mit.preis : null,
            mhd: mhd
        };
    },

    /* Die Felder für KASSE.packungAendern aus der Vorbelegung (mit oder ohne Angebot). */
    felder(vorgabe, angebot) {
        const v = vorgabe || {};
        const f = {};
        if (v.laden) {
            f.laden = v.laden;
        }
        const preis = angebot ? v.preisAngebot : v.preis;
        if (typeof preis === "number") {
            f.preis = preis;
        }
        if (v.mhd) {
            f.mhd = v.mhd;
        }
        if (angebot) {
            f.angebot = true;
        }
        return f;
    },

    /* ---------------------------------------------------------------- *
     * Einkaufsliste (0.11.0): was bald leer ist, zum Abhaken. Die Haken liegen nur am Gerät
     * ({ produktId: Zeit des Hakens }) — kein neues Feld in der Datenbank.
     * ---------------------------------------------------------------- */

    /* Gilt ein Haken noch? Nicht älter als ABHAKEN_MS und seitdem kein „+“ für das Produkt. */
    abgehaktGilt(stand, produktId, zeit, jetzt) {
        const z = BESTAND._zahl(zeit);
        const j = BESTAND._zahl(jetzt);
        if (!(z > 0) || j - z >= BESTAND.ABHAKEN_MS) {
            return false;
        }
        return !KASSE.eintraegeVon(stand, { produktId: produktId }).some((e) => e.wann >= z);
    },

    /* Nur die Haken, die noch gelten (zum Zurückschreiben ans Gerät). */
    abgehaktAufraeumen(stand, abgehakt, jetzt) {
        const a = (abgehakt && typeof abgehakt === "object") ? abgehakt : {};
        const aus = {};
        for (const id of Object.keys(a)) {
            if (BESTAND.abgehaktGilt(stand, id, a[id], jetzt)) {
                aus[id] = a[id];
            }
        }
        return aus;
    },

    /* Die Liste: je aktivem Produkt mit Tipp „Jetzt kaufen“ oder „Aufs Angebot warten“.
       → [{ produkt, art, text, menge, angebot, leer, abgehakt }]; offene vor abgehakten, kaufen
       vor warten, leer zuerst, dann der Name. */
    einkaufsliste(stand, jetzt, abgehakt) {
        const a = (abgehakt && typeof abgehakt === "object") ? abgehakt : {};
        const liste = BESTAND.bestand(stand, jetzt)
            .filter((b) => b.tipp && (b.tipp.art === "kaufen" || b.tipp.art === "warten"))
            .map((b) => ({
                produkt: b.produkt,
                art: b.tipp.art,
                text: b.tipp.text,
                menge: b.tipp.menge,
                angebot: b.tipp.art === "warten" ? b.naechstesAngebot : null,
                leer: b.leer,
                /* Wer dran ist (0.12.0) — dieselbe Regel wie im Produkt-Blatt (alle Zeit). */
                dran: KASSE.naechsterDran(stand, b.produkt.id),
                abgehakt: BESTAND.abgehaktGilt(stand, b.produkt.id, a[b.produkt.id], jetzt)
            }))
            .map((x) => Object.assign(x, { dranName: x.dran ? KASSE.mitgliedName(stand, x.dran) : "" }));
        const rang = (x) => (x.abgehakt ? 10 : 0) + (x.art === "kaufen" ? 0 : 2) + (x.leer ? 0 : 1);
        return liste.sort((x, y) => rang(x) - rang(y)
            || x.produkt.name.localeCompare(y.produkt.name, "de", { sensitivity: "base" }));
    },

    /* Die Unterzeile einer Zeile: „Jetzt kaufen · 2 Stk.“ · „Aufs Angebot warten · Lidl ~Mo 14.10.“ */
    einkaufText(x, jetzt, uid) {
        const teile = [x.leer ? "Leer" : x.text];
        if (x.menge) {
            teile.push(x.menge + " Stk.");
        }
        if (x.angebot) {
            teile.push(x.angebot.laden + " ~" + KASSE.datumKurz(x.angebot.naechstes, jetzt));
        }
        /* Seit 0.12.0: wer dran ist — nur, wenn die eigene Kennung übergeben wird. */
        if (uid !== undefined && x.dran) {
            teile.push("Dran: " + (x.dran === uid ? "Du" : (x.dranName || "Ehemals")));
        }
        return teile.join(" · ");
    },

    /* Die offene Liste als Text zum Teilen (0.12.0): Kopfzeile mit dem Namen der Kasse, je nicht
       abgehaktem Produkt eine Zeile „- Name · Menge · Laden ~Tag“. "" ohne offene Zeile. */
    einkaufTeilen(liste, jetzt, kassenName) {
        const offen = (liste || []).filter((x) => !x.abgehakt);
        if (!offen.length) {
            return "";
        }
        const zeilen = offen.map((x) => {
            const teile = [x.produkt.name];
            if (x.menge) {
                teile.push(x.menge + " Stk.");
            }
            if (x.angebot) {
                teile.push(x.angebot.laden + " ~" + KASSE.datumKurz(x.angebot.naechstes, jetzt));
            }
            return "- " + teile.join(" · ");
        });
        return ["Einkaufsliste" + (kassenName ? " " + kassenName : "")].concat(zeilen).join("\n");
    },

    /* Beim Öffnen einer Packung (0.12.0): die ANDEREN noch offenen Packungen desselben Produkts,
       zuletzt geöffnete zuerst — die App fragt dann „Alte Packung leer?“ (ein Tipp statt zwei). */
    andereOffene(stand, produktId, eintragId) {
        return KASSE.eintraegeVon(stand, { produktId: produktId })
            .filter((e) => e.id !== eintragId && e.geoeffnetAm && !e.leerAm)
            .sort((a, b) => b.geoeffnetAm - a.geoeffnetAm);
    },

    /* Der EINE Vorschlag nach dem Öffnen (Gegenprüfung 0.12.0: nie mehrere mit einem Tipp): die
       älteste andere offene Packung. Bei genau einer „Alte Packung leer?“, bei mehreren mit Datum
       „Alte Packung (geöffnet am …) leer?“. → { id, text } oder null. */
    alteOffene(stand, produktId, eintragId, jetzt) {
        const andere = BESTAND.andereOffene(stand, produktId, eintragId);
        if (!andere.length) {
            return null;
        }
        const alt = andere[andere.length - 1];
        return {
            id: alt.id,
            text: andere.length === 1 ? "Alte Packung leer?"
                : "Alte Packung (geöffnet am " + KASSE.datumKurz(alt.geoeffnetAm, jetzt) + ") leer?"
        };
    },

    /* ---------------------------------------------------------------- *
     * Kurze Texte
     * ---------------------------------------------------------------- */

    reichtText(l, jetzt) {
        if (l.leer) {
            return "Leer";
        }
        return l.reichtBis ? "Reicht bis ~" + KASSE.datumKurz(l.reichtBis, jetzt) : "Reicht bis –";
    },

    /* Der Wert der Kachel „Reicht bis“ (Statistik und Produkt, seit 0.11.0 gleich):
       „Leer“ · „~Sa 12.10.“ · „–“ ohne gemessenen Verbrauch. */
    reichtKurz(l, jetzt) {
        if (l.leer) {
            return "Leer";
        }
        return l.reichtBis ? "~" + KASSE.datumKurz(l.reichtBis, jetzt) : "–";
    },

    angebotText(a, jetzt) {
        return a.laden + " · Angebot ~" + KASSE.datumKurz(a.naechstes, jetzt)
            + (a.ersparnis > 0 ? " · -" + KASSE.euro(a.ersparnis) : "");
    },

    vorratText(l, jetzt) {
        if (l.vorrat === 0) {
            return "Kein Vorrat";
        }
        const teile = ["Vorrat " + l.vorrat];
        if (l.aeltesteKauf) {
            teile.push("seit " + KASSE.datumKurz(l.aeltesteKauf, jetzt));
        }
        if (l.naechstesMhd) {
            teile.push("haltbar bis " + KASSE.datumKurz(l.naechstesMhd, jetzt));
        }
        return teile.join(" · ");
    },

    prozent(anteil) {
        return (typeof anteil === "number" && Number.isFinite(anteil)) ? Math.round(anteil * 100) + " %" : "–";
    },

    mhdLageText(l, jetzt) {
        if (l.abgelaufen > 0) {
            return l.abgelaufen + " abgelaufen";
        }
        return l.naechstesMhd ? KASSE.datumKurz(l.naechstesMhd, jetzt) : "–";
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = BESTAND;
}
