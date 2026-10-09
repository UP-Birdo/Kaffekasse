/*
 * upcrew-anpassen.js — der Tab „Anpassen“ (in der Sammlung), gleich in Blunderluck und Typoluck; seit 09.10.2026
 * auch in Kaffekasse (kein Spiel: dort als Blatt unter Einstellungen, `app: "kaffekasse"`, eigene Vorschau-Form,
 * ohne Katalog nur Farbwelt · Schrift · Knöpfe · Darstellung · Sets).
 * Gemeinsamer Baustein: in die Apps KOPIEREN, nie abwandeln.
 *
 * Nutzer, 26.09.2026: „ein Anpassungsbereich, wo die Spieler ihre Belohnungen testen und kombinieren können —
 * ein eigener Tab mit Vorschau, damit Spieler sich austoben können“ … „in beiden Apps“.
 * Nutzer, 03.10.2026: „es soll nicht mehr nach rechts oder links scroll bar sein das hin und her wischen gehört
 * dem tab wechsel“ → Wahl im Entwurf Runde 8: VARIANTE A.
 *
 * VARIANTE A (statt der waagrecht rollenden Regale): oben die VORSCHAU (klebt wie bisher), darunter
 * KATEGORIE-KACHELN im 2er-Raster (angelegtes Stück, Name, n/m, Strich). Ein Tipp öffnet ein BLATT
 * (upcrew-blatt.js; fehlt es, eine eigene Ebene) mit kompakter Vorschau und den Stücken im 3er-Raster — es rollt
 * nur senkrecht. Antippen = Probe (auch Gesperrtes), unten im Blatt „Zurück · Würfel · Übernehmen“. Die Probe
 * bleibt beim Schließen des Blatts stehen; der Balken „Zurück · Übernehmen“ auf der Seite gilt wie bisher für
 * alles. Übernehmen nur mit Freiem, gilt über upcrew-aussehen.js.
 *
 * WELCHE KATEGORIEN: zuerst die EIGENEN Regale der App (`regale`, wie bisher), dann die anlegbaren Arten des
 * Katalogs (upcrew-katalog.js) für dieses Spiel, dann „Darstellung“ und „Sets“. Passt der Schlüssel eines eigenen
 * Regals auf eine Katalog-Art (ihr `schluessel` oder ihr `regal`, z. B. Blunderluck "thema" → Art "brett3d"),
 * kommt die Liste der Stücke aus dem Katalog; die App liefert dazu Wert, Bild, frei/ab und `uebernehmen` wie
 * bisher. Arten, die das Spiel noch nicht anwenden kann, stehen als „bald“ da (ansehen ja, wählen nein).
 *
 * Die App liefert nur den Platz und ihren Stand (Aufruf wie bisher):
 *     const tab = UPCREW_ANPASSEN.zeigen(ort, {
 *         app: "typoluck",                 // das Spiel (Katalog-Auswahl) und was die Vorschau zuerst zeigt
 *         stufe: 4,                        // erreichtes Level — wirkt wie bisher über STUFEN, wird nie angezeigt
 *         alleFrei: false,                 // z. B. Werkstatt-Modus
 *         besitz(art, wert) {…},           // optional: true = besessen (im Shop gekauft) → frei.
 *                                          //  Passend: UPCREW_BESITZ.haken(() => besitz). `art` ist der
 *                                          //  Katalog-Schlüssel (auch bei eigenen Regalen: "brett3d", nicht "thema")
 *         shop: false,                     // optional: false = das Spiel hat den Shop mit Besitz noch nicht —
 *                                          //  gesperrte Stücke tragen dann „wird erspielt“ statt „im Shop“
 *                                          //  (bis dahin ist Erspielen der einzige Weg)
 *         zumShop({ art, wert }) {…},      // optional (NEU 04.10.2026): der Weg in den Shop, siehe unten
 *         sets: { lesen() {…}, schreiben(liste) {…} },  // optional; Standard: Gerät
 *         regale: [ … ],                   // optional: EIGENE Regale nur dieser App (siehe unten)
 *         vorschau(el, entwurf, app) {…}   // optional: eigene Vorschau nach dem Zeichnen (auch im Blatt)
 *     });
 *
 * Eigene Regale (z. B. Blunderluck „Brett“: 2D/3D):
 *     { schluessel: "brett", titel: "Brett", wert: "2d",            // was die App gerade hat
 *       stuecke: [ { wert: "2d", name: "2D" }, { wert: "3d", name: "3D", frei: false, ab: "Holzhalle", bild: "…" } ],
 *       uebernehmen(wert) { … } }                                    // die App speichert selbst
 * Der Wert landet im Entwurf unter entwurf.extra[schluessel] (der Schlüssel DES SPIELS, wie bisher).
 *
 *     tab.stufeSetzen(5);  tab.alleFreiSetzen(true);  tab.neuZeichnen();  tab.entfernen();        // wie bisher
 *     tab.zaehlen()                 → { hat, alle } über alle Sammel-Kategorien (für „NN %“)        // NEU
 *     tab.blattOeffnen("schrift");  tab.blattSchliessen();  tab.kategorien()                       // NEU
 *
 * Freischalten (unverändert): frei ist, was `alleFrei`, `besitz(art, wert)` oder STUFEN[art][wert] <= stufe
 * durchlässt; `UPCREW_ANPASSEN.frei(art, wert, stufe, besitz)` rechnet dasselbe für die App. Bei eigenen Regalen
 * zusätzlich, was die App mit `frei !== false` meldet. Die Oberfläche nennt KEIN Level mehr: Gesperrtes zeigt
 * „im Shop“, „wird erspielt“ oder den Text `ab` der App (ein Ort, kein Level). Der WÜRFEL wählt NUR Freies.
 *
 * DER WEG IN DEN SHOP (wahlfrei, seit 04.10.2026): Übergibt das Spiel `zumShop`, zeigt das Blatt für ein Stück
 * zur Probe, das „im Shop“ trägt (kaufbar, wirksam, nicht frei/besessen, kein eigener `ab`-Text), statt des
 * gesperrten „Nicht im Besitz“ den Knopf „Im Shop ansehen“. Ein Tipp schließt das Blatt und ruft
 * `zumShop({ art, wert })` — `art` ist der KATALOG-Schlüssel (wie bei `besitz`: "brett3d", nicht "thema").
 * Ohne `zumShop`, mit `shop: false`, bei „wird erspielt“, „bald“, eigenem `ab` und Besessenem bleibt alles wie
 * bisher. `UPCREW_ANPASSEN.shopWeg(st, opt)` rechnet dieselbe Wahl (rein, für Tests). Ein Spiel verbindet so
 * (der Shop erwartet "stueck:<art>-<wert>" = UPCREW_KATALOG.kennung, ein Paket "paket:<wert>"):
 *     zumShop({ art, wert }) {
 *         tabZeigen("shop");                                   // eigener Tab-Wechsel des Spiels (baut den Shop)
 *         shop.teilSetzen("design");                           // falls der Reiter Vorrat vorn war
 *         shop.oeffnen("stueck:" + art + "-" + wert);          // öffnet das Stück-Blatt mit Preis und „Kaufen“
 *     }
 *
 * Braucht: upcrew-intro.js (WELTEN), upcrew-farbwelten.js, upcrew-aussehen.js, upcrew-platz.js (+ css),
 * upcrew-knoepfe.css, upcrew-anpassen.css, die Crew-Schriften. Wahlfrei: upcrew-katalog.js (ohne ihn nur
 * Farbwelt · Schrift · Knöpfe aus STUFEN), upcrew-blatt.js.
 */
