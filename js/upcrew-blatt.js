/*
 * upcrew-blatt.js — Blätter und Karten über dem sichtbaren Hauptmenü, gleich in allen UPCrew-Spielen
 * (gehört zu css/upcrew-blatt.css). Entstanden in Blunderluck v0.156.0
 * (Entwurf Oberfläche Runde 7, vom Nutzer abgenommen).
 *
 * Nutzer, 28.09.2026: „in beiden spielen soll es keine menüs geben in dem sinn das der ganze screen bedeckt ist dafür
 * soll alles was nicht im spiel ist popups sein welche im hintergrund noch das hauptmenü zeigt außer im spiel selbst
 * das soll ein anderer screen sein“.
 *
 *   BLATT  gross: beginnt unter dem Kopf der App (`--up-bl-oben`), endet über der Leiste (`--up-bl-unten`); das
 *          Hauptmenü rückt dahinter etwas kleiner und dunkler (`up-bl-dahinter` am Hauptelement). Blätter stapeln sich
 *          (Profil → Einstellungen → Verwaltung): das oberste trägt einen Zurück-Pfeil, das unterste ein ✕.
 *   KARTE  klein, mittig (Flamme, Hinweis, Kauf). Liegt über allem, auch über Blättern.
 *
 * Schliessen: ✕ / Zurück, Tipp auf den abgedunkelten Grund, Esc. Die Leiste der App liegt ÜBER den Blättern und bleibt
 * bedienbar (z-index der App höher als `--up-bl-ebene`).
 * Seit 04.10.2026: Esc übergeht das Blatt, solange ein Dialog des Spiels darüber offen ist (`[aria-modal="true"]`,
 * der nicht Blatt/Karte selbst ist). Fokus: beim Öffnen auf die Fläche (tabindex -1), beim Schliessen zurück zum
 * Auslöser (siehe „Fokus“ unten).
 *
 * SEITE ODER BLATT (Nutzer 29.09.2026, gilt ab Blunderluck v0.157 / Typoluck 0.25): Was IN DER LEISTE steht (Shop,
 * Sammlung, Start, Aufgaben/Herausforderungen, Rangliste), ist eine normale SEITE im Hauptelement — nie ein Blatt.
 * Blätter und Karten NUR für Bereiche ohne Leisten-Knopf: Profil, Einstellungen, Verwaltung, Serien-Karte, Freunde,
 * Verlauf (und kleine Hinweise/Käufe als Karte). Ein Tipp in der Leiste schliesst alle Blätter
 * (`UPCREW_BLATT.alleSchliessen()`) und zeigt die Seite; die App ruft das in ihrem Tab-Wechsel.
 *
 * DIE SEITE STEHT STILL, solange etwas offen ist (29.09.2026, Nutzer: „wenn man scrollt kommt oben wieder die menüs
 * sichtbar“): `html.up-bl-offen` + `body.up-bl-offen` halten das Dokument fest (overflow hidden, kein Überrollen);
 * rollen kann nur der Inhalt des obersten Blatts, ohne Kette auf die Seite. Beim ersten Blatt rollt die Seite dahinter
 * nach OBEN (in der Lücke über dem Blatt steht so immer der Kopf der Seite, nicht irgendein Teil aus ihrer Mitte), beim
 * letzten Schliessen kommt die alte Rollposition zurück. Eine Karte allein lässt die Position stehen.
 * Bis 29.09. setzte der Baustein nur `body.up-bl-offen`, ohne eine Regel dazu — die Seite rollte hinter dem Blatt mit.
 *
 * OBERKANTE GEMESSEN (29.09.2026 abends): Trägt ein Element der Seite `data-up-bl-kopf` (der Kopf des Starts), beginnt
 * das erste Blatt 8 px unter seiner echten Unterkante (gemessen, nachdem die Seite nach oben gerollt ist) — sonst wie
 * bisher bei `--up-bl-oben`. Höchstens bei der Hälfte der Fensterhöhe. Der Wert gilt für den ganzen Stapel.
 *
 * ZURÜCK-TASTE / WISCHGESTE (29.09.2026 abends, Koordination): Mit `einrichten({ verlauf: true })` legt JEDES Blatt und
 * JEDE Karte einen Eintrag in den Browser-Verlauf (history.pushState, der alte Zustand bleibt darin, dazu `upBlatt`).
 * Zurück schliesst dann das oberste (wie = "verlauf") statt die App-Seite zu verlassen. Wird etwas per Knopf/Grund/Esc/
 * Code geschlossen, nimmt der Baustein seinen Eintrag still zurück (history.back nach dem laufenden Zug, das popstate
 * dazu wird überhört; öffnet im selben Zug etwas Neues, übernimmt es den Eintrag per replaceState — `verlaufAbgleichen()`
 * nimmt sofort zurück, z. B. in Tests);
 * „alle“ (Tab-Wechsel) lässt die Einträge stehen — ein späteres Zurück darüber hinweg überspringt sie.
 *   horchen: true (Vorgabe) — der Baustein horcht selbst auf popstate (Blunderluck).
 *   horchen: false — die App hat einen eigenen popstate-Horcher und ruft darin ZUERST `UPCREW_BLATT.beiZurueck(ereignis)`;
 *   liefert das true, war es für den Baustein (Typoluck js\navigation.js). Mit `oeffnen({ verlauf: false })` ohne
 *   Eintrag (z. B. Werkstatt).
 *
 * Aufruf:
 *   UPCREW_BLATT.einrichten({ ebenen: <div>, haupt: <main>, verlauf: true, horchen: true });     // einmal
 *   const b = UPCREW_BLATT.oeffnen({
 *       art: "blatt" | "karte",          // Vorgabe "blatt"
 *       titel: "Profil",
 *       inhalt: element | (el) => {},    // ein fertiges Element (wird beim Schliessen nur abgehängt, nicht zerstört)
 *                                         // oder eine Funktion, die in `el` zeichnet
 *       rechts: [element, …],            // wahlfrei: Knöpfe rechts im Kopf (z. B. Zahnrad)
 *       klasse: "…",                     // wahlfrei: Zusatzklasse am Blatt
 *       beimSchliessen: (wie) => {}      // wahlfrei: wie = "knopf" | "grund" | "esc" | "code" | "alle" | "verlauf"
 *       verlauf: false                   // wahlfrei: dieses ohne Verlaufseintrag
 *   });                                  // → { el, inhalt, schliessen() }
 *   UPCREW_BLATT.schliessen();  UPCREW_BLATT.alleSchliessen();  UPCREW_BLATT.anzahl();  UPCREW_BLATT.blaetter();
 *
 * Kein Spiel-Eigenes hier: Texte, Inhalte und Farben kommen von der App (Farben über die Variablen der Farbwelt).
 */
