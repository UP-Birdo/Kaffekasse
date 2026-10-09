/*
 * upcrew-wischen.js — Tabs wechseln durch Wischen: das SEITEN-BAND, gleich in Blunderluck und Typoluck
 * (gehört zu css\upcrew-wischen.css). Gemeinsamer Baustein: in die Apps KOPIEREN, nie abwandeln.
 *
 * Nutzer 03.10.2026 (nach der Probe der Fassung „Zeiger folgen“): „generell viel zu anstregend zu wischen es soll
 * schon kleine swip bewegung ausreichen. wenn man in eine richtung wischt soll dort schon die nächste seite zu
 * sehen sein. als wären die seiten nicht wirklich getrent einzelene seiten sondern eine breite wo man durch
 * scrollen kann wagrecht und an fix punkten hängen bleiebt“. Die Leiste unten bleibt, wie sie ist.
 *
 * DAS BAND
 *   Alle Tab-Seiten liegen nebeneinander in EINEM Behälter, den der Browser selbst waagrecht rollt und einrastet
 *   (CSS scroll-snap, siehe upcrew-wischen.css). Der Baustein verschiebt nichts und fängt keine Berührung ab —
 *   das Gefühl (kleiner Wisch reicht, Nachbarseite sofort zu sehen, Schwung, Stopp an den Enden) kommt vom Gerät.
 *   Er tut nur dreierlei: die Seiten in Leisten-Reihenfolge ordnen, nach dem Einrasten den Tab setzen und beim
 *   Tipp auf die Leiste das Band zur Seite rollen.
 *
 * AUFBAU IM SPIEL
 *     <main class="up-band" id="band">
 *         <section class="up-band-seite" data-up-seite="shop"> … </section>
 *         <section class="up-band-seite" data-up-seite="sammlung"> … </section>
 *         …
 *     </main>
 *   Jede Seite ist ein UNMITTELBARES Kind des Bandes, trägt `data-up-seite="<Tab-Id>"` und rollt senkrecht für
 *   sich. Die Reihenfolge im Dokument ist gleich: Der Baustein ordnet nach `tabs()` (CSS `order`). Seiten, deren
 *   Tab still ist oder fehlt, blendet er aus (`hidden`) — sie stehen nicht im Band.
 *
 * VERTRAG
 *     const band = UPCREW_WISCHEN.an(element, {
 *         tabs: () => ["shop", "sammlung", "start", { id: "bald", still: true }, …],   // Leisten-Reihenfolge
 *         aktiv: () => "start",                    // der offene Tab (steht er nicht im Band: der Baustein ruht)
 *         wechseln: (id, richtung) => TABS.wechseln(id),   // NACH dem Einrasten auf einer anderen Seite; derselbe
 *                                                  // Weg wie ein Tipp auf die Leiste. richtung +1 = nach rechts
 *                                                  // in der Leiste, -1 = nach links
 *         erlaubt: () => !partieLaeuft,            // wahlfrei: false = Band gesperrt (Partie, Anmeldung …)
 *         kommt: (id, richtung) => {},             // wahlfrei: Seite `id` kommt gleich in Sicht — wer Seiten erst
 *                                                  // bei Bedarf baut, baut sie jetzt
 *         frueh: false,                            // wahlfrei: true = die Leiste zieht schon nach, sobald das
 *                                                  // losgelassene Band die Hälfte zur Nachbarseite überschritten
 *                                                  // hat — nicht erst nach dem Einrasten
 *         oben: true,                              // wahlfrei: eine verlassene Seite springt (unsichtbar) nach
 *                                                  // oben, wie bisher jeder Tab oben beginnt; false = merken
 *         maus: false,                             // wahlfrei: true = am Rechner auch mit der Maus ziehen
 *         melden: (bericht) => {}                  // wahlfrei: Mess-Bericht je Einrasten (Probe-Seite)
 *     });
 *     band.zu(id)                 das Band rollt zur Seite (sanft; { sofort: true } oder ruhige Bewegung = ohne
 *                                 Weg). Steht es schon dort, geschieht nichts — `wechseln` des Spiels darf also
 *                                 IMMER `band.zu(id)` rufen, ob der Wechsel vom Tipp oder vom Band kam.
 *     band.auffrischen()          Tabs oder Sperre haben sich geändert (Partie beginnt/endet, Tab wird still)
 *     band.sperren(true|false)    das Band von Hand festhalten
 *     band.ort()                  die Seite, auf der das Band zuletzt eingerastet ist
 *     band.aus()                  abmelden
 *
 * VERHALTEN
 *   - Wischen: Der Browser rollt, die Nachbarseite hängt sichtbar an, beim Loslassen rastet das Band auf der
 *     nächsten Seite ein (höchstens eine Seite je Wisch: `scroll-snap-stop: always`). KEIN Rundlauf — das Band
 *     hat zwei Enden (Nutzer 27.09.2026: „rechts und links ist Stopp“).
 *   - Die Leiste folgt dem Band: Erst wenn es eingerastet ist (`scrollend`; ohne dieses Ereignis: kurze Ruhe
 *     nach dem letzten `scroll`), ruft der Baustein `wechseln`. Die Kapsel wandert nicht mit dem Finger.
 *   - Mit `frueh: true` (Nutzer 03.10.2026: „die leiste“ soll nicht warten): Ist der Finger oben und hat das Band
 *     die Hälfte zur Nachbarseite überschritten, steht fest, wo es einrastet — `wechseln` kommt dann sofort, das
 *     Band rollt allein zu Ende. Solange der Finger das Band hält, bleibt die Leiste stehen. Greift der Finger
 *     noch einmal zu und zieht zurück, wechselt die Leiste beim Einrasten wieder zurück.
 *   - Ein Tipp auf die Leiste: Das Spiel wechselt wie immer und ruft `band.zu(id)`.
 *   - Stille Tabs stehen nicht im Band. Seiten neben der eingerasteten sind `inert` (kein Fokus, kein Tipp,
 *     nichts für Vorlese-Programme), bis das Band auf ihnen einrastet.
 *   - GESPERRT (das Band rollt nicht waagrecht, Klasse `up-band-gesperrt`): wenn `erlaubt()` false ist, wenn ein
 *     Blatt, eine Karte oder ein Dialog offen ist (html.up-bl-offen — das hält schon das CSS —, sichtbares
 *     [aria-modal="true"], dialog[open]) oder nach `sperren(true)`. Geprüft wird bei jeder Berührung, bei
 *     `auffrischen()` und von selbst, sobald sich die Klassen an <html> oder <body> ändern (dort merken die
 *     Spiele „Partie läuft“, dort setzt upcrew-blatt.js sein Zeichen). Hängt `erlaubt()` an etwas anderem, ruft
 *     das Spiel `auffrischen()`.
 *   - War das Band verborgen (display: none — der Browser vergisst dabei den Rollstand), springt das nächste
 *     `zu()` ohne Weg: Es soll nicht sichtbar von der ersten Seite losrollen.
 *   - Nichts im Band darf selbst waagrecht rollen oder ziehen — es nähme dem Band den Wisch. Wo es sein muss
 *     (Schieberegler, Spielbrett): Klasse `up-band-fest` oder `data-kein-wischen` (CSS: touch-action: pan-y),
 *     dort beginnt kein Seitenwechsel.
 *   - Mit `prefers-reduced-motion: reduce` rollt `zu()` ohne Weg. Das Wischen selbst bleibt (es ist die
 *     Bewegung des Fingers).
 *   - `maus: true`: Am Rechner zieht die Maus das Band (dort rollt der Browser beim Ziehen nicht selbst). Schon
 *     15 % der Breite oder ein flotter kurzer Zug genügen. Finger und Stift gehen nie über diesen Weg.
 */
