/*
 * upcrew-verwaltung.js — die Verwaltung der UPCrew-Konten für Admins, gleich in allen UPCrew-Apps (gehört zu
 * css/upcrew-verwaltung.css). Entstanden 17.10.2026 aus Blunderluck (verwaltungs-bildschirm.js, anmeldung-konto.js
 * `rollenZiel` / `betaAnzahl`, v0.171.0) und Typoluck (bildschirm-verwaltung.js); Nutzer 17.10.2026: „bei allen
 * crew up apps soll verwaltung der benutzer und alles über all gleich sein“.
 *
 * Braucht: KONTO (konto.js), UPCREW_EINSTELLUNGEN (Aufbau), UPCREW_KONTO (Dialoge; laden VOR dieser Datei).
 * Wahlfrei: UPCREW_SPIELERLISTE (Spielerliste mit Statistiken).
 *
 *     UPCREW_VERWALTUNG.zeigen(ort, haken);     // zeichnet in `ort` (z. B. den Inhalt eines Blatts)
 *
 * Haken — dasselbe Objekt wie für UPCREW_KONTO.einrichten (ohne `haken` nimmt die Verwaltung dessen Haken):
 *     app, daten(), speicher(), nachladen()      Pflicht (wie upcrew-konto.js)
 *     spalten: [{ titel, wert: (spieler, daten) => "…" }]     wahlfrei: Werte der App je Konto (z. B. Freunde)
 *     spielerWerte: { level(stand), serie(stand), abzeichen(stand), muenzen(eintrag) }   wahlfrei: Spielerliste
 *     details: (zeile, daten) => element         wahlfrei: unter den Details eines Spielers (z. B. Statistik)
 *     spiel: () => ({ zeilen?, inhalt?, hinweis? })   wahlfrei: Abschnitt „Nur in <App>“
 *     schliessen: () => {}                        wahlfrei: Zeile „Verwaltung beenden“
 *     nachAenderung: (wie, spieler) => {}         wahlfrei: nach jeder geschriebenen Änderung
 *     adminErlaubt: () => false                   wahlfrei: Werkstatt-Schalter (nur localhost)
 *
 * Aufbau (upcrew-einstellungen.js, Art „verwaltung“): Spieler · Datenbank · Nur in <App> · Ende.
 *   Spieler    Tabelle der Konten (Name, Konto, Rolle inkl. Beta, Spalten der App, Knöpfe); schmal (< 420 px am
 *              Behälter) als Karten-Liste. Darunter die Spielerliste (nur lesen).
 *   Datenbank  „§12 nachziehen“ (nur UP#Plus, nur unter Regel §12) — an dieser EINEN Stelle.
 * Knöpfe (Zwei-Schritt: erster Tipp „Sicher?“, zweiter führt aus):
 *   Neu verbinden  jeder Admin, echte Konten, nicht schon freigegeben
 *   Admin geben/nehmen, Beta geben/nehmen   nur UP#Plus, nie Gast; Beta nie an einen Admin (Admin schliesst Beta ein)
 *   Entfernen      jeder Admin; nie UP#Plus, nie das eigene Konto
 * Jede Handlung lädt VOR dem Schreiben frisch (`nachladen`) und rechnet aus diesem Stand; ohne Stand wird nicht
 * geschrieben. Wer was darf, prüft am Ende die Datenbank-Regel. Netz nur über KONTO und die Haken.
 */