(function () {
    "use strict";

    const RAUM = "http://www.w3.org/2000/svg";
    const PFADE = {
        zu: "M6 6 L18 18 M18 6 L6 18",
        zurueck: "M15 5 L8 12 L15 19"
    };

    const stapel = [];
    let gemerktY = null;
    let ebenenEl = null;
    let hauptEl = null;
    let horcht = false;
    let mitVerlauf = false;
    let horchtVerlauf = false;
    let stille = 0;
    let letztesEreignis = null;
    let obenPx = null;

    const hatVerlauf = () => typeof history !== "undefined" && history && typeof history.pushState === "function";

    function zeichen(pfad) {
        const svg = document.createElementNS(RAUM, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        const p = document.createElementNS(RAUM, "path");
        p.setAttribute("d", pfad);
        svg.appendChild(p);
        return svg;
    }

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

    function knopf(pfad, name, beiKlick) {
        const k = el("button", "up-bl-kopf-knopf");
        k.type = "button";
        k.setAttribute("aria-label", name);
        k.appendChild(zeichen(pfad));
        k.addEventListener("click", beiKlick);
        return k;
    }

    function blaetter() {
        return stapel.filter((s) => s.art !== "karte").length;
    }

    function hintenSetzen() {
        const an = blaetter() > 0;
        /* Erst die Seite festhalten (rollt beim ersten Blatt nach oben), dann den Kopf messen, dann zurückrücken. */
        seiteHalten(stapel.length > 0, an);
        if (!an) {
            obenPx = null;
        } else if (obenPx === null) {
            obenPx = kopfMessen();
        }
        if (hauptEl && hauptEl.classList) {
            hauptEl.classList.toggle("up-bl-dahinter", an);
        }
    }

    /* Die Unterkante des Kopfs der Seite (`[data-up-bl-kopf]`) + 8 px — oder -1 (dann gilt --up-bl-oben). */
    function kopfMessen() {
        const wurzel = hauptEl || (typeof document !== "undefined" ? document : null);
        if (!wurzel || typeof wurzel.querySelector !== "function" || typeof window === "undefined") {
            return -1;
        }
        const kopf = wurzel.querySelector("[data-up-bl-kopf]");
        if (!kopf || typeof kopf.getBoundingClientRect !== "function") {
            return -1;
        }
        const r = kopf.getBoundingClientRect();
        const hoehe = window.innerHeight || 0;
        if (!(r.height > 0) || !(r.bottom > 0) || (hoehe > 0 && r.bottom > hoehe / 2)) {
            return -1;
        }
        return Math.round(r.bottom + 8);
    }

    function obenSetzen(ebene) {
        if (obenPx !== null && obenPx >= 0 && ebene.style && typeof ebene.style.setProperty === "function") {
            ebene.style.setProperty("--up-bl-oben", obenPx + "px");
        }
    }

    /* ---- Verlauf (Zurück-Taste) ---- */
    function eintragAnlegen(eintrag) {
        if (!mitVerlauf || eintrag.optionen.verlauf === false || !hatVerlauf()) {
            return;
        }
        try {
            const alt = (history.state && typeof history.state === "object") ? history.state : {};
            const neu = Object.assign({}, alt, { upBlatt: stapel.length });
            /* Gerade im selben Zug etwas geschlossen (Karte zu → Pfad/Profil auf): dessen Eintrag weiterverwenden.
               Ein history.back() vor einem pushState nähme sonst den NEUEN Eintrag mit (am Browser gemessen). */
            if (offen > 0) {
                offen--;
                history.replaceState(neu, "");
            } else {
                history.pushState(neu, "");
            }
            eintrag.verlauf = true;
        } catch (fehler) {
            /* file:// o. ä.: dann ohne Zurück-Taste */
        }
    }

    /* Einträge still zurücknehmen — erst nach dem laufenden Zug (siehe oben), oder sofort mit `abgleichen()`. */
    let offen = 0;
    let geplant = false;

    function abgleichen() {
        geplant = false;
        const n = offen;
        offen = 0;
        if (n <= 0 || !hatVerlauf()) {
            return;
        }
        stille++;
        try {
            if (n === 1) {
                history.back();
            } else {
                history.go(-n);
            }
        } catch (fehler) {
            stille--;
        }
    }

    function eintragZuruecknehmen(eintrag, wie) {
        if (!eintrag.verlauf) {
            return;
        }
        eintrag.verlauf = false;
        if (wie === "verlauf" || wie === "alle" || !hatVerlauf()) {
            return;
        }
        offen++;
        if (!geplant) {
            geplant = true;
            setTimeout(abgleichen, 0);
        }
    }

    /* Zurück-Taste: true = für den Baustein (still oder oberstes geschlossen); die App tut dann nichts. */
    function beiZurueck(ereignis) {
        if (ereignis && ereignis === letztesEreignis) {
            return true;
        }
        if (stille > 0) {
            stille--;
            letztesEreignis = ereignis || null;
            return true;
        }
        const oben = stapel[stapel.length - 1];
        if (oben && oben.verlauf) {
            oben.verlauf = false;
            schliessenEintrag(oben, "verlauf");
            letztesEreignis = ereignis || null;
            return true;
        }
        return false;
    }

    /* Eigener Horcher (horchen: true): stehen gebliebene Einträge (nach „alle“) still überspringen. */
    function aufPopstate(ereignis) {
        if (beiZurueck(ereignis)) {
            return;
        }
        const z = ereignis ? ereignis.state : null;
        if (z && typeof z === "object" && typeof z.upBlatt === "number" && stapel.length === 0 && hatVerlauf()) {
            try {
                history.back();
            } catch (fehler) {
                /* nichts */
            }
        }
    }

    function rollen(y) {
        if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
            try {
                window.scrollTo({ top: y, left: 0, behavior: "instant" });
            } catch (fehler) {
                window.scrollTo(0, y);
            }
        }
    }

    /* Die Seite hinter Blättern und Karten festhalten (siehe Kopf „DIE SEITE STEHT STILL“). */
    function seiteHalten(an, nachOben) {
        if (typeof document === "undefined" || !document.documentElement || !document.body) {
            return;
        }
        const wurzel = document.documentElement;
        const war = wurzel.classList.contains("up-bl-offen");
        const y = (typeof window !== "undefined" && window.scrollY) || 0;
        if (an && !war) {
            gemerktY = y;
        }
        if (an && nachOben && y !== 0) {
            rollen(0);
        }
        wurzel.classList.toggle("up-bl-offen", an);
        document.body.classList.toggle("up-bl-offen", an);
        if (!an && war && gemerktY !== null) {
            rollen(gemerktY);
            gemerktY = null;
        }
    }

    /* ---- Fremder Dialog (04.10.2026) ----
       Liegt über dem Blatt ein Dialog des Spiels (`[aria-modal="true"]` oder `dialog[open]`, sichtbar, und NICHT
       die Fläche eines Eintrags hier — die Karte ist selbst modal), gehört Escape ihm: Das Blatt bleibt offen.
       Gemessen wird zu Beginn des Tastendrucks (Horcher in der Einfang-Phase), damit es nicht davon abhängt, ob
       der Horcher des Dialogs vor oder nach dem des Blatts läuft und den Dialog schon abgeräumt hat. */
    function fremderDialogOffen() {
        if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
            return false;
        }
        for (const d of document.querySelectorAll("[aria-modal='true'], dialog[open]")) {
            if (stapel.some((s) => s.flaeche === d)) {
                continue;
            }
            if (!d.getClientRects || d.getClientRects().length > 0) {
                return true;
            }
        }
        return false;
    }

    let escBeimDruck = null;   /* Ereignis, bei dessen Beginn ein fremder Dialog offen war */

    function vorEsc(ereignis) {
        escBeimDruck = (ereignis && ereignis.key === "Escape" && stapel.length > 0 && fremderDialogOffen())
            ? ereignis : null;
    }

    function aufEsc(ereignis) {
        if (ereignis && ereignis.key === "Escape" && stapel.length > 0) {
            if (ereignis === escBeimDruck || fremderDialogOffen()) {
                return;
            }
            schliessen("esc");
        }
    }

    /* ---- Fokus (04.10.2026) ----
       Beim Öffnen geht der Fokus auf die Fläche selbst (tabindex -1, nie auf ein Eingabefeld — am Handy ginge sonst
       die Tastatur auf), es sei denn, der Inhalt hat ihn schon in die Fläche gelegt. Beim Schliessen kehrt er zu dem
       Element zurück, das ihn vorher hatte (gestapelt: zum Vorgänger) — nur wenn es noch im Dokument steht, kein
       Eingabefeld ist und sichtbar ist, und nur wenn der Fokus gerade im Geschlossenen oder nirgends liegt (ein
       Tipp in die Leiste behält ihn). */
    function aktivesElement() {
        return (typeof document !== "undefined" && document.activeElement) || null;
    }

    function fokusSetzen(ziel) {
        if (!ziel || typeof ziel.focus !== "function") {
            return;
        }
        try {
            ziel.focus({ preventScroll: true });
        } catch (fehler) {
            /* nimmt keinen Fokus: dann eben nicht */
        }
    }

    function fokusNehmen(eintrag) {
        const f = eintrag.flaeche;
        const jetzt = aktivesElement();
        if (jetzt && f && typeof f.contains === "function" && f.contains(jetzt)) {
            return;
        }
        if (f && typeof f.setAttribute === "function") {
            f.setAttribute("tabindex", "-1");
        }
        fokusSetzen(f);
    }

    function taugtFuerFokus(ziel) {
        if (!ziel || typeof ziel.focus !== "function" || typeof document === "undefined") {
            return false;
        }
        if (ziel === document.body || ziel === document.documentElement) {
            return false;
        }
        if (typeof document.contains === "function" ? !document.contains(ziel) : !ziel.isConnected) {
            return false;
        }
        const art = String(ziel.tagName || "").toLowerCase();
        if (art === "input" || art === "textarea" || art === "select" || ziel.isContentEditable === true
                || (typeof ziel.closest === "function" && ziel.closest("[contenteditable]:not([contenteditable='false'])"))) {
            return false;
        }
        return !ziel.getClientRects || ziel.getClientRects().length > 0;
    }

    /* VOR dem Abhängen fragen: Liegt der Fokus im Eintrag oder nirgends? */
    function fokusIm(eintrag) {
        const jetzt = aktivesElement();
        return !jetzt || (typeof document !== "undefined" && jetzt === document.body)
            || (!!eintrag.el && typeof eintrag.el.contains === "function" && eintrag.el.contains(jetzt));
    }

    function fokusZurueck(eintrag, warDrin) {
        const ziel = eintrag.vorher;
        eintrag.vorher = null;
        if (warDrin && taugtFuerFokus(ziel)) {
            fokusSetzen(ziel);
        }
    }

    function einrichten(optionen) {
        const o = optionen || {};
        ebenenEl = o.ebenen || null;
        hauptEl = o.haupt || null;
        if (!horcht && typeof document !== "undefined" && document.addEventListener) {
            document.addEventListener("keydown", vorEsc, true);
            document.addEventListener("keydown", aufEsc);
            horcht = true;
        }
        mitVerlauf = o.verlauf === true;
        if (mitVerlauf && o.horchen !== false && !horchtVerlauf && typeof window !== "undefined"
                && typeof window.addEventListener === "function") {
            window.addEventListener("popstate", aufPopstate);
            horchtVerlauf = true;
        }
    }

    function oeffnen(optionen) {
        const o = optionen || {};
        const art = (o.art === "karte") ? "karte" : "blatt";
        const gestapelt = art === "blatt" && blaetter() > 0;

        const ebene = el("div", "up-bl-ebene" + (art === "karte" ? " up-bl-karte-ebene" : "")
            + (gestapelt ? " up-bl-oben-drauf" : ""));
        const grund = el("div", "up-bl-grund");
        grund.addEventListener("click", () => schliessen("grund"));
        ebene.appendChild(grund);

        const flaeche = el("section", (art === "karte" ? "up-bl-karte" : "up-bl-blatt") + (o.klasse ? " " + o.klasse : ""));
        flaeche.setAttribute("role", "dialog");
        /* Nur die KARTE ist modal. Ein Blatt ist ein Bereich wie ein Tab: Die Leiste bleibt bedienbar, und das
           Wischen zwischen den Leisten-Tabs (upcrew-wischen.js sperrt bei aria-modal) geht auch im Blatt. */
        if (art === "karte") {
            flaeche.setAttribute("aria-modal", "true");
        }
        flaeche.setAttribute("aria-label", o.titel || (art === "karte" ? "Hinweis" : "Blatt"));

        let kopf = null;
        if (art === "blatt") {
            kopf = el("div", "up-bl-kopf");
            if (gestapelt) {
                kopf.appendChild(knopf(PFADE.zurueck, "Zurück", () => schliessen("knopf")));
            }
            kopf.appendChild(el("h2", "up-bl-titel", o.titel || ""));
            for (const zusatz of (o.rechts || [])) {
                if (zusatz) {
                    kopf.appendChild(zusatz);
                }
            }
            if (!gestapelt) {
                kopf.appendChild(knopf(PFADE.zu, "Schließen", () => schliessen("knopf")));
            }
            flaeche.appendChild(kopf);
        }

        const inhalt = el("div", art === "karte" ? "up-bl-karte-inhalt" : "up-bl-inhalt");
        flaeche.appendChild(inhalt);
        ebene.appendChild(flaeche);

        const eintrag = { art: art, el: ebene, flaeche: flaeche, inhalt: inhalt, kopf: kopf, optionen: o,
            vorher: aktivesElement() };
        eintrag.schliessen = () => schliessenEintrag(eintrag, "code");
        stapel.push(eintrag);

        if (typeof Element !== "undefined" && o.inhalt instanceof Element) {
            inhalt.appendChild(o.inhalt);
        } else if (o.inhalt && typeof o.inhalt === "object" && o.inhalt.nodeType === 1) {
            inhalt.appendChild(o.inhalt);
        } else if (typeof o.inhalt === "function") {
            o.inhalt(inhalt, eintrag);
        }

        (ebenenEl || document.body).appendChild(ebene);
        hintenSetzen();
        obenSetzen(ebene);
        eintragAnlegen(eintrag);
        fokusNehmen(eintrag);
        return eintrag;
    }

    function schliessenEintrag(eintrag, wie) {
        const stelle = stapel.indexOf(eintrag);
        if (stelle === -1) {
            return;
        }
        stapel.splice(stelle, 1);
        /* Ein mitgegebenes Element nur abhängen (die App zeigt es später wieder, z. B. den Bereich eines Tabs). */
        const mitgegeben = eintrag.optionen.inhalt;
        if (mitgegeben && typeof mitgegeben === "object" && mitgegeben.parentNode === eintrag.inhalt) {
            eintrag.inhalt.removeChild(mitgegeben);
        }
        const fokusWarDrin = fokusIm(eintrag);
        if (eintrag.el && eintrag.el.parentNode) {
            eintrag.el.parentNode.removeChild(eintrag.el);
        }
        hintenSetzen();
        fokusZurueck(eintrag, fokusWarDrin);
        eintragZuruecknehmen(eintrag, wie);
        if (typeof eintrag.optionen.beimSchliessen === "function") {
            eintrag.optionen.beimSchliessen(wie);
        }
    }

    /* Das oberste schliessen. */
    function schliessen(wie) {
        const oben = stapel[stapel.length - 1];
        if (oben) {
            schliessenEintrag(oben, wie || "code");
        }
    }

    /* Alle schliessen — von oben nach unten, jedes mit „alle". */
    function alleSchliessen() {
        while (stapel.length > 0) {
            schliessenEintrag(stapel[stapel.length - 1], "alle");
        }
    }

    function anzahl() {
        return stapel.length;
    }

    /* Das oberste (oder null) — z. B. um darin neu zu zeichnen. */
    function oben() {
        return stapel[stapel.length - 1] || null;
    }

    const UPCREW_BLATT = { einrichten, oeffnen, schliessen, alleSchliessen, anzahl, blaetter, oben, beiZurueck,
        verlaufAbgleichen: abgleichen, _stapel: stapel };
    if (typeof window !== "undefined") {
        window.UPCREW_BLATT = UPCREW_BLATT;
    }
    if (typeof globalThis !== "undefined") {
        globalThis.UPCREW_BLATT = UPCREW_BLATT;
    }
    if (typeof module !== "undefined" && module.exports) {
        module.exports = UPCREW_BLATT;
    }
})();
