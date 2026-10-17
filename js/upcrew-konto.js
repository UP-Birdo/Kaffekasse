/*
 * upcrew-konto.js — das UPCrew-Konto in den Einstellungen, gleich in allen UPCrew-Apps (gehört zu css/upcrew-konto.css).
 * Entstanden 17.10.2026 aus Blunderluck (anmeldung-konto.js, einstellungen.js) und Typoluck (anmeldung.js,
 * bildschirm-einstellungen.js); Nutzer 17.10.2026: „bei allen crew up apps soll verwaltung der benutzer und alles
 * über all gleich sein“.
 *
 * EIN TEXT, EIN ABLAUF je Handlung. Die App liefert nur Haken; Texte, Reihenfolge und Abläufe stehen hier.
 *
 *     UPCREW_KONTO.einrichten({
 *         app: "Typoluck",                        // Pflicht: Name der App (Speicher-Schlüssel, „Nur in …“)
 *         daten: () => abgleich.daten,            // Pflicht: geladene Konten-Liste { spieler: [...], rollen, namen }
 *         speicher: () => abgleich.speicher,      // Pflicht: Konten-Rückwand (nur KONTO schreibt darüber)
 *         nachladen: async () => daten | null,    // Pflicht: frisch vom Server laden, NEUEN Stand liefern, bei
 *                                                 //   Fehler null (nie werfen müssen)
 *         nachAbmelden: async () => {},           // Pflicht: Person vergessen, Anmeldung zeigen
 *         ich: () => eintrag,                     // wahlfrei: eigener Eintrag (sonst Suche nach KONTO.uid())
 *         frisch: async () => ({ daten, ich }),   // wahlfrei: frischer Stand vor dem Schreiben (sonst nachladen())
 *         vorAbmelden: async () => {},            // wahlfrei: z. B. Offenes sofort schreiben
 *         nachLoeschen: async () => {},           // wahlfrei: sonst nachAbmelden
 *         nachGastSichern: (eintrag) => {},       // wahlfrei: Gast-Stand des Geräts ans Konto (Fortschritt, Besitz …)
 *         nachKonto: (art, eintrag) => {},        // wahlfrei: neu zeichnen ("name" | "nummer" | "passwort" | "gast")
 *         verwaltungOeffnen: () => {},            // wahlfrei: sonst Blatt mit UPCREW_VERWALTUNG.zeigen(el, haken)
 *         adminErlaubt: () => false,              // wahlfrei: Werkstatt-Schalter (nur localhost) für die Admin-Zeile
 *         verwaltungSichtbar: () => true          // wahlfrei: Freigabe-Kanal, z. B. UPCREW_FREIGABE.darf("verwaltung")
 *         // … dazu die Haken der Verwaltung (upcrew-verwaltung.js) — EIN Haken-Objekt für beide Bausteine.
 *     });
 *     abschnitte.push(...UPCREW_KONTO.abschnitte());   // Abschnitte „konto“, „admin“, „gefahr“ für UPCREW_EINSTELLUNGEN
 *     UPCREW_KONTO.gastErinnern();                      // nach jeder Anmeldung (jedes dritte Öffnen fragt ein Gast)
 *
 * Abläufe: nameAendern · nummerAendern (EIN Feld, leer = würfeln) · passwortAendern (ein Formular) · gastSichern ·
 * abmelden (fragt immer; Gast wird gewarnt, nach Bestätigung Gast-Eintrag + Gast-Konto weg) · kontoLoeschen (Rückfrage +
 * Passwort; Gast nur Rückfrage). Vor jedem Schreiben von Name/Nummer wird frisch geladen; scheitert das, wird nichts
 * geschrieben. Jeder Ablauf liefert true (geändert) oder false.
 *
 * DIALOGE: `UPCREW_KONTO.dialog` (frage, formular, hinweis, kurzmeldung) zeigt Karten über UPCREW_BLATT — gleich in
 * jeder App. Eine App (oder ein Test) darf einzelne Teile ersetzen, z. B. dialog.kurzmeldung = DIALOG.kurzmeldung.
 *
 * Netz nur über KONTO (konto.js) und die Haken der App. Kein Spiel-Eigenes hier; alle Texte über textContent.
 */
