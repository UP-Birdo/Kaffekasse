/*
 * upcrew-spielerliste.js — die Spielerliste für Admins, gleich in Blunderluck und Typoluck
 * (gehört zu css\upcrew-spielerliste.css). Entstanden in Typoluck 0.16.3 —
 * gemeinsamer Baustein, in die Apps KOPIEREN, nie abwandeln.
 *
 * Nutzer, 27.09.2026: „… in beiden generell eine Spielerliste mit Statistiken und co — aber nur der
 * Admin-Account“. NUR LESEN: keine Knöpfe, die Spieler ändern (Rechte, Umbenennen, Entfernen hat Blunderluck in
 * seiner Verwaltung — die Liste hängt sich daneben ein, sie doppelt nichts).
 *
 * VERTRAG
 *     const zeilen = UPCREW_SPIELERLISTE.zeilen(daten.spieler, {
 *         rolle: (uid) => "AboveAdmin" | "Admin" | "",        // aus KONTO.rolleVon(daten, uid)
 *         level: (stand) => ({ level, xp }),                  // aus dem gemeinsamen Fortschritt der App
 *         serie: (stand) => Zahl,                              // laufende Serie über alle Zweige
 *         abzeichen: (stand) => ({ erreicht, alle })          // z. B. aus UPCREW_ABZEICHEN.liste
 *     });
 *     const liste = UPCREW_SPIELERLISTE.bauen(halter, { zeilen, beiAuswahl: (zeile) => … });
 *     liste.setzen(neueZeilen);                                // nach neuen Daten
 *     DIALOG.hinweis(zeile.name, "", UPCREW_SPIELERLISTE.details(zeile));   // Antippen: beide Spiele
 *
 * Eine Zeile: { uid, id, name, tag, gast, rolle, level, xp, serie, muenzen (null, bis es Münzen gibt),
 *   partien, partienJe: { app: n }, zuletzt (ms oder 0), abzeichen: { erreicht, alle }, spiele: { app: {…} } }
 * Rein rechnen: zeilen, sortieren, filtern. Anzeigen: bauen, details. Alle Texte über textContent,
 * Farben nur aus der Farbwelt.
 */