(function () {
    "use strict";

    const BETA_HOECHSTENS = 10;
    const PFLICHT = ["app", "daten", "speicher", "nachladen"];

    const TEXTE = {
        nurAdmin: "Nur Rolle Admin",
        erklaerung: "Alle UPCrew-Konten · Entfernen löscht Konto-Eintrag, Name und Fortschritt in allen Spielen",
        erklaerungOber: "Alle UPCrew-Konten · Entfernen löscht Konto-Eintrag, Name, Fortschritt und Rolle in allen Spielen",
        rolleBlieb: "Konto entfernt · Rolle blieb stehen",
        eigenes: "Eigenes Konto nicht hier",
        nurOber: "Rollen vergibt nur UP#Plus",
        beta: "Beta-Konten · {n} / {max} · sehen Neues früher",
        spalten: ["Name", "Konto", "Rolle"],
        du: " (du)",
        gast: "Gast",
        freigegeben: "freigegeben",
        verbunden: "verbunden",
        keineRolle: "-",
        sicher: "Sicher?",
        spielerliste: "Spielerliste",
        nachziehen: "§12 nachziehen",
        nachziehenUnter: "Auszüge · Verzeichnis · wiederholbar",
        nachgezogen: "Nachgezogen",
        nichtNachgezogen: "Nicht nachgezogen",
        beenden: "Verwaltung beenden",
        nichtsGeaendert: "Nichts geändert",
        nichtGespeichert: "Nicht gespeichert",
        nichtMehrDa: "Konto nicht mehr da",
        gehtNicht: "Geht nicht",
        regelOhneBeta: "Regel mit Beta noch nicht eingespielt",
        keineBerechtigung: "Keine Berechtigung · oder kein Netz",
        knopf: {
            "neu-verbinden": "Neu verbinden",
            "admin-geben": "Admin geben",
            "admin-nehmen": "Admin nehmen",
            "beta-geben": "Beta geben",
            "beta-nehmen": "Beta nehmen",
            "entfernen": "Entfernen"
        },
        fertig: {
            "neu-verbinden": "Freigegeben · ",
            "admin-geben": "Admin · ",
            "admin-nehmen": "Kein Admin · ",
            "beta-geben": "Beta · ",
            "beta-nehmen": "Kein Beta · ",
            "entfernen": "Entfernt · "
        }
    };

    const K = () => (typeof KONTO !== "undefined" ? KONTO : null);
    const D = () => (typeof UPCREW_KONTO !== "undefined" ? UPCREW_KONTO.dialog : null);
    const ersetzen = (text, werte) => String(text).replace(/\{(\w+)\}/g, (_, n) => (n in werte ? String(werte[n]) : ""));

    /* ---------------------------------------------------------------- *
     * Rollen — rein (aus Blunderluck v0.171.0 unverändert übernommen)
     * ---------------------------------------------------------------- */

    /* Der gespeicherte Wert: "admin" | "beta" | null. */
    function rolleWert(daten, uid) {
        const w = (uid && daten && daten.rollen && typeof daten.rollen === "object") ? daten.rollen[uid] : null;
        return (w === "admin" || w === "beta") ? w : null;
    }

    /* Wie viele Konten die Rolle „beta“ tragen. */
    function betaAnzahl(daten) {
        const rollen = (daten && daten.rollen && typeof daten.rollen === "object") ? daten.rollen : {};
        return Object.keys(rollen).filter((uid) => rollen[uid] === "beta").length;
    }

    /* Was ein Klick schreiben soll → { wert: "admin" | "beta" | null } oder { grund } (nichts schreiben). */
    function rollenZiel(daten, uid, wie) {
        const konto = K();
        if (!uid) {
            return { grund: "Kein Konto" };
        }
        if (konto && konto.istOberAdmin(daten, uid)) {
            return { grund: "UP#Plus ist fest" };
        }
        const jetzt = rolleWert(daten, uid);
        if (wie === "admin-geben") {
            return jetzt === "admin" ? { grund: "Schon Admin" } : { wert: "admin" };
        }
        if (wie === "admin-nehmen") {
            return jetzt === "admin" ? { wert: null } : { grund: "Kein Admin" };
        }
        if (wie === "beta-geben") {
            if (jetzt === "admin") {
                return { grund: "Admin sieht Beta schon" };
            }
            if (jetzt === "beta") {
                return { grund: "Schon Beta" };
            }
            if (betaAnzahl(daten) >= BETA_HOECHSTENS) {
                return { grund: "Höchstens " + BETA_HOECHSTENS + " Beta-Konten" };
            }
            return { wert: "beta" };
        }
        if (wie === "beta-nehmen") {
            return jetzt === "beta" ? { wert: null } : { grund: "Kein Beta" };
        }
        return { grund: "Unbekannt" };
    }

    /* Die Meldung, wenn das Schreiben scheitert. Lehnt die Datenbank „beta“ ab (HTTP 400/401/403), fehlt die Regel
       mit Beta noch — die alte lässt unter `rollen` nur "admin" zu. */
    function rollenFehlerText(wert, text) {
        if (wert === "beta" && /HTTP 40[013]\b/.test(String(text || ""))) {
            return TEXTE.regelOhneBeta;
        }
        return TEXTE.keineBerechtigung;
    }

    function rolleText(daten, uid) {
        if (typeof UPCREW_KONTO !== "undefined" && typeof UPCREW_KONTO.rolleText === "function") {
            return UPCREW_KONTO.rolleText(daten, uid);
        }
        const konto = K();
        return (konto && konto.rolleVon(daten, uid)) || (rolleWert(daten, uid) === "beta" ? "Beta" : "");
    }

    function kontoArt(spieler) {
        if (!spieler) {
            return "";
        }
        return spieler.gast === true ? TEXTE.gast : (spieler.neuVerbinden === true ? TEXTE.freigegeben : TEXTE.verbunden);
    }

    /* Welche Knöpfe eine Zeile bekommt (rein). `meineUid` = wer verwaltet. */
    function knoepfe(daten, meineUid, spieler) {
        const konto = K();
        if (!konto || !spieler || !spieler.uid || spieler.uid === meineUid || konto.istOberAdmin(daten, spieler.uid)) {
            return [];
        }
        const binOber = konto.istOberAdmin(daten, meineUid);
        const rolle = rolleWert(daten, spieler.uid);
        const liste = [];
        if (spieler.gast !== true && spieler.neuVerbinden !== true) {
            liste.push("neu-verbinden");
        }
        if (binOber && spieler.gast !== true) {
            liste.push(rolle === "admin" ? "admin-nehmen" : "admin-geben");
        }
        if (binOber && spieler.gast !== true && rolle !== "admin") {
            liste.push(rolle === "beta" ? "beta-nehmen" : "beta-geben");
        }
        liste.push("entfernen");
        return liste;
    }

    /* Die Konten der Liste (nur Einträge mit Konto-Nummer). */
    function konten(daten) {
        return ((daten && Array.isArray(daten.spieler)) ? daten.spieler : []).filter((s) => s && typeof s === "object");
    }

    function finden(daten, kennung) {
        return konten(daten).find((s) => s.id === kennung) || konten(daten).find((s) => s.uid === kennung) || null;
    }

    /* ---------------------------------------------------------------- *
     * Haken und Zustand
     * ---------------------------------------------------------------- */

    let stand = null;   /* { ort, h } der zuletzt gezeichneten Verwaltung */

    function hakenVon(haken) {
        let h = haken;
        if (!h && typeof UPCREW_KONTO !== "undefined") {
            try {
                h = UPCREW_KONTO.haken();
            } catch (fehler) {
                h = null;
            }
        }
        const fehlt = (typeof UPCREW_KONTO !== "undefined" && UPCREW_KONTO.fehlendeHaken)
            ? UPCREW_KONTO.fehlendeHaken(h, PFLICHT)
            : PFLICHT.filter((n) => !h || (n === "app" ? typeof h.app !== "string" || !h.app : typeof h[n] !== "function"));
        if (fehlt.length) {
            throw new Error("upcrew-verwaltung: Haken fehlt: " + fehlt.join(", "));
        }
        return h;
    }

    function erlaubt(h) {
        const konto = K();
        if (typeof h.adminErlaubt === "function" && h.adminErlaubt()) {
            return true;
        }
        return !!(konto && konto.aktiv() && konto.istAdmin(h.daten(), konto.uid()));
    }

    /* ---------------------------------------------------------------- *
     * Handlungen
     * ---------------------------------------------------------------- */

    async function nachladenStill(h) {
        try {
            return await h.nachladen();
        } catch (fehler) {
            return null;
        }
    }

    /* `wie`: "neu-verbinden" | "admin-geben" | "admin-nehmen" | "beta-geben" | "beta-nehmen" | "entfernen".
       Liefert { ok: true } oder { ok: false, grund }. */
    async function ausfuehren(wie, spielerKennung, haken) {
        const h = hakenVon(haken || (stand && stand.h));
        const konto = K();
        const dialog = D();
        const sagen = async (titel, text) => {
            if (dialog) {
                await dialog.hinweis({ titel: titel, text: text });
            }
        };
        const daten = await nachladenStill(h);
        if (!daten || !konto) {
            await sagen(TEXTE.nichtsGeaendert, konto ? konto.fehlerText("netz") : TEXTE.gehtNicht);
            return { ok: false, grund: "netz" };
        }
        /* Dieselbe Prüfung wie die Sichtbarkeit (`erlaubt`), aber am FRISCHEN Stand: nur Admins (UP#Plus zählt mit)
           oder der Werkstatt-Haken. Rollen nur UP#Plus. Nie der eigene Eintrag. */
        const binAdmin = (typeof h.adminErlaubt === "function" && h.adminErlaubt())
            || (konto.aktiv() && konto.istAdmin(daten, konto.uid()));
        if (!binAdmin) {
            await sagen(TEXTE.nichtsGeaendert, TEXTE.nurAdmin);
            neuZeichnen();
            return { ok: false, grund: TEXTE.nurAdmin };
        }
        const spieler = finden(daten, spielerKennung);
        if (!spieler || !spieler.uid) {
            await sagen(TEXTE.nichtsGeaendert, TEXTE.nichtMehrDa);
            neuZeichnen();
            return { ok: false, grund: TEXTE.nichtMehrDa };
        }
        if (spieler.uid === konto.uid()) {
            await sagen(TEXTE.nichtsGeaendert, TEXTE.eigenes);
            return { ok: false, grund: TEXTE.eigenes };
        }
        if (/^(admin|beta)-/.test(wie) && !konto.istOberAdmin(daten, konto.uid())) {
            await sagen(TEXTE.nichtsGeaendert, TEXTE.nurOber);
            return { ok: false, grund: TEXTE.nurOber };
        }
        let wert = null;
        let ergebnis;
        const speicher = h.speicher();
        if (wie === "entfernen" || wie === "neu-verbinden") {
            if (knoepfe(daten, konto.uid(), spieler).indexOf(wie) === -1) {
                const grund = konto.istOberAdmin(daten, spieler.uid) ? "UP#Plus ist fest" : TEXTE.gehtNicht;
                await sagen(TEXTE.nichtsGeaendert, grund);
                neuZeichnen();
                return { ok: false, grund: grund };
            }
            ergebnis = (wie === "entfernen")
                ? await konto.eintragEntfernen(speicher, spieler)
                : await konto.freigeben(speicher, spieler);
            /* Entfernen nimmt auch die Rolle (`rollen/<uid>`) — sonst zählte ein entferntes Beta-Konto weiter in der
               Grenze. Schreiben darf das nur UP#Plus; erst NACH dem Eintrag, damit keine Rolle ohne Grund verloren geht. */
            if (wie === "entfernen" && ergebnis && ergebnis.ok && rolleWert(daten, spieler.uid)
                    && konto.istOberAdmin(daten, konto.uid())) {
                const rolle = await konto.rolleSetzen(speicher, spieler.uid, false);
                if (!rolle || !rolle.ok) {
                    await sagen(TEXTE.nichtGespeichert, TEXTE.rolleBlieb);
                }
            }
        } else {
            const ziel = rollenZiel(daten, spieler.uid, wie);
            if (ziel.grund) {
                await sagen(TEXTE.nichtsGeaendert, ziel.grund);
                neuZeichnen();
                return { ok: false, grund: ziel.grund };
            }
            wert = ziel.wert;
            if (wert === "admin" || (wert === null && wie === "admin-nehmen")) {
                ergebnis = await konto.rolleSetzen(speicher, spieler.uid, wert === "admin");
            } else {
                const aenderungen = { geaendertAm: Date.now() };
                aenderungen["rollen/" + spieler.uid] = wert;
                ergebnis = await konto._schreiben(speicher, aenderungen, null);
            }
        }
        if (!ergebnis || !ergebnis.ok) {
            const text = rollenFehlerText(wert, ergebnis && ergebnis.text);
            await sagen(TEXTE.nichtGespeichert, text);
            return { ok: false, grund: text };
        }
        await nachladenStill(h);
        if (typeof h.nachAenderung === "function") {
            try {
                h.nachAenderung(wie, spieler);
            } catch (fehler) {
                /* Neu zeichnen der App — die Änderung steht schon. */
            }
        }
        if (dialog) {
            dialog.kurzmeldung(TEXTE.fertig[wie] + (konto.anzeigeName ? konto.anzeigeName(spieler) : spieler.name));
        }
        neuZeichnen();
        return { ok: true };
    }

    let nachziehenLaeuft = false;

    async function nachziehen(haken) {
        const h = hakenVon(haken || (stand && stand.h));
        const konto = K();
        const dialog = D();
        if (nachziehenLaeuft || !konto) {
            return { ok: false };
        }
        nachziehenLaeuft = true;
        let ergebnis;
        try {
            ergebnis = await konto.nachziehen(h.speicher());
        } finally {
            nachziehenLaeuft = false;
        }
        if (!ergebnis || !ergebnis.ok) {
            if (dialog) {
                await dialog.hinweis({ titel: TEXTE.nichtNachgezogen, text: (ergebnis && ergebnis.text) || "" });
            }
            return { ok: false };
        }
        await nachladenStill(h);
        if (dialog) {
            /* F2 (17.10.2026): eine Kennung bei mehreren Konten wird nicht still übergangen. */
            const doppelt = Array.isArray(ergebnis.doppelt) ? ergebnis.doppelt.length : 0;
            await dialog.hinweis({ titel: TEXTE.nachgezogen, text: ergebnis.geschrieben + " geschrieben · "
                + ergebnis.uebersprungen + " übersprungen"
                + (doppelt > 0 ? " · " + doppelt + " Kennung doppelt" : "") });
        }
        neuZeichnen();
        return ergebnis;
    }

    /* ---------------------------------------------------------------- *
     * Zeichnen
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

    /* Ein Knopf mit Zwei-Schritt: der erste Tipp zeigt „Sicher?“ (3 s), der zweite führt aus. */
    function zweiSchritt(text, gefahr, aktion) {
        const k = el("button", "up-vw-knopf" + (gefahr ? " up-vw-gefahr" : ""), text);
        k.type = "button";
        let scharf = false;
        let laeuft = false;
        let uhr = null;
        const zurueck = () => {
            scharf = false;
            k.textContent = text;
            k.classList.remove("up-vw-scharf");
        };
        k.addEventListener("click", async (ereignis) => {
            if (ereignis && ereignis.stopPropagation) {
                ereignis.stopPropagation();
            }
            if (laeuft) {
                return;
            }
            if (!scharf) {
                scharf = true;
                k.textContent = TEXTE.sicher;
                k.classList.add("up-vw-scharf");
                uhr = setTimeout(zurueck, 3000);
                return;
            }
            clearTimeout(uhr);
            zurueck();
            laeuft = true;
            k.disabled = true;
            try {
                await aktion();
            } finally {
                laeuft = false;
                k.disabled = false;
            }
        });
        return k;
    }

    function knopfFuer(wie, spieler) {
        return zweiSchritt(TEXTE.knopf[wie], wie === "entfernen", () => ausfuehren(wie, spieler.id || spieler.uid));
    }

    function spaltenVon(h) {
        return Array.isArray(h.spalten) ? h.spalten.filter((s) => s && typeof s.titel === "string") : [];
    }

    function spaltenWert(spalte, spieler, daten) {
        try {
            const w = spalte.wert(spieler, daten);
            return (w === undefined || w === null || w === "") ? "–" : String(w);
        } catch (fehler) {
            return "–";
        }
    }

    function nameMitTag(spieler) {
        const konto = K();
        return konto && konto.anzeigeName ? konto.anzeigeName(spieler) : String(spieler.name || "");
    }

    /* Tabelle (rollt in sich) UND Karten-Liste (schmal); welche sichtbar ist, entscheidet das Stylesheet am Behälter. */
    function kontenBauen(h, daten) {
        const konto = K();
        const meineUid = konto ? konto.uid() : null;
        const extra = spaltenVon(h);
        const liste = konten(daten);
        const halter = el("div", "up-vw-konten");

        const roll = el("div", "up-vw-roll");
        const tabelle = el("table", "up-vw-tabelle");
        const kopf = el("thead");
        const kopfZeile = el("tr");
        for (const titel of TEXTE.spalten.concat(extra.map((s) => s.titel), [""])) {
            kopfZeile.appendChild(el("th", "", titel));
        }
        kopf.appendChild(kopfZeile);
        tabelle.appendChild(kopf);
        const koerper = el("tbody");

        const karten = el("ul", "up-vw-karten");

        for (const spieler of liste) {
            const binIch = !!(meineUid && spieler.uid === meineUid);
            const rolle = rolleText(daten, spieler.uid);
            const aktionen = knoepfe(daten, meineUid, spieler);

            const zeile = el("tr", binIch ? "up-vw-ich" : "");
            zeile.appendChild(el("td", "up-vw-name", nameMitTag(spieler) + (binIch ? TEXTE.du : "")));
            zeile.appendChild(el("td", "", kontoArt(spieler)));
            zeile.appendChild(el("td", "", rolle || TEXTE.keineRolle));
            for (const s of extra) {
                zeile.appendChild(el("td", "", spaltenWert(s, spieler, daten)));
            }
            const zelle = el("td", "up-vw-aktion");
            const reihe = el("div", "up-vw-knoepfe");
            aktionen.forEach((wie) => reihe.appendChild(knopfFuer(wie, spieler)));
            zelle.appendChild(reihe);
            zeile.appendChild(zelle);
            koerper.appendChild(zeile);

            const karte = el("li", "up-vw-konto" + (binIch ? " up-vw-ich" : ""));
            const kopfK = el("div", "up-vw-konto-kopf");
            kopfK.appendChild(el("b", "", nameMitTag(spieler) + (binIch ? TEXTE.du : "")));
            if (rolle) {
                kopfK.appendChild(el("span", "up-vw-marke", rolle));
            }
            karte.appendChild(kopfK);
            const werte = [kontoArt(spieler)].concat(extra.map((s) => s.titel + " " + spaltenWert(s, spieler, daten)));
            karte.appendChild(el("p", "up-vw-werte", werte.join(" · ")));
            if (aktionen.length) {
                const reiheK = el("div", "up-vw-knoepfe");
                aktionen.forEach((wie) => reiheK.appendChild(knopfFuer(wie, spieler)));
                karte.appendChild(reiheK);
            }
            karten.appendChild(karte);
        }
        tabelle.appendChild(koerper);
        roll.appendChild(tabelle);
        halter.appendChild(roll);
        halter.appendChild(karten);
        return halter;
    }

    function spielerlisteBauen(h, daten) {
        const konto = K();
        if (typeof UPCREW_SPIELERLISTE === "undefined" || !konto) {
            return null;
        }
        const w = h.spielerWerte || {};
        const auswahl = konten(daten)
            .filter((s) => !konto.istOberAdmin(daten, s.uid))
            .map((s) => (typeof w.muenzen === "function")
                ? Object.assign({}, s, { muenzen: w.muenzen(s) }) : s);
        const zeilen = UPCREW_SPIELERLISTE.zeilen(auswahl, {
            rolle: (uid) => rolleText(daten, uid),
            level: typeof w.level === "function" ? w.level : undefined,
            serie: typeof w.serie === "function" ? w.serie : undefined,
            abzeichen: typeof w.abzeichen === "function" ? w.abzeichen : undefined
        });
        const karte = el("section", "up-vw-karte up-vw-spielerliste");
        karte.appendChild(el("h4", "up-vw-titel", TEXTE.spielerliste));
        UPCREW_SPIELERLISTE.bauen(karte, {
            zeilen: zeilen,
            beiAuswahl: (zeile) => {
                const dialog = D();
                if (!dialog) {
                    return null;
                }
                const inhalt = el("div", "up-vw-details");
                inhalt.appendChild(UPCREW_SPIELERLISTE.details(zeile));
                if (typeof h.details === "function") {
                    const mehr = h.details(zeile, daten);
                    if (mehr) {
                        inhalt.appendChild(mehr);
                    }
                }
                return dialog.hinweis({ titel: zeile.name + (zeile.tag ? "#" + zeile.tag : ""), text: "", inhalt: inhalt });
            }
        });
        return karte;
    }

    function abschnitte(h) {
        const konto = K();
        const daten = h.daten();
        const binOber = !!(konto && konto.istOberAdmin(daten, konto.uid()));

        const spieler = el("div", "up-vw-spieler");
        const karte = el("section", "up-vw-karte");
        karte.appendChild(el("p", "up-vw-erklaerung", binOber ? TEXTE.erklaerungOber : TEXTE.erklaerung));
        if (binOber) {
            karte.appendChild(el("p", "up-vw-erklaerung up-vw-beta-zahl",
                ersetzen(TEXTE.beta, { n: betaAnzahl(daten), max: BETA_HOECHSTENS })));
        }
        karte.appendChild(kontenBauen(h, daten));
        spieler.appendChild(karte);
        const liste = spielerlisteBauen(h, daten);
        if (liste) {
            spieler.appendChild(liste);
        }

        const datenbank = [];
        if (konto && typeof konto.istP12 === "function" && konto.istP12() && konto.uid() === konto.OBER_UID) {
            datenbank.push({ zeichen: "schild", titel: TEXTE.nachziehen, unter: TEXTE.nachziehenUnter, rechts: "pfeil",
                beiKlick: () => nachziehen(h) });
        }

        let spiel = { art: "spiel", zeilen: [] };
        if (typeof h.spiel === "function") {
            const s = h.spiel() || {};
            spiel = { art: "spiel", zeilen: s.zeilen || [], inhalt: s.inhalt || null, hinweis: s.hinweis || "" };
        }

        return [
            { art: "spieler", inhalt: spieler },
            { art: "datenbank", zeilen: datenbank },
            spiel,
            { art: "ende", zeilen: typeof h.schliessen === "function"
                ? [{ zeichen: "verlassen", titel: TEXTE.beenden, beiKlick: () => h.schliessen() }] : [] }
        ];
    }

    function zeichnen() {
        if (!stand) {
            return;
        }
        const { ort, h } = stand;
        ort.textContent = "";
        ort.classList.add("up-vw");
        if (!erlaubt(h)) {
            UPCREW_EINSTELLUNGEN.bauen(ort, "verwaltung", [{ art: "spieler", zeilen: [{ zeichen: "schloss",
                titel: TEXTE.nurAdmin }] }], { spiel: h.app });
            return;
        }
        UPCREW_EINSTELLUNGEN.bauen(ort, "verwaltung", abschnitte(h), { spiel: h.app });
    }

    function zeigen(ort, haken) {
        const h = hakenVon(haken);
        stand = { ort: ort, h: h };
        zeichnen();
        return { neuZeichnen: neuZeichnen };
    }

    /* Nach Änderungen: neu zeichnen, solange die Verwaltung im Dokument hängt. */
    function neuZeichnen() {
        if (stand && stand.ort && stand.ort.isConnected !== false) {
            zeichnen();
        }
    }

    const UPCREW_VERWALTUNG = {
        BETA_HOECHSTENS: BETA_HOECHSTENS,
        PFLICHT: PFLICHT,
        TEXTE: TEXTE,
        rolleWert: rolleWert,
        betaAnzahl: betaAnzahl,
        rollenZiel: rollenZiel,
        rollenFehlerText: rollenFehlerText,
        rolleText: rolleText,
        kontoArt: kontoArt,
        knoepfe: knoepfe,
        erlaubt: (haken) => erlaubt(hakenVon(haken)),
        abschnitte: (haken) => abschnitte(hakenVon(haken)),
        ausfuehren: ausfuehren,
        nachziehen: nachziehen,
        zeigen: zeigen,
        neuZeichnen: neuZeichnen
    };
    if (typeof window !== "undefined") {
        window.UPCREW_VERWALTUNG = UPCREW_VERWALTUNG;
    }
    if (typeof globalThis !== "undefined") {
        globalThis.UPCREW_VERWALTUNG = UPCREW_VERWALTUNG;
    }
    if (typeof module !== "undefined" && module.exports) {
        module.exports = UPCREW_VERWALTUNG;
    }
})();