(function () {
    "use strict";

    const TEXTE = {
        nichtAngemeldet: "Nicht angemeldet",
        gastUnter: "Gast · nur Gerät",
        kontoUnter: "Alle Spiele",
        sichern: "Spielstand sichern",
        sichernUnter: "Konto anlegen",
        name: "Name ändern",
        nummer: "Nummer ändern",
        passwort: "Passwort ändern",
        abmelden: "Abmelden",
        verwaltung: "Verwaltung",
        verwaltungUnter: "nur Admin",
        loeschen: "UPCrew-Konto löschen",

        nichtsGeaendert: "Nichts geändert",
        nichtGeloescht: "Nicht gelöscht",
        nichtAbgemeldet: "Nicht abgemeldet",
        speichern: "Speichern",
        abbrechen: "Abbrechen",
        ok: "OK",
        unbekannt: "Das hat nicht geklappt.",

        nameText: "Buchstaben, Ziffern · alle UPCrew-Spiele",
        nameFeld: "Name",
        nameFertig: "Name · ",

        nummerText: "Zurzeit #{tag} · 4 Ziffern · leer = würfeln",
        nummerFeld: "Nummer",
        nummerFertig: "Neue Nummer · #",

        passwortText: "Neu: {regel}",
        passwortAlt: "Bisheriges Passwort",
        passwortNeu: "Neues Passwort",
        passwortWdh: "Neues Passwort wiederholen",
        passwortFertig: "Passwort geändert",

        sichernText: "Name und Passwort · alles als {name} bleibt",
        sichernFeldName: "Name · Buchstaben, Ziffern",
        sichernFeldPasswort: "Passwort",
        sichernFeldWdh: "Passwort wiederholen",
        sichernJa: "Sichern",
        sichernFertig: "Gesichert · ",
        erinnernTitel: "Spielstand sichern?",
        erinnernText: "Gast · nur dieses Gerät · mit Konto überall",
        erinnernNein: "Später",

        abmeldenTitel: "Abmelden?",
        abmeldenText: "Konto bleibt · jederzeit wieder anmelden",
        abmeldenGastTitel: "Als Gast abmelden?",
        abmeldenGastText: "Gast-Stand ist danach weg · vorher sichern",
        abmeldenGastJa: "Trotzdem abmelden",

        loeschenTitel: "UPCrew-Konto löschen?",
        loeschenText: "Konto weg · in allen UPCrew-Spielen · nicht rückgängig",
        loeschenGastText: "Gast-Stand weg · nicht rückgängig",
        loeschenWeiter: "Weiter",
        loeschenEndgueltig: "Endgültig löschen",
        loeschenPasswortTitel: "Zur Sicherheit",
        loeschenPasswortText: "Dein Passwort · dann ist das Konto weg",
        loeschenPasswortFeld: "Passwort",
        loeschenFertig: "Konto gelöscht",

        zeigen: "Zeigen",
        verbergen: "Verbergen"
    };

    const PFLICHT = ["app", "daten", "speicher", "nachladen", "nachAbmelden"];

    let H = null;

    /* ---------------------------------------------------------------- *
     * Haken
     * ---------------------------------------------------------------- */

    /* Welche Pflicht-Haken fehlen? `pflicht` = Liste der Namen; "app" ist ein Text, alles andere eine Funktion. */
    function fehlendeHaken(haken, pflicht) {
        return (pflicht || PFLICHT).filter((name) => {
            if (!haken || typeof haken !== "object") {
                return true;
            }
            if (name === "app") {
                return typeof haken.app !== "string" || haken.app.trim() === "";
            }
            return typeof haken[name] !== "function";
        });
    }

    function einrichten(haken) {
        const fehlt = fehlendeHaken(haken, PFLICHT);
        if (fehlt.length) {
            throw new Error("upcrew-konto: Haken fehlt: " + fehlt.join(", "));
        }
        H = haken;
        return UPCREW_KONTO;
    }

    function haken() {
        if (!H) {
            throw new Error("upcrew-konto: zuerst UPCREW_KONTO.einrichten(haken)");
        }
        return H;
    }

    const D = () => UPCREW_KONTO.dialog;
    const K = () => (typeof KONTO !== "undefined" ? KONTO : null);
    const ersetzen = (text, werte) => String(text).replace(/\{(\w+)\}/g, (_, n) => (n in werte ? String(werte[n]) : ""));

    /* ---------------------------------------------------------------- *
     * Wer bin ich, welche Rolle
     * ---------------------------------------------------------------- */

    function ich() {
        const h = haken();
        if (typeof h.ich === "function") {
            return h.ich() || null;
        }
        const konto = K();
        const uid = konto ? konto.uid() : null;
        const daten = h.daten();
        if (!uid || !daten || !Array.isArray(daten.spieler)) {
            return null;
        }
        return daten.spieler.find((s) => s && s.uid === uid) || null;
    }

    /* "AboveAdmin" | "Admin" | "Beta" | "" — Beta kennt KONTO.rolleVon nicht (seit Blunderluck v0.171.0 hier). */
    function rolleText(daten, uid) {
        const konto = K();
        const rolle = konto ? konto.rolleVon(daten, uid) : "";
        if (rolle) {
            return rolle;
        }
        return (uid && daten && daten.rollen && daten.rollen[uid] === "beta") ? "Beta" : "";
    }

    function istAdmin() {
        const h = haken();
        const konto = K();
        if (typeof h.adminErlaubt === "function" && h.adminErlaubt()) {
            return true;
        }
        return !!(konto && konto.aktiv() && konto.istAdmin(h.daten(), konto.uid()));
    }

    /* ---------------------------------------------------------------- *
     * Die Abschnitte für UPCREW_EINSTELLUNGEN
     * ---------------------------------------------------------------- */

    function kontoAbschnitt() {
        const h = haken();
        const konto = K();
        const e = ich();
        if (!e) {
            return { art: "konto", zeilen: [{ zeichen: "person", titel: TEXTE.nichtAngemeldet }] };
        }
        const gast = e.gast === true;
        const mitKonto = !!(konto && konto.aktiv());
        const rolle = (gast || !mitKonto) ? "" : rolleText(h.daten(), e.uid);
        const zeilen = [{
            zeichen: "person",
            titel: e.name || "",
            tag: (!gast && e.tag) ? "#" + e.tag : "",
            unter: gast ? TEXTE.gastUnter : (rolle || TEXTE.kontoUnter),
            klasse: "up-ko-ich"
        }];
        if (mitKonto && gast) {
            zeilen.push({ zeichen: "hoch", titel: TEXTE.sichern, unter: TEXTE.sichernUnter, rechts: "pfeil",
                beiKlick: () => gastSichern() });
        }
        /* UP#Plus ist fest: Name und Nummer bleiben („UP“ ist reserviert, der Platz UP#Plus trägt die Rolle). */
        const fest = mitKonto && konto.istOberAdmin(h.daten(), e.uid);
        if (mitKonto && !gast && !fest) {
            zeilen.push({ zeichen: "person", titel: TEXTE.name, rechts: "pfeil", beiKlick: () => nameAendern() });
            if (e.tag) {
                zeilen.push({ zeichen: "liste", titel: TEXTE.nummer, rechts: "pfeil", beiKlick: () => nummerAendern() });
            }
        }
        if (mitKonto && !gast) {
            zeilen.push({ zeichen: "schloss", titel: TEXTE.passwort, rechts: "pfeil", beiKlick: () => passwortAendern() });
        }
        zeilen.push({ zeichen: "verlassen", titel: TEXTE.abmelden, beiKlick: () => abmelden() });
        return { art: "konto", zeilen: zeilen };
    }

    function adminAbschnitt() {
        const h = haken();
        /* Freigabe-Kanal der App (z. B. UPCREW_FREIGABE.darf("verwaltung")): false blendet die Zeile aus. */
        if (typeof h.verwaltungSichtbar === "function" && !h.verwaltungSichtbar()) {
            return { art: "admin", zeilen: [] };
        }
        if (!ich() && !(typeof haken().adminErlaubt === "function" && haken().adminErlaubt())) {
            return { art: "admin", zeilen: [] };
        }
        return { art: "admin", zeilen: istAdmin() ? [{
            zeichen: "werkzeug", titel: TEXTE.verwaltung, unter: TEXTE.verwaltungUnter, rechts: "pfeil",
            beiKlick: () => verwaltungOeffnen()
        }] : [] };
    }

    function gefahrAbschnitt() {
        const konto = K();
        const e = ich();
        /* UP#Plus löscht sich nie selbst (verteilt die Rollen; ohne ihn keine Verwaltung). */
        if (!e || !konto || !konto.aktiv() || konto.istOberAdmin(haken().daten(), e.uid)) {
            return { art: "gefahr", zeilen: [] };
        }
        return { art: "gefahr", zeilen: [{ titel: TEXTE.loeschen, gefahr: true, beiKlick: () => kontoLoeschen() }] };
    }

    function abschnitte() {
        return [kontoAbschnitt(), adminAbschnitt(), gefahrAbschnitt()];
    }

    /* Die Verwaltung als Blatt über den Einstellungen (oder der Weg der App). */
    function verwaltungOeffnen() {
        const h = haken();
        if (typeof h.verwaltungOeffnen === "function") {
            return h.verwaltungOeffnen();
        }
        if (typeof UPCREW_BLATT === "undefined" || typeof UPCREW_VERWALTUNG === "undefined") {
            return null;
        }
        let blatt = null;
        const mitEnde = Object.assign({}, h, {
            schliessen: typeof h.schliessen === "function" ? h.schliessen : () => { if (blatt) { blatt.schliessen(); } }
        });
        blatt = UPCREW_BLATT.oeffnen({
            titel: TEXTE.verwaltung,
            klasse: "up-vw-blatt",
            inhalt: (el) => UPCREW_VERWALTUNG.zeigen(el, mitEnde)
        });
        return blatt;
    }

    /* ---------------------------------------------------------------- *
     * Laden
     * ---------------------------------------------------------------- */

    async function nachladenStill() {
        try {
            return await haken().nachladen();
        } catch (fehler) {
            return null;
        }
    }

    /* Vor dem Schreiben von Name oder Nummer: frisch laden (konto.js schreibt den GANZEN eigenen Eintrag — eine
       alte Kopie überschriebe, was ein anderes Spiel inzwischen geschrieben hat). null = nicht geladen → nicht
       schreiben. */
    async function frischZumSchreiben() {
        const h = haken();
        if (typeof h.frisch === "function") {
            try {
                const f = await h.frisch();
                return (f && f.daten && f.ich) ? f : null;
            } catch (fehler) {
                return null;
            }
        }
        const daten = await nachladenStill();
        const konto = K();
        const uid = konto ? konto.uid() : null;
        if (!daten || !uid || !Array.isArray(daten.spieler)) {
            return null;
        }
        const eintrag = daten.spieler.find((s) => s && s.uid === uid);
        return eintrag ? { daten: daten, ich: eintrag } : null;
    }

    function melden(art, eintrag) {
        const h = haken();
        if (typeof h.nachKonto === "function") {
            try {
                h.nachKonto(art, eintrag);
            } catch (fehler) {
                /* Neu zeichnen ist Sache der App — ein Fehler dort ändert nichts am Konto. */
            }
        }
    }

    const netzText = () => (K() ? K().fehlerText("netz") : TEXTE.unbekannt);

    /* ---------------------------------------------------------------- *
     * Die Abläufe
     * ---------------------------------------------------------------- */

    async function nameAendern() {
        const konto = K();
        const e = ich();
        if (!e || e.gast === true || !konto || !konto.aktiv()
                || konto.istOberAdmin(haken().daten(), e.uid)) {
            return false;
        }
        const h = haken();
        let neuerName = "";
        const ergebnis = await D().formular({
            titel: TEXTE.name,
            text: TEXTE.nameText,
            felder: [{ name: "name", beschriftung: TEXTE.nameFeld, wert: e.name, autocomplete: "username",
                saeubern: (t) => konto.nameSaeubern(t), max: konto.NAME_MAX }],
            ja: TEXTE.speichern,
            pruefen: (w) => ({ name: konto.namePruefen(konto.nameSaeubern(w.name)) }),
            absenden: async (w) => {
                neuerName = konto.nameSaeubern(w.name);
                if (neuerName === e.name) {
                    return { ok: true, gleich: true };
                }
                const frisch = await frischZumSchreiben();
                if (!frisch) {
                    return { feld: "allgemein", text: netzText() };
                }
                const r = await konto.nameAendern(h.speicher(), frisch.daten, frisch.ich, neuerName);
                return r.ok ? { ok: true, eintrag: r.eintrag } : { feld: "name", text: r.text || TEXTE.unbekannt };
            }
        });
        if (!ergebnis || !ergebnis.ok || ergebnis.gleich) {
            return false;
        }
        await nachladenStill();
        melden("name", ergebnis.eintrag);
        D().kurzmeldung(TEXTE.nameFertig + ((ergebnis.eintrag && ergebnis.eintrag.name) || neuerName));
        return true;
    }

    async function nummerAendern() {
        const konto = K();
        const e = ich();
        if (!e || e.gast === true || !konto || !konto.aktiv()
                || konto.istOberAdmin(haken().daten(), e.uid)) {
            return false;
        }
        const h = haken();
        const ergebnis = await D().formular({
            titel: TEXTE.nummer,
            text: ersetzen(TEXTE.nummerText, { tag: e.tag || "" }),
            felder: [{ name: "nummer", beschriftung: TEXTE.nummerFeld, wert: "", art: "nummer", max: 4,
                saeubern: (t) => String(t || "").replace(/\D/g, "").slice(0, 4) }],
            ja: TEXTE.speichern,
            pruefen: (w) => ({ nummer: w.nummer === "" ? "" : konto.tagPruefen(w.nummer) }),
            absenden: async (w) => {
                const frisch = await frischZumSchreiben();
                if (!frisch) {
                    return { feld: "allgemein", text: netzText() };
                }
                const r = await konto.tagAendern(h.speicher(), frisch.daten, frisch.ich, w.nummer);
                return r.ok ? { ok: true, eintrag: r.eintrag } : { feld: "nummer", text: r.text || TEXTE.unbekannt };
            }
        });
        if (!ergebnis || !ergebnis.ok) {
            return false;
        }
        await nachladenStill();
        melden("nummer", ergebnis.eintrag);
        D().kurzmeldung(TEXTE.nummerFertig + ((ergebnis.eintrag && ergebnis.eintrag.tag) || ""));
        return true;
    }

    async function passwortAendern() {
        const konto = K();
        const e = ich();
        if (!e || e.gast === true || !konto || !konto.aktiv()) {
            return false;
        }
        const ergebnis = await D().formular({
            titel: TEXTE.passwort,
            text: ersetzen(TEXTE.passwortText, { regel: konto.passwortRegelText() }),
            felder: [
                { name: "alt", beschriftung: TEXTE.passwortAlt, art: "passwort", autocomplete: "current-password" },
                { name: "neu", beschriftung: TEXTE.passwortNeu, art: "passwort", autocomplete: "new-password" },
                { name: "wdh", beschriftung: TEXTE.passwortWdh, art: "passwort", autocomplete: "new-password" }
            ],
            ja: TEXTE.speichern,
            pruefen: (w) => {
                const p = konto.formularPruefen("Abc", w.neu, w.wdh);
                return { alt: w.alt === "" ? "Passwort fehlt." : "", neu: p.passwort, wdh: p.wiederholung };
            },
            absenden: async (w) => {
                const probe = await konto.anmelden(konto.kennungVon(e), w.alt);
                if (!probe.ok) {
                    return { feld: "alt", text: konto.fehlerText(probe.fehler) };
                }
                const r = await konto.passwortAendern(w.neu);
                return r.ok ? { ok: true } : { feld: "allgemein", text: konto.fehlerText(r.fehler) };
            }
        });
        if (!ergebnis || !ergebnis.ok) {
            return false;
        }
        melden("passwort", e);
        D().kurzmeldung(TEXTE.passwortFertig);
        return true;
    }

    async function gastSichern() {
        const konto = K();
        const e = ich();
        if (!e || e.gast !== true || !konto || !konto.aktiv()) {
            return false;
        }
        const h = haken();
        const ergebnis = await D().formular({
            titel: TEXTE.sichern,
            text: ersetzen(TEXTE.sichernText, { name: e.name || "" }),
            felder: [
                { name: "name", beschriftung: TEXTE.sichernFeldName, autocomplete: "username",
                    saeubern: (t) => konto.nameSaeubern(t), max: konto.NAME_MAX },
                { name: "passwort", beschriftung: TEXTE.sichernFeldPasswort + " (" + konto.passwortRegelText() + ")",
                    art: "passwort", autocomplete: "new-password" },
                { name: "wiederholung", beschriftung: TEXTE.sichernFeldWdh, art: "passwort", autocomplete: "new-password" }
            ],
            ja: TEXTE.sichernJa,
            pruefen: (w) => {
                const p = konto.formularPruefen(w.name, w.passwort, w.wiederholung);
                return { name: p.name, passwort: p.passwort, wiederholung: p.wiederholung };
            },
            absenden: async (w) => {
                const r = await konto.gastSichern(h.speicher(), h.daten(), e, konto.nameSaeubern(w.name), w.passwort);
                return r.ok ? { ok: true, eintrag: r.eintrag }
                    : { feld: r.feld || "allgemein", text: r.text || TEXTE.unbekannt };
            }
        });
        if (!ergebnis || !ergebnis.ok) {
            return false;
        }
        await nachladenStill();
        if (typeof h.nachGastSichern === "function") {
            try {
                await h.nachGastSichern(ergebnis.eintrag);
            } catch (fehler) {
                /* Das Konto steht; was die App vom Gerät mitnimmt, holt sie beim nächsten Abgleich nach. */
            }
        }
        melden("gast", ergebnis.eintrag);
        D().kurzmeldung(TEXTE.sichernFertig + ((ergebnis.eintrag && ergebnis.eintrag.name) || ""));
        return true;
    }

    /* Jedes dritte Öffnen fragt ein Gast, ob er sichern will (nach jeder Anmeldung gerufen). */
    const ERINNERN_JEDES = 3;

    function erinnernSchluessel() {
        return haken().app.trim().toLowerCase() + ".gast-erinnerung";
    }

    async function gastErinnern() {
        const konto = K();
        const e = ich();
        if (!konto || !konto.aktiv() || !e || e.gast !== true) {
            return false;
        }
        let zaehler = 0;
        try {
            zaehler = Number(window.localStorage.getItem(erinnernSchluessel())) || 0;
            window.localStorage.setItem(erinnernSchluessel(), String(zaehler + 1));
        } catch (fehler) {
            return false;
        }
        if ((zaehler + 1) % ERINNERN_JEDES !== 0) {
            return false;
        }
        const ja = await D().frage({ titel: TEXTE.erinnernTitel, text: TEXTE.erinnernText, ja: TEXTE.sichernJa,
            nein: TEXTE.erinnernNein });
        return ja ? gastSichern() : false;
    }

    /* Abmelden fragt IMMER. Ein Gast wird gewarnt und — wie bisher in Blunderluck und Typoluck — nach der
       Bestätigung samt Eintrag und Firebase-Gast-Konto weggeräumt (sonst blieben verwaiste Gast-Konten liegen;
       nach dem Abmelden kommt niemand mehr an sie heran). */
    async function abmelden() {
        const konto = K();
        const h = haken();
        const e = ich();
        const gast = !!(e && e.gast === true) || !!(konto && konto.aktiv() && konto.istGastSitzung());
        const ja = await D().frage(gast
            ? { titel: TEXTE.abmeldenGastTitel, text: TEXTE.abmeldenGastText, ja: TEXTE.abmeldenGastJa, gefahr: true }
            : { titel: TEXTE.abmeldenTitel, text: TEXTE.abmeldenText, ja: TEXTE.abmelden });
        if (!ja) {
            return false;
        }
        if (typeof h.vorAbmelden === "function") {
            try {
                await h.vorAbmelden();
            } catch (fehler) {
                /* Was nicht mehr hinausging, bleibt auf dem Gerät — abgemeldet wird trotzdem. */
            }
        }
        if (gast && konto && e) {
            /* Scheitert das Wegräumen, bleibt der Gast angemeldet (sonst bliebe ein verwaister Eintrag). */
            const r = await konto.eintragEntfernen(h.speicher(), e);
            if (!r || !r.ok) {
                await D().hinweis({ titel: TEXTE.nichtAbgemeldet, text: (r && r.text) || TEXTE.unbekannt });
                return false;
            }
            await konto.loeschen();
        }
        if (konto) {
            konto.abmelden();
        }
        await h.nachAbmelden();
        return true;
    }

    /* Konto löschen: Rückfrage, dann Passwort (Firebase verlangt eine frische Anmeldung). Ein Gast: nur Rückfrage. */
    async function kontoLoeschen() {
        const konto = K();
        const e = ich();
        if (!e || !konto || !konto.aktiv() || konto.istOberAdmin(haken().daten(), e.uid)) {
            return false;
        }
        const h = haken();
        const gast = e.gast === true;
        const weiter = await D().frage({
            titel: TEXTE.loeschenTitel,
            text: gast ? TEXTE.loeschenGastText : TEXTE.loeschenText,
            ja: gast ? TEXTE.loeschenEndgueltig : TEXTE.loeschenWeiter,
            gefahr: true
        });
        if (!weiter) {
            return false;
        }
        if (gast) {
            const r = await konto.eintragEntfernen(h.speicher(), e);
            if (!r.ok) {
                await D().hinweis({ titel: TEXTE.nichtGeloescht, text: r.text || TEXTE.unbekannt });
                return false;
            }
            await konto.loeschen();
            konto.abmelden();
        } else {
            const ergebnis = await D().formular({
                titel: TEXTE.loeschenPasswortTitel,
                text: TEXTE.loeschenPasswortText,
                felder: [{ name: "passwort", beschriftung: TEXTE.loeschenPasswortFeld, art: "passwort",
                    autocomplete: "current-password" }],
                ja: TEXTE.loeschenEndgueltig,
                gefahr: true,
                pruefen: (w) => ({ passwort: w.passwort === "" ? "Passwort fehlt." : "" }),
                absenden: async (w) => {
                    const r = await konto.kontoLoeschen(h.speicher(), e, w.passwort);
                    return r.ok ? { ok: true } : { feld: "passwort", text: r.text || TEXTE.unbekannt };
                }
            });
            if (!ergebnis || !ergebnis.ok) {
                return false;
            }
        }
        if (typeof h.nachLoeschen === "function") {
            await h.nachLoeschen();
        } else {
            await h.nachAbmelden();
        }
        D().kurzmeldung(TEXTE.loeschenFertig);
        return true;
    }

    /* ---------------------------------------------------------------- *
     * Dialoge (Karte über UPCREW_BLATT) — ersetzbar
     * ---------------------------------------------------------------- */

    function el(tag, klasse, text) {
        const e = document.createElement(tag);
        if (klasse) {
            e.className = klasse;
        }
        if (text !== undefined && text !== null) {
            e.textContent = String(text);
        }
        return e;
    }

    function knopf(text, art, beiKlick) {
        const k = el("button", "up-kn " + (art === "gefahr" ? "up-gefahr" : (art === "haupt" ? "up-haupt" : "up-zweit")));
        k.type = "button";
        k.appendChild(el("span", "", text));
        if (typeof beiKlick === "function") {
            k.addEventListener("click", beiKlick);
        }
        return k;
    }

    /* Öffnet eine Karte; `bauen(ort, ende)` zeichnet, `ende(wert)` schliesst und liefert den Wert. Schliessen über
       Grund/Esc liefert null. Ohne Blatt-Baustein: null. */
    function karte(titel, bauen) {
        return new Promise((fertig) => {
            if (typeof UPCREW_BLATT === "undefined") {
                fertig(null);
                return;
            }
            let erledigt = false;
            let griff = null;
            const ende = (wert) => {
                if (erledigt) {
                    return;
                }
                erledigt = true;
                if (griff) {
                    griff.schliessen();
                }
                fertig(wert);
            };
            griff = UPCREW_BLATT.oeffnen({
                art: "karte",
                titel: titel,
                klasse: "up-ko-karte",
                inhalt: (ort) => {
                    ort.appendChild(el("h2", "up-ko-titel", titel));
                    bauen(ort, ende);
                },
                beimSchliessen: () => {
                    if (!erledigt) {
                        erledigt = true;
                        fertig(null);
                    }
                }
            });
        });
    }

    function frage(o) {
        return karte(o.titel, (ort, ende) => {
            if (o.text) {
                ort.appendChild(el("p", "up-ko-text", o.text));
            }
            const reihe = el("div", "up-ko-knoepfe");
            reihe.appendChild(knopf(o.nein || TEXTE.abbrechen, "zweit", () => ende(false)));
            const ja = knopf(o.ja || TEXTE.ok, o.gefahr ? "gefahr" : "haupt", () => ende(true));
            reihe.appendChild(ja);
            ort.appendChild(reihe);
            setTimeout(() => { if (ja.focus) { ja.focus(); } }, 0);
        }).then((w) => w === true);
    }

    function hinweis(o) {
        return karte(o.titel, (ort, ende) => {
            if (o.text) {
                ort.appendChild(el("p", "up-ko-text", o.text));
            }
            if (o.inhalt) {
                ort.appendChild(o.inhalt);
            }
            const reihe = el("div", "up-ko-knoepfe");
            const ok = knopf(TEXTE.ok, "haupt", () => ende(true));
            reihe.appendChild(ok);
            ort.appendChild(reihe);
            setTimeout(() => { if (ok.focus) { ok.focus(); } }, 0);
        }).then(() => true);
    }

    /*
     * Ein Formular in einer Karte.
     *   felder:   [{ name, beschriftung, art: "text" | "passwort" | "nummer", wert, autocomplete, saeubern, max }]
     *   pruefen:  (werte) => { feldname: "Meldung" | "" }   — beim Tippen (Feld nicht leer) und beim Absenden (alle)
     *   absenden: async (werte) => { ok: true, … } | { feld: name | "allgemein", text }  — Absage bleibt offen
     * Liefert ohne `absenden` die Werte, sonst das Ergebnis von `absenden` (ok) — oder null (abgebrochen).
     */
    function formular(o) {
        return karte(o.titel, (ort, ende) => {
            if (o.text) {
                ort.appendChild(el("p", "up-ko-text", o.text));
            }
            const teile = {};
            const namen = [];
            for (const f of (o.felder || [])) {
                const block = el("label", "up-ko-feld");
                block.appendChild(el("span", "up-ko-beschriftung", f.beschriftung || f.name));
                const reihe = el("span", "up-ko-reihe");
                const feld = el("input", "up-ko-eingabe");
                const verdeckt = f.art === "passwort";
                feld.type = verdeckt ? "password" : "text";
                feld.autocomplete = f.autocomplete || "off";
                feld.spellcheck = false;
                feld.setAttribute("autocapitalize", "off");
                feld.setAttribute("aria-label", f.beschriftung || f.name);
                if (f.art === "nummer") {
                    feld.setAttribute("inputmode", "numeric");
                }
                if (f.max) {
                    feld.maxLength = f.max;
                } else if (verdeckt) {
                    feld.maxLength = 64;
                }
                feld.value = (f.wert === undefined || f.wert === null) ? "" : String(f.wert);
                reihe.appendChild(feld);
                if (verdeckt) {
                    const zeigen = el("button", "up-ko-zeigen", TEXTE.zeigen);
                    zeigen.type = "button";
                    zeigen.setAttribute("aria-label", "Passwort anzeigen");
                    zeigen.addEventListener("click", (ereignis) => {
                        if (ereignis && ereignis.preventDefault) {
                            ereignis.preventDefault();
                        }
                        const offen = feld.type === "text";
                        feld.type = offen ? "password" : "text";
                        zeigen.textContent = offen ? TEXTE.zeigen : TEXTE.verbergen;
                    });
                    reihe.appendChild(zeigen);
                }
                block.appendChild(reihe);
                const fehler = el("span", "up-ko-fehler");
                fehler.setAttribute("aria-live", "polite");
                block.appendChild(fehler);
                ort.appendChild(block);
                teile[f.name] = { feld: feld, fehler: fehler, f: f };
                namen.push(f.name);
            }
            const allgemein = el("p", "up-ko-fehler up-ko-allgemein");
            allgemein.setAttribute("role", "alert");
            ort.appendChild(allgemein);

            const werte = () => {
                const w = {};
                namen.forEach((n) => { w[n] = teile[n].feld.value; });
                return w;
            };
            /* Zeigt die Meldungen; liefert den Namen des ersten falschen Felds oder "". */
            const pruefen = (alles) => {
                if (typeof o.pruefen !== "function") {
                    return "";
                }
                const meldungen = o.pruefen(werte()) || {};
                let erstes = "";
                namen.forEach((n) => {
                    const t = teile[n];
                    const text = meldungen[n] || "";
                    t.fehler.textContent = (alles === true || t.feld.value !== "") ? text : "";
                    if (text && !erstes) {
                        erstes = n;
                    }
                });
                return erstes;
            };

            const reihe = el("div", "up-ko-knoepfe");
            reihe.appendChild(knopf(o.nein || TEXTE.abbrechen, "zweit", () => ende(null)));
            let laeuft = false;
            const los = knopf(o.ja || TEXTE.speichern, o.gefahr ? "gefahr" : "haupt", async () => {
                if (laeuft) {
                    return;
                }
                allgemein.textContent = "";
                const falsch = pruefen(true);
                if (falsch) {
                    if (teile[falsch].feld.focus) {
                        teile[falsch].feld.focus();
                    }
                    return;
                }
                if (typeof o.absenden !== "function") {
                    ende(werte());
                    return;
                }
                laeuft = true;
                los.disabled = true;
                let r = null;
                try {
                    r = await o.absenden(werte());
                } catch (fehler) {
                    r = { feld: "allgemein", text: TEXTE.unbekannt };
                }
                laeuft = false;
                los.disabled = false;
                if (r && r.ok) {
                    ende(r);
                    return;
                }
                const ziel = r && r.feld && teile[r.feld];
                (ziel ? ziel.fehler : allgemein).textContent = (r && r.text) || TEXTE.unbekannt;
            });
            reihe.appendChild(los);
            ort.appendChild(reihe);

            namen.forEach((n, i) => {
                const t = teile[n];
                t.feld.addEventListener("input", () => {
                    if (typeof t.f.saeubern === "function") {
                        const sauber = t.f.saeubern(t.feld.value);
                        if (sauber !== t.feld.value) {
                            t.feld.value = sauber;
                        }
                    } else if (t.f.art === "passwort") {
                        const ohne = t.feld.value.replace(/\s/g, "");
                        if (ohne !== t.feld.value) {
                            t.feld.value = ohne;
                        }
                    }
                    pruefen(false);
                });
                t.feld.addEventListener("keydown", (ereignis) => {
                    if (!ereignis || ereignis.key !== "Enter") {
                        return;
                    }
                    if (ereignis.preventDefault) {
                        ereignis.preventDefault();
                    }
                    if (i < namen.length - 1) {
                        teile[namen[i + 1]].feld.focus();
                    } else {
                        los.click();
                    }
                });
            });
            setTimeout(() => {
                const erstes = namen.length ? teile[namen[0]].feld : los;
                if (erstes && erstes.focus) {
                    erstes.focus();
                }
            }, 0);
        });
    }

    /* Kurze Meldung unten (Stichwort, kein Satz), verschwindet von selbst. */
    let meldungEl = null;
    let meldungUhr = null;

    function kurzmeldung(text) {
        if (typeof document === "undefined" || !document.body) {
            return;
        }
        if (!meldungEl) {
            meldungEl = el("div", "up-ko-meldung");
            meldungEl.setAttribute("role", "status");
            meldungEl.setAttribute("aria-live", "polite");
        }
        if (meldungEl.parentNode !== document.body) {
            document.body.appendChild(meldungEl);
        }
        meldungEl.textContent = String(text || "");
        meldungEl.classList.add("up-ko-sichtbar");
        clearTimeout(meldungUhr);
        meldungUhr = setTimeout(() => meldungEl.classList.remove("up-ko-sichtbar"), 2400);
    }

    const UPCREW_KONTO = {
        TEXTE: TEXTE,
        PFLICHT: PFLICHT,
        ERINNERN_JEDES: ERINNERN_JEDES,
        einrichten: einrichten,
        haken: haken,
        fehlendeHaken: fehlendeHaken,
        ich: ich,
        rolleText: rolleText,
        istAdmin: istAdmin,
        abschnitte: abschnitte,
        kontoAbschnitt: kontoAbschnitt,
        adminAbschnitt: adminAbschnitt,
        gefahrAbschnitt: gefahrAbschnitt,
        verwaltungOeffnen: verwaltungOeffnen,
        frischZumSchreiben: frischZumSchreiben,
        nameAendern: nameAendern,
        nummerAendern: nummerAendern,
        passwortAendern: passwortAendern,
        gastSichern: gastSichern,
        gastErinnern: gastErinnern,
        abmelden: abmelden,
        kontoLoeschen: kontoLoeschen,
        dialog: { frage: frage, hinweis: hinweis, formular: formular, kurzmeldung: kurzmeldung, karte: karte }
    };
    if (typeof window !== "undefined") {
        window.UPCREW_KONTO = UPCREW_KONTO;
    }
    if (typeof globalThis !== "undefined") {
        globalThis.UPCREW_KONTO = UPCREW_KONTO;
    }
    if (typeof module !== "undefined" && module.exports) {
        module.exports = UPCREW_KONTO;
    }
})();