(function () {
    "use strict";

    const SPIEL_PX = 2;            // so nah an einer Seite gilt das Band als eingerastet
    const RUHE_MS = 140;           // ohne `scrollend`: so lange kein `scroll` = das Band ruht
    const RUHE_SICHER_MS = 400;    // mit `scrollend`: Rückfall, falls das Ereignis ausbleibt
    const BREITE_OHNE = 390;       // Rückfall, wenn keine Breite zu messen ist
    const MAUS_ACHSE_PX = 6;       // Maus: nach so viel Weg steht fest, ob gezogen wird
    const MAUS_ANTEIL = 0.15;      // Maus: Loslassen jenseits dieses Anteils der Breite = nächste Seite
    const MAUS_FLOTT_PX_MS = 0.3;  // Maus: flotter Zug …
    const MAUS_FLOTT_MIN_PX = 20;  // … und mindestens so viel Weg = nächste Seite
    const TEMPO_FENSTER_MS = 100;  // Tempo nur aus den letzten 100 ms
    const MAUS_AUS_MS = 700;       // Maus: spätestens dann gilt das Nachrollen als beendet

    const MAUS_SPERREN = "input, textarea, select, [contenteditable=''], [contenteditable='true'], "
        + "[data-kein-wischen], .up-band-fest";

    /* ---- Reine Logik (getestet: UPCrew tests\test-wischen-band.js) ---- */

    /* Die Seiten des Bandes in Leisten-Reihenfolge: stille Tabs fehlen, doppelte Namen zählen einmal. */
    function seiten(tabs) {
        const reihe = [];
        for (const t of tabs || []) {
            const tab = typeof t === "string" ? { id: t } : t;
            if (tab && tab.id && !tab.still && reihe.indexOf(tab.id) === -1) {
                reihe.push(tab.id);
            }
        }
        return reihe;
    }

    /* Der Nachbar in Leisten-Reihenfolge, stille Tabs übersprungen; null an den Enden oder ohne aktiven Tab. */
    function nachbar(tabs, aktiv, schritt) {
        const reihe = seiten(tabs);
        const stelleJetzt = reihe.indexOf(aktiv);
        const ziel = stelleJetzt + (schritt > 0 ? 1 : (schritt < 0 ? -1 : 0));
        if (stelleJetzt === -1 || !schritt || ziel < 0 || ziel >= reihe.length) {
            return null;
        }
        return reihe[ziel];
    }

    /* Wo eine Seite im Band beginnt (px vom linken Ende). */
    function linksVon(stelleImBand, breite) {
        return Math.max(0, stelleImBand) * (breite > 0 ? breite : BREITE_OHNE);
    }

    /* Die Seite, die dem Rollstand am nächsten liegt (0 … anzahl − 1); -1 ohne Seiten. */
    function stelle(links, breite, anzahl) {
        if (!(anzahl > 0)) {
            return -1;
        }
        const b = breite > 0 ? breite : BREITE_OHNE;
        return Math.max(0, Math.min(anzahl - 1, Math.round(links / b)));
    }

    /* Ist das Band eingerastet? Die Stelle der Seite — oder -1, wenn es zwischen zwei Seiten steht. */
    function eingerastet(links, breite, anzahl, spiel) {
        const i = stelle(links, breite, anzahl);
        if (i < 0) {
            return -1;
        }
        const s = typeof spiel === "number" ? spiel : SPIEL_PX;
        return Math.abs(links - linksVon(i, breite)) <= s ? i : -1;
    }

    /* Welche Seiten gerade (auch nur zum Teil) zu sehen sind: [erste, letzte] Stelle. */
    function sichtbar(links, breite, anzahl) {
        if (!(anzahl > 0)) {
            return [-1, -1];
        }
        const b = breite > 0 ? breite : BREITE_OHNE;
        const grenze = (n) => Math.max(0, Math.min(anzahl - 1, n));
        return [grenze(Math.floor((links + 1) / b)), grenze(Math.ceil((links - 1) / b))];
    }

    /* Das Tempo beim Loslassen in px/ms (Vorzeichen wie die Bewegung) aus der Spur [{ x, t }, …] — nur die
       letzten 100 ms. Ruhte die Maus vorher, ist es 0. */
    function tempo(spur, jetzt) {
        const frisch = (spur || []).filter((p) => jetzt - p.t <= TEMPO_FENSTER_MS);
        if (frisch.length < 2) {
            return 0;
        }
        const dauer = frisch[frisch.length - 1].t - frisch[0].t;
        return dauer > 0 ? (frisch[frisch.length - 1].x - frisch[0].x) / dauer : 0;
    }

    /* Maus losgelassen: Auf welcher Seite rastet das Band ein?
       m = { von (Stelle beim Start), weg (px; < 0 = nach links gezogen = zur nächsten Seite rechts),
             tempo (px/ms, Vorzeichen wie weg), breite, anzahl }  →  { stelle, grund } */
    function mausZiel(m) {
        const breite = m.breite > 0 ? m.breite : BREITE_OHNE;
        const weg = m.weg || 0;
        const tp = m.tempo || 0;
        const schritt = weg < 0 ? 1 : (weg > 0 ? -1 : 0);
        const ziel = m.von + schritt;
        if (!schritt) {
            return { stelle: m.von, grund: "kein Weg" };
        }
        if (ziel < 0 || ziel >= m.anzahl) {
            return { stelle: m.von, grund: "Ende, kein Nachbar" };
        }
        const schnell = Math.abs(tp) >= MAUS_FLOTT_PX_MS;
        const gleichsinnig = (tp < 0) === (weg < 0);
        if (schnell && !gleichsinnig) {
            return { stelle: m.von, grund: "zurückgeworfen" };
        }
        if (Math.abs(weg) >= MAUS_ANTEIL * breite) {
            return { stelle: ziel, grund: "weit" };
        }
        if (schnell && Math.abs(weg) >= MAUS_FLOTT_MIN_PX) {
            return { stelle: ziel, grund: "flott" };
        }
        return { stelle: m.von, grund: "zu kurz" };
    }

    /* Ist ein Blatt, eine Karte oder ein Dialog offen? */
    function dialogOffen(dok) {
        const d = dok || (typeof document !== "undefined" ? document : null);
        if (!d) {
            return false;
        }
        /* Blatt oder Karte des Bausteins upcrew-blatt.js: er setzt die Klasse an <html>. */
        const wurzel = d.documentElement;
        if (wurzel && wurzel.classList && wurzel.classList.contains("up-bl-offen")) {
            return true;
        }
        if (typeof d.querySelectorAll !== "function") {
            return false;
        }
        for (const el of d.querySelectorAll("[aria-modal='true'], dialog[open]")) {
            if (!el.getClientRects || el.getClientRects().length > 0) {
                return true;
            }
        }
        return false;
    }

    /* Warum das Band gerade nicht rollt — "" = es darf. */
    function sperrGrund(opt, dok, vonHand) {
        if (vonHand) {
            return "gesperrt";
        }
        if (opt && typeof opt.erlaubt === "function" && !opt.erlaubt()) {
            return "nicht erlaubt";
        }
        return dialogOffen(dok) ? "Blatt oder Dialog offen" : "";
    }

    /* ---- Gerät ---- */

    function ruhig() {
        return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function uhr() {
        return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
    }

    /* Die Zeit eines Ereignisses (so stimmt das Tempo auch, wenn der Browser Ereignisse bündelt). */
    function zeit(e) {
        return e && typeof e.timeStamp === "number" ? e.timeStamp : uhr();
    }

    function an(band, opt) {
        opt = opt || {};
        const dok = band.ownerDocument || (typeof document !== "undefined" ? document : null);
        const hatEnde = "onscrollend" in band;
        band.classList.add("up-band");

        let ortId = null;            // die Seite, auf der das Band zuletzt eingerastet ist
        let wunsch = null;           // wohin es soll, solange es keine Breite hat (verborgen)
        let vonHand = false;         // sperren(true)
        let quelle = "";             // was das Band gerade bewegt: "tipp" | "maus" | "" (der Browser: Finger, Rad, Tasten)
        let fahrt = null;            // seit dem letzten Einrasten: { von, t, gemeldet: { id: true } }
        let ruheTimer = 0;
        let zug = null;              // die Maus zieht: { id, x, y, links, von, breite, anzahl, zieht, anker, spur }
        let mausTimer = 0;
        let schluckenBis = 0;
        let imWechsel = false;
        let fingerUnten = false;     // nur für `frueh`: solange ein Finger das Band hält, bleibt die Leiste stehen
        let breiteZuletzt = 0;       // 0 = das Band war (oder ist) verborgen

        const PASSIV = { passive: true };
        const FANG = { capture: true, passive: true };

        /* Die Seiten-Elemente: unmittelbare Kinder mit data-up-seite. */
        const elemente = () => {
            const liste = [];
            for (const el of band.children || []) {
                if (el && el.dataset && el.dataset.upSeite) {
                    liste.push(el);
                }
            }
            return liste;
        };

        /* Die Breite einer Seite — aus dem Layout (ganze Bandlänge durch die Zahl der Seiten: auch bei krummen
           Gerätebreiten genau), nie aus getBoundingClientRect: Liegt eine Verkleinerung auf dem Band
           (upcrew-blatt.js rückt die Seite hinter einem Blatt zurück, scale .94), mässe das 6 % zu wenig. */
        const breite = () => {
            const sichtbare = elemente().filter((el) => !el.hidden).length;
            const ganz = band.scrollWidth || 0;
            return (sichtbare && ganz ? ganz / sichtbare : 0) || band.clientWidth || 0;
        };

        /* Die Reihe des Bandes: Leisten-Reihenfolge, nur was eine Seite hat. */
        const reiheVon = () => {
            const da = elemente().map((el) => el.dataset.upSeite);
            return seiten(opt.tabs()).filter((id) => da.indexOf(id) !== -1);
        };

        const sperreSetzen = () => {
            const grund = sperrGrund(opt, dok, vonHand);
            band.classList[grund ? "add" : "remove"]("up-band-gesperrt");
            return grund;
        };

        /* Nur die eingerastete Seite ist bedienbar; die Nachbarn sind zu sehen, aber `inert`. */
        const bedienbar = (id) => {
            for (const el of elemente()) {
                el.inert = el.dataset.upSeite !== id;
            }
        };

        const ordnen = () => {
            const reihe = seiten(opt.tabs());
            for (const el of elemente()) {
                const i = reihe.indexOf(el.dataset.upSeite);
                el.classList.add("up-band-seite");
                el.hidden = i === -1;
                el.style.order = i === -1 ? "" : String(i);
            }
        };

        const bericht = (mehr) => {
            if (typeof opt.melden !== "function") {
                return;
            }
            try {
                opt.melden(Object.assign({ quelle: "band", von: null, zu: null, schritt: 0, gewechselt: false, ms: 0,
                    links: Math.round(band.scrollLeft || 0), breite: Math.round(breite()), grund: "",
                    ende: hatEnde ? "scrollend" : "Ruhe nach scroll" }, mehr || {}));
            } catch (fehler) {
                /* die Mess-Anzeige darf das Band nie stören */
            }
        };

        const kommtMelden = (id, schritt) => {
            if (!id || typeof opt.kommt !== "function" || (fahrt && fahrt.gemeldet[id])) {
                return;
            }
            if (fahrt) {
                fahrt.gemeldet[id] = true;
            }
            try {
                opt.kommt(id, schritt);
            } catch (fehler) {
                /* das Vorbereiten einer Seite darf das Band nie stören */
            }
        };

        const fahrtBeginnen = () => {
            if (!fahrt) {
                fahrt = { von: ortId, t: uhr(), gemeldet: {} };
            }
        };

        /* `wechseln` des Spiels rufen. Solange es läuft, ist `zu()` stumm: Das Band ist schon dort oder rollt
           gerade von selbst hin. */
        const spielWechseln = (id, schritt) => {
            imWechsel = true;
            try {
                opt.wechseln(id, schritt);
            } finally {
                imWechsel = false;
            }
        };

        /* Nur mit `frueh`: Der Finger ist oben und das Band hat die Hälfte überschritten — die Leiste zieht
           schon jetzt nach. Nicht beim Tipp (das Band fährt dann über fremde Seiten hinweg) und nicht, solange
           die Maus zieht. */
        function vorausPruefen() {
            if (!opt.frueh || imWechsel || fingerUnten || !fahrt || quelle === "tipp" || (zug && zug.zieht)) {
                return;
            }
            const reihe = reiheVon();
            const b = breite();
            if (!b || !reihe.length) {
                return;
            }
            const i = stelle(band.scrollLeft, b, reihe.length);
            const naechste = reihe[i];
            const offen = opt.aktiv();
            const stelleOffen = reihe.indexOf(offen);
            if (naechste === offen || stelleOffen === -1 || sperrGrund(opt, dok, vonHand)) {
                return;
            }
            fahrt.voraus = naechste;
            fahrt.vorausMs = Math.round(uhr() - fahrt.t);
            /* Bedienbar wird die Seite erst beim Einrasten: Öffnete ein Tipp mitten im Ausrollen ein Blatt,
               hielte dessen Sperre das Band zwischen zwei Seiten fest. */
            spielWechseln(naechste, i > stelleOffen ? 1 : -1);
        }

        /* Das Band steht still. Ist es auf einer Seite eingerastet, gilt sie — und die Leiste zieht nach. */
        function ruht() {
            clearTimeout(ruheTimer);
            ruheTimer = 0;
            if (imWechsel || (zug && zug.zieht)) {
                return;                      /* `wechseln` des Spiels ruft `zu()` — das ist kein neues Einrasten */
            }
            const reihe = reiheVon();
            const b = breite();
            if (!b || !reihe.length) {
                return;
            }
            const i = eingerastet(band.scrollLeft, b, reihe.length, SPIEL_PX);
            if (i < 0) {
                return;                      /* zwischen zwei Seiten (der Finger hält das Band): weiter warten */
            }
            clearTimeout(mausTimer);
            band.classList.remove("up-band-zieht");
            const neu = reihe[i];
            const alt = ortId;
            const offen = opt.aktiv();
            const stelleOffen = reihe.indexOf(offen);
            const lauf = fahrt;
            const woher = quelle || "band";
            fahrt = null;
            quelle = "";

            if (neu !== offen && stelleOffen !== -1 && sperrGrund(opt, dok, vonHand)) {
                /* Gesperrt und doch verrutscht (Fokus, Suche im Dokument): zurück zur offenen Seite. */
                ortId = offen;
                bedienbar(offen);
                band.scrollLeft = linksVon(stelleOffen, b);
                bericht({ quelle: woher, von: alt, zu: offen, grund: "gesperrt: zurück", links: Math.round(linksVon(stelleOffen, b)) });
                return;
            }

            ortId = neu;
            wunsch = null;
            bedienbar(neu);
            if (opt.oben !== false && neu !== alt) {
                for (const el of elemente()) {
                    if (el.dataset.upSeite !== neu && el.scrollTop) {
                        el.scrollTop = 0;
                    }
                }
            }
            const wechsel = neu !== offen && stelleOffen !== -1;
            const schritt = wechsel ? (i > stelleOffen ? 1 : -1) : 0;
            if (wechsel) {
                spielWechseln(neu, schritt);
            }
            if (lauf || wechsel) {
                bericht({ quelle: woher, von: lauf ? lauf.von : alt, zu: neu, schritt: schritt, gewechselt: wechsel,
                    ms: lauf ? Math.round(uhr() - lauf.t) : 0, maus: (lauf && lauf.grundMaus) || "",
                    voraus: !!(lauf && lauf.voraus === neu), vorausMs: lauf && lauf.voraus === neu ? lauf.vorausMs : 0,
                    grund: wechsel ? "eingerastet" : (lauf && lauf.voraus === neu ? "eingerastet, Leiste war voraus"
                        : (neu === (lauf ? lauf.von : alt) ? "zurück auf dieselbe Seite" : "eingerastet, Tab stand schon")) });
            }
        }

        const rollt = () => {
            const reihe = reiheVon();
            const b = breite();
            const basis = reihe.indexOf(ortId);
            if (!fahrt && basis !== -1 && b && Math.abs(band.scrollLeft - linksVon(basis, b)) <= 1) {
                return;                      /* das Nach-Ereignis eines Sprungs ohne Weg: Das Band steht, wo es stand */
            }
            fahrtBeginnen();
            if (typeof opt.kommt === "function" && b && reihe.length) {
                const [erste, letzte] = sichtbar(band.scrollLeft, b, reihe.length);
                for (let i = erste; i <= letzte; i++) {
                    if (reihe[i] !== ortId) {
                        kommtMelden(reihe[i], basis === -1 || i > basis ? 1 : -1);
                    }
                }
            }
            vorausPruefen();
            clearTimeout(ruheTimer);
            ruheTimer = setTimeout(ruht, hatEnde ? RUHE_SICHER_MS : RUHE_MS);
        };

        function zu(id, wahl) {
            const reihe = reiheVon();
            const i = reihe.indexOf(id);
            if (i === -1) {
                return false;
            }
            if (fahrt && fahrt.voraus === id && quelle !== "tipp") {
                return true;                 /* die Leiste war voraus: Das Band rollt schon von selbst dorthin */
            }
            const b = breite();
            if (!b) {
                wunsch = id;                 /* verborgen: beim Sichtbarwerden nachholen (Größen-Beobachter) */
                breiteZuletzt = 0;
                return true;
            }
            if (!breiteZuletzt) {
                /* eben wieder sichtbar geworden (der Größen-Beobachter kommt erst später): ohne Weg */
                breiteZuletzt = b;
                wahl = { leise: true };
            }
            const soll = linksVon(i, b);
            sperreSetzen();
            if (Math.abs(band.scrollLeft - soll) <= 1) {
                ruht();                      /* steht schon dort */
                return true;
            }
            if (wahl && wahl.leise) {
                /* ohne Weg und ohne Bericht: Start, Größenänderung, auffrischen */
                band.scrollLeft = soll;
                ruht();
                return true;
            }
            fahrtBeginnen();
            quelle = "tipp";
            bedienbar(id);
            kommtMelden(id, i > reihe.indexOf(ortId) ? 1 : -1);
            const sanft = !(wahl && wahl.sofort) && !ruhig() && typeof band.scrollTo === "function";
            if (zug && !zug.zieht) {
                zug = null;
            }
            if (sanft) {
                band.scrollTo({ left: soll, behavior: "smooth" });
            } else {
                band.scrollLeft = soll;
                ruht();
            }
            return true;
        }

        function auffrischen() {
            ordnen();
            sperreSetzen();
            const reihe = reiheVon();
            const offen = opt.aktiv();
            const ziel = reihe.indexOf(offen) !== -1 ? offen : (reihe.indexOf(ortId) !== -1 ? ortId : null);
            if (ziel) {
                zu(ziel, { leise: true });
            }
        }

        /* ---- Berührung und Maus ---- */

        const mausEnde = (zielStelle, grund) => {
            const z = zug;
            zug = null;
            if (!z || !z.zieht) {
                return;
            }
            schluckenBis = Date.now() + 350;
            const soll = linksVon(zielStelle, z.breite);
            fahrtBeginnen();
            if (fahrt) {
                fahrt.grundMaus = grund;
            }
            clearTimeout(mausTimer);
            /* Das Einrasten bleibt aus, bis das Band am Ziel ist — sonst spränge es sofort. */
            mausTimer = setTimeout(() => {
                band.classList.remove("up-band-zieht");
                ruht();
            }, MAUS_AUS_MS);
            if (ruhig() || typeof band.scrollTo !== "function") {
                band.scrollLeft = soll;
                ruht();
            } else {
                band.scrollTo({ left: soll, behavior: "smooth" });
                if (Math.abs(band.scrollLeft - soll) <= 1) {
                    ruht();
                }
            }
        };

        const zeigerRunter = (e) => {
            const grund = sperreSetzen();
            if (!opt.maus || e.pointerType !== "mouse" || e.button || grund) {
                return;
            }
            const ziel = e.target;
            if (ziel && typeof ziel.closest === "function" && ziel.closest(MAUS_SPERREN)) {
                return;
            }
            const reihe = reiheVon();
            const b = breite();
            if (!b || !reihe.length) {
                return;
            }
            zug = { id: e.pointerId, x: e.clientX, y: e.clientY, links: band.scrollLeft, breite: b, anzahl: reihe.length,
                von: stelle(band.scrollLeft, b, reihe.length), zieht: false, anker: 0, spur: [{ x: e.clientX, t: zeit(e) }] };
        };

        const zeigerBewegt = (e) => {
            const z = zug;
            if (!z || e.pointerId !== z.id) {
                return;
            }
            const dx = e.clientX - z.x;
            const dy = e.clientY - z.y;
            if (!z.zieht) {
                if (Math.abs(dx) < MAUS_ACHSE_PX && Math.abs(dy) < MAUS_ACHSE_PX) {
                    return;
                }
                if (Math.abs(dx) <= Math.abs(dy)) {
                    zug = null;              /* senkrecht: Die Maus markiert oder tut nichts */
                    return;
                }
                z.zieht = true;
                z.anker = dx;                /* ab hier 1:1, ohne Sprung */
                quelle = "maus";
                fahrtBeginnen();
                clearTimeout(mausTimer);
                band.classList.add("up-band-zieht");
                if (typeof band.setPointerCapture === "function") {
                    try {
                        band.setPointerCapture(z.id);
                    } catch (fehler) {
                        /* der Zeiger ist schon weg */
                    }
                }
            }
            if (typeof e.preventDefault === "function" && e.cancelable !== false) {
                e.preventDefault();
            }
            z.spur.push({ x: e.clientX, t: zeit(e) });
            if (z.spur.length > 12) {
                z.spur.shift();
            }
            /* höchstens eine Seite weit, und nie über die Enden */
            const unten = Math.max(0, linksVon(z.von - 1, z.breite));
            const oben = Math.min(linksVon(z.anzahl - 1, z.breite), linksVon(z.von + 1, z.breite));
            band.scrollLeft = Math.max(unten, Math.min(oben, z.links - (dx - z.anker)));
        };

        const zeigerHoch = (e) => {
            const z = zug;
            if (!z || e.pointerId !== z.id) {
                return;
            }
            if (!z.zieht) {
                zug = null;
                return;
            }
            const e2 = mausZiel({ von: z.von, weg: z.links - band.scrollLeft, tempo: tempo(z.spur, zeit(e)), breite: z.breite,
                anzahl: z.anzahl });
            mausEnde(e2.stelle, e2.grund);
        };

        const zeigerAbbruch = (e) => {
            const z = zug;
            if (z && e.pointerId === z.id) {
                mausEnde(z.von, "abgebrochen");
            }
        };

        /* Nach einem Zug mit der Maus kein Klick auf das, was darunter lag. */
        const klick = (e) => {
            if (schluckenBis && Date.now() < schluckenBis) {
                schluckenBis = 0;
                if (typeof e.stopPropagation === "function") {
                    e.stopPropagation();
                }
                if (typeof e.preventDefault === "function") {
                    e.preventDefault();
                }
            }
        };

        /* Nur für `frueh`: Hält ein Finger das Band? (Nur gelesen — gerollt wird weiter vom Browser.) */
        const fingerRunter = () => {
            fingerUnten = true;
        };
        const fingerHoch = (e) => {
            fingerUnten = !!(e && e.touches && e.touches.length > 0);
            vorausPruefen();
        };

        /* Das Band wird breiter, schmaler oder sichtbar: ohne Weg zurück auf seine Seite. */
        const groesse = () => {
            const b = breite();
            if (b === breiteZuletzt || (zug && zug.zieht)) {
                return;                      /* nur die Höhe hat sich geändert (Adressleiste) */
            }
            breiteZuletzt = b;
            const ziel = wunsch || (fahrt ? opt.aktiv() : ortId);
            if (ziel && b) {
                zu(ziel, { leise: true });
            }
        };

        band.addEventListener("scroll", rollt, PASSIV);
        if (hatEnde) {
            band.addEventListener("scrollend", ruht, PASSIV);
        }
        band.addEventListener("pointerdown", zeigerRunter, FANG);
        if (opt.frueh) {
            band.addEventListener("touchstart", fingerRunter, PASSIV);
            band.addEventListener("touchend", fingerHoch, PASSIV);
            band.addEventListener("touchcancel", fingerHoch, PASSIV);
        }
        if (opt.maus) {
            band.addEventListener("pointermove", zeigerBewegt, false);
            band.addEventListener("pointerup", zeigerHoch, PASSIV);
            band.addEventListener("pointercancel", zeigerAbbruch, PASSIV);
            band.addEventListener("click", klick, true);
        }
        const beobachter = typeof ResizeObserver === "function" ? new ResizeObserver(groesse) : null;
        if (beobachter) {
            beobachter.observe(band);
        } else if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
            window.addEventListener("resize", groesse);
        }

        /* Die Sperre zieht von selbst nach, wenn sich die Klassen an <html> oder <body> ändern. */
        const waechter = typeof MutationObserver === "function" && dok ? new MutationObserver(() => sperreSetzen()) : null;
        if (waechter) {
            for (const el of [dok.documentElement, dok.body]) {
                if (el && el.nodeType === 1) {
                    waechter.observe(el, { attributes: true, attributeFilter: ["class"] });
                }
            }
        }

        ordnen();
        sperreSetzen();
        breiteZuletzt = breite();
        {
            const reihe = reiheVon();
            const offen = opt.aktiv();
            const startId = reihe.indexOf(offen) !== -1 ? offen : null;
            if (startId) {
                ortId = startId;
                bedienbar(startId);
                zu(startId, { leise: true });
            }
        }

        return {
            zu: zu,
            auffrischen: auffrischen,
            sperren(ja) {
                vonHand = !!ja;
                sperreSetzen();
            },
            ort: () => ortId,
            aus() {
                clearTimeout(ruheTimer);
                clearTimeout(mausTimer);
                zug = null;
                band.removeEventListener("scroll", rollt, PASSIV);
                if (hatEnde) {
                    band.removeEventListener("scrollend", ruht, PASSIV);
                }
                band.removeEventListener("pointerdown", zeigerRunter, FANG);
                if (opt.frueh) {
                    band.removeEventListener("touchstart", fingerRunter, PASSIV);
                    band.removeEventListener("touchend", fingerHoch, PASSIV);
                    band.removeEventListener("touchcancel", fingerHoch, PASSIV);
                }
                if (opt.maus) {
                    band.removeEventListener("pointermove", zeigerBewegt, false);
                    band.removeEventListener("pointerup", zeigerHoch, PASSIV);
                    band.removeEventListener("pointercancel", zeigerAbbruch, PASSIV);
                    band.removeEventListener("click", klick, true);
                }
                if (beobachter) {
                    beobachter.disconnect();
                } else if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
                    window.removeEventListener("resize", groesse);
                }
                if (waechter) {
                    waechter.disconnect();
                }
                band.classList.remove("up-band-zieht");
                band.classList.remove("up-band-gesperrt");
                for (const el of elemente()) {
                    el.inert = false;
                }
            }
        };
    }

    const UPCREW_WISCHEN = { an: an, seiten: seiten, nachbar: nachbar, linksVon: linksVon, stelle: stelle,
        eingerastet: eingerastet, sichtbar: sichtbar, tempo: tempo, mausZiel: mausZiel, sperrGrund: sperrGrund,
        SPIEL_PX: SPIEL_PX, MAUS_ANTEIL: MAUS_ANTEIL, MAUS_FLOTT_PX_MS: MAUS_FLOTT_PX_MS,
        MAUS_FLOTT_MIN_PX: MAUS_FLOTT_MIN_PX, TEMPO_FENSTER_MS: TEMPO_FENSTER_MS };
    globalThis.UPCREW_WISCHEN = UPCREW_WISCHEN;
    if (typeof module !== "undefined" && module.exports) {
        module.exports = UPCREW_WISCHEN;
    }
})();
