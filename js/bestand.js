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
 */

const BESTAND = {

    TAG_MS: 24 * 60 * 60 * 1000,
    /* „Bald“: geht in einer Woche aus · MHD in einer Woche. */
    BALD_MS: 7 * 24 * 60 * 60 * 1000,
    /* Angebots-Käufe am selben Laden, die so nah beieinander liegen, sind EINE Aktion. */
    AKTION_MS: 4 * 24 * 60 * 60 * 1000,
    /* „Steht zu lange“ erst, wenn so viele Lagerzeiten gemessen sind. */
    LAGER_MIN_MESSUNGEN: 2,

    TIPP: {
        kaufen: "Jetzt kaufen",
        warten: "Aufs Angebot warten",
        reicht: "Vorrat reicht",
        mhd: "MHD bald"
    },

    ERKLAERUNG: {
        tipp: "Leer oder vor dem Angebot aus: kaufen · Angebot vorher: warten · MHD ≤ 7 Tage: MHD bald",
        angebot: "Ab 2 Angeboten je Laden",
        reicht: "Offen + Vorrat × Ø Verbrauch"
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
     * Kurze Texte
     * ---------------------------------------------------------------- */

    reichtText(l, jetzt) {
        if (l.leer) {
            return "Leer";
        }
        return l.reichtBis ? "Reicht bis ~" + KASSE.datumKurz(l.reichtBis, jetzt) : "Reicht bis –";
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
            teile.push("MHD " + KASSE.datumKurz(l.naechstesMhd, jetzt));
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