(function () {
    "use strict";

    const SPIELE_NAMEN = { typoluck: "Typoluck", blunderluck: "Blunderluck" };

    const istObjekt = (w) => !!w && typeof w === "object" && !Array.isArray(w);
    const zahl = (w) => (typeof w === "number" && isFinite(w) && w > 0) ? Math.floor(w) : 0;
    const istDatum = (w) => typeof w === "string" && /^\d{4}-\d{2}-\d{2}$/.test(w);

    function zweigZahlen(zweig) {
        const z = istObjekt(zweig && zweig.zaehler) ? zweig.zaehler : {};
        const tage = Array.isArray(zweig && zweig.tage) ? zweig.tage.filter(istDatum).sort() : [];
        const turm = istObjekt(zweig && zweig.turm) && istObjekt(zweig.turm.figuren) ? zweig.turm.figuren : {};
        const turmFiguren = Object.keys(turm).reduce((s, k) => s + Math.min(3, zahl(turm[k])), 0);
        return {
            xp: zahl(zweig && zweig.xp),
            partien: zahl(zweig && zweig.partien),
            tage: tage.length,
            letzterTag: tage.length ? tage[tage.length - 1] : "",
            tagesaufgaben: zahl(z.tagesaufgaben) || tage.length,
            figuren: zahl(z.figuren) + turmFiguren,
            besteSerie: zahl(z.besteSerie),
            stand: zahl(zweig && zweig.stand)
        };
    }

    /* Wann zuletzt aktiv: der neueste Zeitpunkt eines Zweigs, sonst der letzte geschaffte Tag (Mittag). */
    function zuletztVon(spiele) {
        let ms = 0;
        for (const app of Object.keys(spiele)) {
            const s = spiele[app];
            if (s.stand > 1e12) {
                ms = Math.max(ms, s.stand);
            }
            if (s.letzterTag) {
                const [j, m, t] = s.letzterTag.split("-").map(Number);
                ms = Math.max(ms, Date.UTC(j, m - 1, t, 12));
            }
        }
        return ms;
    }

    function zeile(eintrag, opt) {
        opt = opt || {};
        const stand = istObjekt(eintrag.fortschritt) ? eintrag.fortschritt : { version: 1, spiele: {} };
        const roh = istObjekt(stand.spiele) ? stand.spiele : {};
        const spiele = {};
        for (const app of Object.keys(roh)) {
            if (istObjekt(roh[app])) {
                spiele[app] = zweigZahlen(roh[app]);
            }
        }
        const partienJe = {};
        Object.keys(spiele).forEach((app) => { partienJe[app] = spiele[app].partien; });
        const lv = typeof opt.level === "function" ? opt.level(stand) : null;
        const muenzen = typeof eintrag.muenzen === "number" ? eintrag.muenzen
            : (typeof stand.muenzen === "number" ? stand.muenzen : null);
        return {
            uid: eintrag.uid || "",
            id: eintrag.id || "",
            name: String(eintrag.name || ""),
            tag: String(eintrag.tag || ""),
            gast: eintrag.gast === true,
            rolle: typeof opt.rolle === "function" ? (opt.rolle(eintrag.uid) || "") : "",
            level: lv ? zahl(lv.level) || 1 : 1,
            xp: lv && typeof lv.xp === "number" ? lv.xp
                : Object.keys(spiele).reduce((s, app) => s + spiele[app].xp, 0),
            serie: typeof opt.serie === "function" ? zahl(opt.serie(stand)) : 0,
            muenzen: muenzen,
            partien: Object.keys(partienJe).reduce((s, app) => s + partienJe[app], 0),
            partienJe: partienJe,
            zuletzt: zuletztVon(spiele),
            abzeichen: typeof opt.abzeichen === "function" ? opt.abzeichen(stand) : null,
            spiele: spiele
        };
    }

    function zeilen(spieler, opt) {
        return (Array.isArray(spieler) ? spieler : []).filter(istObjekt).map((e) => zeile(e, opt));
    }

    /* Sortieren: zuletzt | level | serie | partien | name. Absteigend (außer Name), Gleichstand nach Name. */
    const SORTEN = {
        zuletzt: { text: "zuletzt aktiv", wert: (z) => z.zuletzt },
        level: { text: "Level", wert: (z) => z.level * 1e9 + z.xp },
        serie: { text: "Serie", wert: (z) => z.serie },
        partien: { text: "Partien", wert: (z) => z.partien },
        name: { text: "Name", wert: (z) => z.name.toLowerCase() }
    };

    function sortieren(liste, nach) {
        const sorte = SORTEN[nach] || SORTEN.zuletzt;
        const nachName = (a, b) => a.name.localeCompare(b.name, "de") || a.tag.localeCompare(b.tag);
        return liste.slice().sort((a, b) => {
            if (nach === "name") {
                return nachName(a, b);
            }
            return (sorte.wert(b) - sorte.wert(a)) || nachName(a, b);
        });
    }

    /* Filtern: Suche (Name, Name#Nummer), ohne Gäste. */
    function filtern(liste, f) {
        f = f || {};
        const suche = String(f.suche || "").trim().toLowerCase();
        return liste.filter((z) => (!f.ohneGaeste || !z.gast)
            && (!suche || (z.name + "#" + z.tag).toLowerCase().indexOf(suche) !== -1));
    }

    /* ---- Anzeige ---- */

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

    function datum(ms) {
        if (!ms) {
            return "nie";
        }
        const d = new Date(ms);
        return String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + "."
            + String(d.getFullYear()).slice(2);
    }

    function kurzzeile(z) {
        const teile = ["Lv " + z.level, "Serie " + z.serie, z.partien + " Partien", "zuletzt " + datum(z.zuletzt)];
        if (z.muenzen !== null) {
            teile.splice(2, 0, z.muenzen + " Münzen");
        }
        if (z.abzeichen) {
            teile.push("Abzeichen " + z.abzeichen.erreicht + "/" + z.abzeichen.alle);
        }
        return teile.join(" · ");
    }

    function bauen(halter, opt) {
        opt = opt || {};
        let alle = opt.zeilen || [];
        const zustand = { suche: "", ohneGaeste: true, nach: "zuletzt" };
        const wurzel = el("div", "up-sl");

        const leiste = el("div", "up-sl-leiste");
        const suche = el("input", "up-sl-suche");
        suche.type = "search";
        suche.placeholder = "Name oder Name#Nummer";
        suche.setAttribute("aria-label", "Spieler suchen");
        suche.autocomplete = "off";
        const sorte = el("select", "up-sl-sorte");
        sorte.setAttribute("aria-label", "Sortieren nach");
        for (const k of Object.keys(SORTEN)) {
            const o = el("option", null, SORTEN[k].text);
            o.value = k;
            sorte.appendChild(o);
        }
        const gaeste = el("label", "up-sl-gaeste");
        const kasten = el("input");
        kasten.type = "checkbox";
        kasten.checked = true;
        gaeste.appendChild(kasten);
        gaeste.appendChild(document.createTextNode(" ohne Gäste"));
        leiste.appendChild(suche);
        leiste.appendChild(sorte);
        leiste.appendChild(gaeste);
        wurzel.appendChild(leiste);

        const zahl = el("p", "up-sl-zahl");
        wurzel.appendChild(zahl);
        const liste = el("ul", "up-sl-liste");
        wurzel.appendChild(liste);

        function zeichnen() {
            const sichtbar = sortieren(filtern(alle, zustand), zustand.nach);
            zahl.textContent = sichtbar.length + " von " + alle.length + " Spielern";
            liste.textContent = "";
            for (const z of sichtbar) {
                const li = el("li");
                const knopf = el("button", "up-sl-zeile");
                knopf.type = "button";
                const kopf = el("span", "up-sl-kopf");
                kopf.appendChild(el("span", "up-sl-name", z.name));
                if (z.tag) {
                    kopf.appendChild(el("span", "up-sl-tag", "#" + z.tag));
                }
                if (z.rolle) {
                    kopf.appendChild(el("span", "up-sl-marke up-sl-rolle", z.rolle));
                }
                if (z.gast) {
                    kopf.appendChild(el("span", "up-sl-marke", "Gast"));
                }
                knopf.appendChild(kopf);
                knopf.appendChild(el("span", "up-sl-werte", kurzzeile(z)));
                if (typeof opt.beiAuswahl === "function") {
                    knopf.addEventListener("click", () => opt.beiAuswahl(z));
                }
                li.appendChild(knopf);
                liste.appendChild(li);
            }
        }

        suche.addEventListener("input", () => { zustand.suche = suche.value; zeichnen(); });
        sorte.addEventListener("change", () => { zustand.nach = sorte.value; zeichnen(); });
        kasten.addEventListener("change", () => { zustand.ohneGaeste = kasten.checked; zeichnen(); });

        if (halter) {
            halter.appendChild(wurzel);
        }
        zeichnen();
        return {
            el: wurzel,
            setzen(neu) {
                alle = neu || [];
                zeichnen();
            }
        };
    }

    /* Die Details zu einer Zeile: Überblick, dann je Spiel die Zahlen. */
    function details(z) {
        const box = el("div", "up-sl-details");
        const ueber = el("dl", "up-sl-werteliste");
        const paar = (titel, wert) => {
            ueber.appendChild(el("dt", null, titel));
            ueber.appendChild(el("dd", null, wert));
        };
        paar("Nummer", (z.tag ? "#" + z.tag : "—") + (z.gast ? " · Gast" : ""));
        if (z.rolle) {
            paar("Rolle", z.rolle);
        }
        paar("Level", z.level + " · " + z.xp + " XP");
        paar("Serie", z.serie + (z.serie === 1 ? " Tag" : " Tage"));
        paar("Münzen", z.muenzen === null ? "—" : String(z.muenzen));
        if (z.abzeichen) {
            paar("Abzeichen", z.abzeichen.erreicht + " von " + z.abzeichen.alle);
        }
        paar("Zuletzt aktiv", datum(z.zuletzt));
        box.appendChild(ueber);
        const apps = Object.keys(z.spiele).sort();
        if (!apps.length) {
            box.appendChild(el("p", "up-sl-leer", "Noch in keinem Spiel gespielt"));
        }
        for (const app of apps) {
            const s = z.spiele[app];
            box.appendChild(el("h3", "up-sl-spiel", SPIELE_NAMEN[app] || app));
            const dl = el("dl", "up-sl-werteliste");
            const zeilePaar = (titel, wert) => {
                dl.appendChild(el("dt", null, titel));
                dl.appendChild(el("dd", null, wert));
            };
            zeilePaar("Partien", String(s.partien));
            zeilePaar("XP", String(s.xp));
            zeilePaar("Tagesaufgaben", String(s.tagesaufgaben));
            zeilePaar("Figuren", String(s.figuren));
            zeilePaar("Beste Serie", String(s.besteSerie));
            zeilePaar("Letzter Tag", s.letzterTag ? s.letzterTag.slice(8) + "." + s.letzterTag.slice(5, 7) + "." : "—");
            box.appendChild(dl);
        }
        return box;
    }

    const UPCREW_SPIELERLISTE = { zeilen: zeilen, zeile: zeile, sortieren: sortieren, filtern: filtern,
        SORTEN: SORTEN, bauen: bauen, details: details, kurzzeile: kurzzeile };
    globalThis.UPCREW_SPIELERLISTE = UPCREW_SPIELERLISTE;
    if (typeof module !== "undefined" && module.exports) {
        module.exports = UPCREW_SPIELERLISTE;
    }
})();