(function () {
  "use strict";

  // Ab welchem LEVEL etwas frei ist. PLATZHALTER — der Nutzer legt sie fest. UNVERÄNDERT gegenüber bausteine\
  // (Runde 8: „Belohnungs-Stufen ruhen“ — die Wirkung bleibt, angezeigt wird das Level nirgends mehr).
  const STUFEN = {
    farbwelt: { grau: 0, werkstatt: 2, studio: 3, feld: 11, tiefsee: 21, gold: 40 },
    schrift: { S1: 0, S4: 2, S2: 3, S3: 5, S5: 7, S6: 8 },
    knoepfe: { K1: 0, K5: 2, K3: 3, K2: 4, K4: 6, K6: 9 },
    darstellung: { geraet: 0, hell: 0, dunkel: 0 },
  };
  const KNOPF_NAMEN = { K1: "Stufe", K2: "Kissen", K3: "Taste", K4: "Stempel", K5: "Kapsel", K6: "Ecke" };
  const DARST_NAMEN = { geraet: "Gerät", hell: "Hell", dunkel: "Dunkel" };
  const TEILE = ["farbwelt", "schrift", "knoepfe", "darstellung"];
  const WUERFEL_TEILE = ["farbwelt", "schrift", "knoepfe"];
  const TEIL_NAMEN = { farbwelt: "Farbwelten", schrift: "Schriften", knoepfe: "Knöpfe" };
  // Welche Apps eine eigene Vorschau-Form haben (`opt.app`); Unbekanntes zeigt Typoluck. Kaffekasse seit 09.10.2026.
  const VORSCHAU_APPS = ["typoluck", "blunderluck", "kaffekasse"];

  /* Frei? alleFrei, Besitz (Shop/Inventar der App) oder Stufe erreicht. Unbekanntes ist gesperrt. */
  function freiRechnen(art, w, stufe, besitz, alleFrei) {
    if (alleFrei) return true;
    if (typeof besitz === "function") { try { if (besitz(art, w)) return true; } catch (e) { /* App-Fehler: nur Stufe */ } }
    const tabelle = STUFEN[art] || {};
    if (!(w in tabelle)) return false;
    return tabelle[w] <= (Number(stufe) || 0);
  }
  /* Der Weg in den Shop (seit 04.10.2026): { art, wert } mit dem KATALOG-Schlüssel der Art, wenn das Spiel
     `zumShop` übergibt, den Shop hat (`shop !== false`) und das Stück kaufbar, wirksam, ohne eigenen Ort-Text (`ab`)
     und (noch) nicht frei ist — genau die Stücke mit dem Band „im Shop“. Sonst null. `st` = Stück mit Stand, wie
     im Blatt: { wert, frei, wirkt, s (Katalog-Stück | null), rs (Stück des eigenen Regals | null) }. Rein. */
  function shopWeg(st, opt) {
    const o = opt || {};
    if (typeof o.zumShop !== "function" || o.shop === false || !st || st.frei || !st.wirkt) return null;
    if (!st.s || st.s.weg !== "kauf" || (st.rs && st.rs.ab)) return null;
    return { art: st.s.art, wert: st.s.wert };
  }
  const SETS_SCHLUESSEL = "upcrew.aussehen-sets";

  /* Die heutigen gezeichneten Zeichen — nur noch als PLATZHALTER der Plätze symbol/schloss und symbol/wuerfel. */
  const SYM = {
    schloss: '<path d="M7 11 V8 A5 5 0 0 1 17 8 V11 M5 11 H19 V20 H5 Z"/>',
    zufall: '<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r=".9"/><circle cx="15" cy="15" r=".9"/><circle cx="15" cy="9" r=".9"/><circle cx="9" cy="15" r=".9"/>',
  };
  const sym = (n) => `<svg class="upa-sym" viewBox="0 0 24 24" aria-hidden="true">${SYM[n]}</svg>`;

  function zeigen(ort, opt) {
    const A = window.UPCREW_AUSSEHEN, F = window.UPCREW_FARBWELTEN, W = window.UPCREW_INTRO.WELTEN;
    const K = window.UPCREW_KATALOG || null, P = window.UPCREW_PLATZ;
    opt = opt || {};
    let stufe = Number(opt.stufe) || 0, vorschauApp = VORSCHAU_APPS.indexOf(opt.app) !== -1 ? opt.app : "typoluck";
    const spiel = vorschauApp;
    const sets = opt.sets || {
      lesen() { try { return JSON.parse(localStorage.getItem(SETS_SCHLUESSEL) || "null") || [null, null, null]; } catch (e) { return [null, null, null]; } },
      schreiben(l) { try { localStorage.setItem(SETS_SCHLUESSEL, JSON.stringify(l)); } catch (e) { /* egal */ } },
    };
    const frei = (art, w) => freiRechnen(art, w, stufe, opt.besitz, opt.alleFrei);
    const besitzt = (art, w) => { try { return typeof opt.besitz === "function" && !!opt.besitz(art, w); } catch (e) { return false; } };
    A.erlaubtSetzen(frei);
    A.WAHL.schrift.forEach(A.schriftLaden);

    const regale = Array.isArray(opt.regale) ? opt.regale : [];
    const regal = (k) => regale.find((r) => r.schluessel === k);
    const stueckVon = (k, w) => { const r = regal(k); return r && r.stuecke.find((s) => s.wert === w); };
    const uebernommen = () => Object.assign(A.lesen(), { extra: regale.reduce((o, r) => (o[r.schluessel] = r.wert, o), {}) });

    let entwurf = uebernommen();
    const gleich = (a, b) => TEILE.every((k) => a[k] === b[k])
      && regale.every((r) => (a.extra || {})[r.schluessel] === (b.extra || {})[r.schluessel]);
    const modusVon = (d) => d === "hell" || d === "dunkel" ? d
      : (matchMedia("(prefers-color-scheme: light)").matches ? "hell" : "dunkel");

    // ---------- Kategorien ----------
    // { k, titel, art (Katalog-Art | null), regal (eigenes Regal | null), teil (über UPCREW_AUSSEHEN), sets, sammeln }
    const katalogArten = K ? K.arten(spiel).filter((a) => a.anlegbar)
      : WUERFEL_TEILE.map((k) => ({ schluessel: k, name: TEIL_NAMEN[k] }));
    const artZuRegal = (r) => katalogArten.find((a) => a.regal === r.schluessel || a.schluessel === r.schluessel) || null;
    const kategorien = regale.map((r) => {
      const art = artZuRegal(r);
      return { k: r.schluessel, titel: r.titel || (art ? art.name : r.schluessel), art, regal: r, sammeln: true };
    });
    for (const a of katalogArten) {
      if (kategorien.some((kat) => kat.art === a)) continue;
      kategorien.push({ k: a.schluessel, titel: a.name, art: a, regal: null, teil: WUERFEL_TEILE.indexOf(a.schluessel) !== -1, sammeln: true });
    }
    kategorien.push({ k: "darstellung", titel: "Darstellung", art: null, regal: null, teil: true, sammeln: false });
    kategorien.push({ k: "sets", titel: "Sets", art: null, regal: null, sets: true, sammeln: false });
    const kategorie = (k) => kategorien.find((kat) => kat.k === k);

    /* Die Stücke einer Kategorie mit dem Stand von JETZT:
       { wert, name, frei, wirkt, band, s (Katalog-Stück | null), rs (Stück des eigenen Regals | null) } */
    function stueckeVon(kat) {
      if (kat.sets) return [];
      if (kat.k === "darstellung") {
        return Object.keys(STUFEN.darstellung).map((d) => ({ wert: d, name: DARST_NAMEN[d], frei: true, wirkt: true, band: "", s: null, rs: null }));
      }
      const ks = (kat.art && K) ? K.stuecke(kat.art.schluessel) : null;
      const liste = [];
      const band = (st) => !st.wirkt ? "bald" : st.frei ? ""
        : (st.rs && st.rs.ab) ? st.rs.ab
        : (st.s && st.s.weg === "kauf") ? (opt.shop === false ? "wird erspielt" : "im Shop") : "wird erspielt";
      if (kat.teil) {
        const werte = ks ? ks.map((s) => s.wert) : Object.keys(STUFEN[kat.k]);
        for (const w of werte) {
          const s = ks ? ks.find((x) => x.wert === w) : null;
          liste.push({ wert: w, s, rs: null,
            name: s ? s.name : (kat.k === "farbwelt" ? W[w].name : kat.k === "schrift" ? "Crew " + w.slice(1) : KNOPF_NAMEN[w]),
            wirkt: (!s || s.wirkt) && A.WAHL[kat.k].indexOf(w) !== -1,
            frei: frei(kat.k, w) });
        }
      } else if (kat.regal) {
        const r = kat.regal;
        for (const s of ks || []) {
          const rs = r.stuecke.find((x) => x.wert === s.wert) || null;
          liste.push({ wert: s.wert, name: rs ? rs.name : s.name, s, rs, wirkt: !!rs && s.wirkt,
            frei: !!rs && (!!opt.alleFrei || rs.frei !== false || besitzt(kat.art.schluessel, s.wert)) });
        }
        for (const rs of r.stuecke) {
          if (liste.some((st) => st.wert === rs.wert)) continue;
          liste.push({ wert: rs.wert, name: rs.name, s: null, rs, wirkt: true, frei: !!opt.alleFrei || rs.frei !== false });
        }
      } else {
        // Katalog-Art, die das Spiel noch nicht liefert: nur geführt
        for (const s of ks || []) {
          liste.push({ wert: s.wert, name: s.name, s, rs: null, wirkt: false,
            frei: s.weg === "start" || besitzt(kat.art.schluessel, s.wert) });
        }
      }
      for (const st of liste) st.band = band(st);
      return liste;
    }
    const wertIn = (kat, quelle) => kat.teil ? quelle[kat.k] : kat.regal ? (quelle.extra || {})[kat.regal.schluessel] : null;

    /* Der Umschalter Typoluck/Blunderluck zeigt das Aussehen im ANDEREN Spiel — nur sinnvoll, wenn beide dasselbe
       Aussehen teilen (UPCREW_AUSSEHEN.GETEILT, seit 27.09.2026 Standard false: jedes Spiel sein eigenes). */
    const geteilt = A.GETEILT !== false;
    ort.classList.add("upa");
    ort.innerHTML = `
      <section class="upa-vorschau-rahmen">
        <div class="upa-leiste">
          ${geteilt ? `<div class="upa-mini-seg" role="group" aria-label="Vorschau">
            <button type="button" data-app="typoluck">Typoluck</button><button type="button" data-app="blunderluck">Blunderluck</button>
          </div>` : ""}
          <span class="upa-hinweis" hidden>${P.html("symbol/schloss", "16x16", { html: sym("schloss") })}<span class="upa-hinweis-text"></span></span>
          <button type="button" class="up-kn up-zweit up-rund upa-zufall" aria-label="Zufall"><i class="up-led"></i>${P.html("symbol/wuerfel", "24x24", { html: sym("zufall") })}</button>
        </div>
        <div class="upa-vorschau"></div>
      </section>
      <div class="upa-kat-raster"><div class="upa-kat-eigen"></div></div>
      <div class="upa-aktion">
        <button type="button" class="up-kn up-zweit upa-zurueck"><i class="up-led"></i><span>Zurück</span></button>
        <button type="button" class="up-kn up-haupt upa-uebernehmen"><i class="up-led"></i><span>Übernehmen</span></button>
      </div>`;
    const $ = (s) => ort.querySelector(s);
    const freieVon = (k) => stueckeVon(kategorie(k)).filter((st) => st.frei && st.wirkt).map((st) => st.wert);

    // ---------- Vorschau ----------
    const kachel = (b, art) => `<span class="upa-kachel ${art}">${b}</span>`;
    function typoluck() {
      const z1 = [["K", "falsch"], ["R", "vorhanden"], ["O", "falsch"], ["N", "richtig"], ["E", "richtig"]];
      const z2 = [["B", "falsch"], ["Ä", "richtig"], ["R", "falsch"], ["T", "vorhanden"], ["E", "richtig"]];
      return `<div class="upa-v-kopf"><b>Heute</b><span>3/6 · 12 480</span></div>
        <div class="upa-brett">${[z1, z2].map((z) => `<div>${z.map(([b, a]) => kachel(b, a)).join("")}</div>`).join("")}
          <div>${kachel("", "leer").repeat(5)}</div></div>
        <div class="upa-v-knoepfe"><button type="button" class="up-kn up-haupt" tabindex="-1"><i class="up-led"></i><span>Tägliches Wort</span></button>
          <button type="button" class="up-kn up-zweit" tabindex="-1"><i class="up-led"></i><span>Frei</span></button></div>
        <div class="upa-tasten">${[..."QWERTZUIOPÜ"].map((t) => `<span>${t}</span>`).join("")}</div>`;
    }
    function blunderluck() {
      const fig = { 0: "s♜", 2: "s♝", 4: "s♚", 11: "s♟", 13: "s♟", 17: "s♞", 21: "w♟", 23: "w♛", 27: "w♞", 30: "w♜", 34: "w♚" };
      let felder = "";
      for (let i = 0; i < 36; i++) {
        const f = fig[i], hell = (Math.floor(i / 6) + i % 6) % 2 === 0;
        felder += `<span class="${hell ? "hell" : "dunkel"}">${f ? `<i class="${f[0] === "w" ? "weiss" : "schwarz"}">${f.slice(1)}</i>` : ""}</span>`;
      }
      const drei = (entwurf.extra || {}).brett === "3d";
      return `<div class="upa-v-kopf"><b>Blunderluck</b><span>${drei ? "3D" : "2D"} · Rang 7</span></div>
        <div class="upa-schach-buehne${drei ? " upa-3d" : ""}"><div class="upa-schach">${felder}</div></div>
        <div class="upa-v-knoepfe"><button type="button" class="up-kn up-haupt" tabindex="-1"><i class="up-led"></i><span>Spielen</span></button>
          <button type="button" class="up-kn up-zweit" tabindex="-1"><i class="up-led"></i><span>Bob</span></button></div>`;
    }
    /* Kaffekasse (kein Spiel, seit 09.10.2026): zwei Produktkarten mit Zähler und „Dran: <Name>“, die EINE
       Hauptaktion „+“. Im Blatt (kompakt) bleibt nur die erste Karte (upcrew-anpassen.css). */
    function kaffekasse() {
      const produkte = [["M", "Milch", "Anna", 12], ["K", "Kaffee", "Ben", 7]];
      return `<div class="upa-v-kopf"><b>Kaffekasse</b><span>Büro · 4</span></div>
        <div class="upa-kasse">${produkte.map(([z, name, wer, anzahl]) => `<div class="upa-produkt"><span class="upa-produkt-bild">${z}</span>
          <span class="upa-produkt-text"><b>${name}</b><small>Dran: ${wer}</small></span><span class="upa-zaehler">${anzahl}</span></div>`).join("")}</div>
        <div class="upa-v-knoepfe"><button type="button" class="up-kn up-haupt" tabindex="-1"><i class="up-led"></i><span>+ Milch</span></button>
          <button type="button" class="up-kn up-zweit" tabindex="-1"><i class="up-led"></i><span>Verlauf</span></button></div>`;
    }
    const FORMEN = { typoluck, blunderluck, kaffekasse };
    /* Eine Vorschau füllen — die klebende auf der Seite und die kompakte im Blatt. */
    function vorschauFuellen(el) {
      const m = modusVon(entwurf.darstellung);
      F.anwenden(entwurf.farbwelt, m, el);
      el.dataset.modus = m;
      el.dataset.knoepfe = entwurf.knoepfe;
      el.style.fontFamily = `"Crew ${entwurf.schrift}", system-ui, sans-serif`;
      el.innerHTML = (FORMEN[vorschauApp] || typoluck)();
      if (typeof opt.vorschau === "function") opt.vorschau(el, entwurf, vorschauApp);
      el.classList.remove("upa-neu"); void el.offsetWidth; el.classList.add("upa-neu");
    }
    /* Was im Entwurf steht und (noch) nicht frei ist. */
    function gesperrte() {
      const liste = [];
      for (const kat of kategorien) {
        const w = wertIn(kat, entwurf);
        if (w === null || w === undefined || kat.k === "darstellung") continue;
        const st = stueckeVon(kat).find((x) => x.wert === w);
        if (st && !st.frei) liste.push(st);
      }
      return liste;
    }
    /* Hinweis, Knöpfe und Würfel — auf der Seite und im Blatt gleich. */
    function aktionSetzen(wurzel, kat) {
      const zu = gesperrte(), fertig = gleich(entwurf, uebernommen());
      const knopf = wurzel.querySelector(".upa-uebernehmen"), zurueck = wurzel.querySelector(".upa-zurueck");
      if (knopf) {
        knopf.disabled = zu.length > 0 || fertig;
        knopf.querySelector("span").textContent = zu.length ? "Nicht im Besitz" : fertig ? "Übernommen" : "Übernehmen";
      }
      if (zurueck) zurueck.disabled = fertig;
      // Weg in den Shop (nur im Blatt, nur mit opt.zumShop): steht dort ein kaufbares Stück dieser Kategorie zur
      // Probe, ersetzt „Im Shop ansehen“ den gesperrten Knopf „Nicht im Besitz“.
      const shopKnopf = kat ? wurzel.querySelector(".upa-zumshop") : null;
      if (shopKnopf) {
        const w = wertIn(kat, entwurf);
        const weg = (w === null || w === undefined) ? null : shopWeg(stueckeVon(kat).find((x) => x.wert === w), opt);
        shopKnopf.hidden = !weg;
        shopKnopf.dataset.art = weg ? weg.art : "";
        shopKnopf.dataset.wert = weg ? weg.wert : "";
        if (knopf) knopf.hidden = !!weg;
      }
      // Würfel aus, wenn es nirgends eine Wahl gibt (z. B. neuer Spieler: nur Grau, S1, K1). Er liegt evtl. schon
      // im Balken (upcrew-sammlung wuerfelUnten) — gesucht wird am ganzen Ort.
      const wuerfel = wurzel.querySelector(".upa-zufall");
      if (wuerfel) wuerfel.disabled = kat ? freieVon(kat.k).length < 2 : !WUERFEL_TEILE.some((k) => freieVon(k).length > 1);
    }
    function vorschauZeichnen() {
      vorschauFuellen($(".upa-vorschau"));
      for (const b of ort.querySelectorAll(".upa-mini-seg button")) b.setAttribute("aria-pressed", String(b.dataset.app === vorschauApp));
      const zu = gesperrte(), hinweis = $(".upa-hinweis");
      hinweis.hidden = !zu.length;
      if (zu.length) hinweis.querySelector(".upa-hinweis-text").textContent =zu.length === 1 ? "Probe · nicht im Besitz" : `Probe · ${zu.length} nicht im Besitz`;
      aktionSetzen(ort, null);
    }

    // ---------- Bilder (jedes ein Platz, upcrew-platz.js) ----------
    const BRETT_BILD = {
      "2d": '<span class="upa-brettbild"><i></i><i></i><i></i><i></i></span>',
      "3d": '<span class="upa-brettbild upa-3d"><i></i><i></i><i></i><i></i></span>',
    };
    function bildVon(kat, st) {
      const m = modusVon(entwurf.darstellung);
      if (kat.k === "darstellung") return `<span class="upa-darst ${st.wert}"></span>`;
      const eigen = st.rs ? (st.rs.bild || BRETT_BILD[st.wert] || "") : "";
      if (st.s) return P.stueckHtml(st.s, { modus: m, html: eigen });
      return P.html(`stueck/${kat.k}/${st.wert}`, "96x96", { html: eigen, text: st.name, klasse: "up-platz-stueck" });
    }
    function setBild(s) {
      const f = W[s.farbwelt][modusVon(s.darstellung)];
      return `<span class="upa-set-bild" style="background:${f.bg};font-family:'Crew ${s.schrift}'"><b style="color:${f.ak}">Ag</b></span>`;
    }

    // ---------- Kategorie-Kacheln (2er-Raster) ----------
    function kachelnZeichnen() {
      const jetzt = uebernommen();
      $(".upa-kat-eigen").innerHTML = kategorien.map((kat) => {
        if (kat.sets) {
          const l = sets.lesen(), n = l.filter((s) => s && W[s.farbwelt]).length, erstes = l.find((s) => s && W[s.farbwelt]);
          return `<button type="button" class="upa-kat" data-kat="sets"><span class="upa-kat-bild">${erstes ? setBild(erstes) : P.html("kategorie/sets", "96x96", { text: "Sets" })}</span>
            <span class="upa-kat-text"><b>Sets</b><small>${n}/${l.length} gemerkt</small></span></button>`;
        }
        const liste = stueckeVon(kat), n = liste.filter((st) => st.frei).length;
        const w = wertIn(kat, entwurf), probe = w !== null && w !== wertIn(kat, jetzt);
        const zeigt = liste.find((st) => st.wert === w) || liste.find((st) => st.s && st.s.weg === "start") || liste[0];
        const bald = !liste.some((st) => st.wirkt);
        return `<button type="button" class="upa-kat${bald ? " upa-kat-bald" : ""}${probe ? " upa-kat-probe" : ""}" data-kat="${kat.k}">
          <span class="upa-kat-bild">${zeigt ? bildVon(kat, zeigt) : ""}</span>
          <span class="upa-kat-text"><b>${kat.titel}</b><small>${kat.sammeln ? `${n}/${liste.length}` : (zeigt ? zeigt.name : "")}${probe ? " · Probe" : ""}${bald ? ' <i class="upa-band upa-band-bald">bald</i>' : ""}</small></span>
          ${kat.sammeln ? `<i class="upa-strich"><i style="width:${liste.length ? Math.round(n / liste.length * 100) : 0}%"></i></i>` : ""}</button>`;
      }).join("");
    }

    // ---------- Blatt einer Kategorie (3er-Raster, rollt nur senkrecht) ----------
    let blatt = null;   // { kat, el, eintrag (UPCREW_BLATT) | null, zahl }
    function stueckHtml(kat, st) {
      const jetzt = uebernommen();
      const ziel = kat.teil ? `data-art="${kat.k}"` : kat.regal ? `data-extra="${kat.regal.schluessel}"` : "";
      return `<button type="button" class="upa-stueck${st.frei ? "" : " zu"}${wertIn(kat, jetzt) === st.wert ? " aktiv" : ""}${st.wirkt ? "" : " upa-bald"}" data-kat="${kat.k}" ${ziel} data-wert="${st.wert}" aria-pressed="${wertIn(kat, entwurf) === st.wert}"${st.wirkt ? "" : " disabled"}>
        <span class="upa-bild">${bildVon(kat, st)}</span><span class="upa-name">${st.name}</span>
        ${st.band ? `<span class="upa-band${st.wirkt ? "" : " upa-band-bald"}">${st.band}</span>` : ""}</button>`;
    }
    function setsHtml() {
      return sets.lesen().map((s, i) => {
        if (!s || !W[s.farbwelt]) return `<button type="button" class="upa-stueck upa-set leer" data-set="${i}"><span class="upa-bild">+</span><span class="upa-name">Merken</span></button>`;
        return `<button type="button" class="upa-stueck upa-set" data-set="${i}" aria-pressed="${gleich(s, entwurf)}">
          <span class="upa-bild">${setBild(s)}</span>
          <span class="upa-name">Set ${i + 1}</span><span class="upa-set-weg" data-weg="${i}" role="button" aria-label="Set ${i + 1} leeren">×</span></button>`;
      }).join("");
    }
    function blattZeichnen() {
      if (!blatt) return;
      const kat = blatt.kat, liste = stueckeVon(kat);
      blatt.el.querySelector(".upa-b-koerper").innerHTML = `
        <div class="upa-b-vorschau"><div class="upa-vorschau upa-kompakt"></div></div>
        ${kat.sets ? '<p class="upa-b-text">Ein leerer Platz merkt die Kombination, die gerade in der Vorschau steht.</p>' : ""}
        <div class="upa-raster" data-regal="${kat.k}">${kat.sets ? setsHtml() : liste.map((st) => stueckHtml(kat, st)).join("")}</div>
        <div class="upa-aktion upa-b-aktion">
          <button type="button" class="up-kn up-zweit upa-zurueck"><i class="up-led"></i><span>Zurück</span></button>
          ${kat.sets ? "" : `<button type="button" class="up-kn up-zweit up-rund upa-zufall" data-kat="${kat.k}" aria-label="Zufall"><i class="up-led"></i>${P.html("symbol/wuerfel", "24x24", { html: sym("zufall") })}</button>`}
          <button type="button" class="up-kn up-haupt upa-uebernehmen"><i class="up-led"></i><span>Übernehmen</span></button>
          ${!kat.sets && typeof opt.zumShop === "function" && opt.shop !== false ? '<button type="button" class="up-kn up-haupt upa-zumshop" hidden><i class="up-led"></i><span>Im Shop ansehen</span></button>' : ""}
        </div>`;
      vorschauFuellen(blatt.el.querySelector(".upa-vorschau"));
      aktionSetzen(blatt.el, kat.sets ? null : kat);
      if (blatt.zahl) blatt.zahl.textContent = kat.sammeln ? `${liste.filter((st) => st.frei).length}/${liste.length}` : "";
    }
    function blattSchliessen() {
      if (!blatt) return;
      const b = blatt;
      blatt = null;
      b.el.removeEventListener("click", klick);
      if (b.eintrag) b.eintrag.schliessen(); else if (b.el.parentNode) b.el.parentNode.removeChild(b.el);
    }
    function blattOeffnen(k) {
      const kat = kategorie(k);
      if (!kat) return false;
      blattSchliessen();
      const el = document.createElement("div");
      el.className = "upa upa-blatt";
      el.innerHTML = '<div class="upa-b-koerper"></div>';
      el.addEventListener("click", klick);
      const zahl = document.createElement("span");
      zahl.className = "upa-b-zahl";
      const B = window.UPCREW_BLATT;
      blatt = { kat, el, eintrag: null, zahl };
      if (B && typeof B.oeffnen === "function") {
        blatt.eintrag = B.oeffnen({ titel: kat.titel, klasse: "upa-blatt-huelle", inhalt: el, rechts: [zahl],
          beimSchliessen: () => { if (blatt && blatt.el === el) { blatt = null; el.removeEventListener("click", klick); } } });
      } else {
        // Rückfall ohne upcrew-blatt.js: eigene Ebene über der Seite
        el.classList.add("upa-blatt-eigen");
        const kopf = document.createElement("div");
        kopf.className = "upa-b-kopf";
        kopf.innerHTML = `<h2>${kat.titel}</h2>`;
        kopf.appendChild(zahl);
        const zu = document.createElement("button");
        zu.type = "button"; zu.className = "up-kn up-zweit upa-b-zu"; zu.textContent = "Schließen";
        zu.addEventListener("click", (e) => { e.stopPropagation(); blattSchliessen(); });
        kopf.appendChild(zu);
        el.insertBefore(kopf, el.firstChild);
        ort.appendChild(el);
      }
      blattZeichnen();
      return true;
    }

    const zeichnen = () => { kachelnZeichnen(); vorschauZeichnen(); blattZeichnen(); };

    // ---------- Bedienung (derselbe Horcher am Ort und im Blatt) ----------
    function klick(e) {
      const weg = e.target.closest("[data-weg]");
      if (weg) { const l = sets.lesen(); l[+weg.dataset.weg] = null; sets.schreiben(l); zeichnen(); return; }
      const set = e.target.closest("[data-set]");
      if (set) {
        const l = sets.lesen(), i = +set.dataset.set;
        if (l[i]) {
          // Eigene Regale nur, wenn diese App sie kennt und der Wert gültig ist
          const extra = Object.assign({}, entwurf.extra);
          for (const [k, w] of Object.entries(l[i].extra || {})) if (stueckVon(k, w)) extra[k] = w;
          entwurf = Object.assign({}, entwurf, l[i], { extra });
        } else {
          l[i] = TEILE.reduce((o, k) => (o[k] = entwurf[k], o), { extra: Object.assign({}, entwurf.extra) });
          sets.schreiben(l);
        }
        zeichnen(); return;
      }
      const kat = e.target.closest(".upa-kat[data-kat]");
      if (kat) { blattOeffnen(kat.dataset.kat); return; }
      const st = e.target.closest(".upa-stueck[data-art]");
      if (st) { entwurf[st.dataset.art] = st.dataset.wert; zeichnen(); return; }
      const ex = e.target.closest(".upa-stueck[data-extra]");
      if (ex) {
        entwurf.extra = Object.assign({}, entwurf.extra, { [ex.dataset.extra]: ex.dataset.wert });
        // Brett/Figuren zeigen, wenn man sie antippt (Vorschlag BL v0.157.4: auch "figurart")
        if ((ex.dataset.extra === "brett" || ex.dataset.extra === "figurart") && geteilt) vorschauApp = "blunderluck";
        zeichnen(); return;
      }
      const app = e.target.closest(".upa-mini-seg button");
      if (app) { vorschauApp = app.dataset.app; vorschauZeichnen(); blattZeichnen(); return; }
      const wuerfel = e.target.closest(".upa-zufall");
      if (wuerfel) {
        // Nur Freigeschaltetes/Besessenes (Nutzer 29.09.2026). Bis zu 8 Würfe, damit sich möglichst etwas ändert.
        // Auf der Seite: Farbwelt, Schrift, Knöpfe wie bisher. Im Blatt: nur diese Kategorie.
        const zufall = (l) => l[Math.floor(Math.random() * l.length)];
        const nur = wuerfel.dataset.kat ? kategorie(wuerfel.dataset.kat) : null;
        const welche = nur ? [nur] : WUERFEL_TEILE.map(kategorie);
        const lesen = () => welche.map((x) => wertIn(x, entwurf)).join("|");
        const vorher = lesen();
        for (let wurf = 0; wurf < 8; wurf++) {
          for (const x of welche) {
            const l = freieVon(x.k);
            if (!l.length) continue;
            if (x.teil) entwurf[x.k] = zufall(l);
            else if (x.regal) entwurf.extra = Object.assign({}, entwurf.extra, { [x.regal.schluessel]: zufall(l) });
          }
          if (lesen() !== vorher) break;
        }
        zeichnen(); return;
      }
      const zumShop = e.target.closest(".upa-zumshop");
      if (zumShop) {
        // Blatt zu, dann das Spiel rufen (es wechselt den Tab und öffnet das Stück im Shop). Ohne offenes Blatt
        // (zweiter Horcher derselben Berührung im Rückfall ohne upcrew-blatt.js) nichts mehr tun.
        if (!blatt || zumShop.hidden || !zumShop.dataset.art || typeof opt.zumShop !== "function") return;
        const weg = { art: zumShop.dataset.art, wert: zumShop.dataset.wert };
        blattSchliessen();
        opt.zumShop(weg);
        return;
      }
      if (e.target.closest(".upa-zurueck")) { entwurf = uebernommen(); zeichnen(); return; }
      if (e.target.closest(".upa-uebernehmen")) {
        A.setzen(TEILE.reduce((o, k) => (o[k] = entwurf[k], o), {}));
        for (const r of regale) {
          const w = entwurf.extra[r.schluessel];
          if (w !== r.wert) { r.wert = w; if (typeof r.uebernehmen === "function") r.uebernehmen(w); }
        }
        entwurf = uebernommen();
        zeichnen();
      }
    }
    ort.addEventListener("click", klick);
    const abmelden = A.beobachten((a, quelle) => { if (quelle !== "selbst") zeichnen(); });
    zeichnen();

    return {
      neuZeichnen: zeichnen,
      stufeSetzen(n) { stufe = Number(n) || 0; zeichnen(); },
      alleFreiSetzen(j) { opt.alleFrei = !!j; zeichnen(); },
      entfernen() { blattSchliessen(); ort.removeEventListener("click", klick); abmelden(); ort.innerHTML = ""; ort.classList.remove("upa"); },
      /* „n von m“ über alle Sammel-Kategorien (ohne Darstellung und Sets) — für „NN %“ im Kopf der Sammlung. */
      zaehlen() {
        let hat = 0, alle = 0;
        for (const kat of kategorien) {
          if (!kat.sammeln) continue;
          const liste = stueckeVon(kat);
          hat += liste.filter((st) => st.frei).length; alle += liste.length;
        }
        return { hat, alle };
      },
      kategorien: () => kategorien.map((kat) => kat.k),
      blattOeffnen, blattSchliessen,
      /* Für Probe-Seite und Tests: ein Stück in den Entwurf legen, wie ein Tipp darauf. */
      probieren(k, wert) {
        const kat = kategorie(k);
        if (!kat || !stueckeVon(kat).some((st) => st.wert === wert && st.wirkt)) return false;
        if (kat.teil) entwurf[kat.k] = wert;
        else if (kat.regal) entwurf.extra = Object.assign({}, entwurf.extra, { [kat.regal.schluessel]: wert });
        else return false;
        zeichnen();
        return true;
      },
    };
  }

  window.UPCREW_ANPASSEN = { zeigen, STUFEN, VORSCHAU_APPS, frei: (art, w, stufe, besitz) => freiRechnen(art, w, stufe, besitz, false), shopWeg };
})();
