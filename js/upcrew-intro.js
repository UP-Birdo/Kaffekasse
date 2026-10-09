/* UPCrew-Studio-Intro — gemeinsamer Baustein fuer Blunderluck, Typoluck und Trainer.
   Gemeinsamer Baustein.
   In die Apps KOPIEREN, nicht dort abwandeln - Aenderungen hier machen und neu verteilen.

   - Bei jedem Start die naechste von sechs Arten (A-F); EIN Zaehler fuer alle Apps (localStorage, gleicher Ursprung).
   - Farbwelt rotiert nie: gewaehlte Welt aus Option oder localStorage, sonst "werkstatt" (Trainer; Blunderluck und
     Typoluck geben ihre Welt aus UPCREW_AUSSEHEN mit, Standard dort seit 29.09.2026c "grau").
   - Immer dunkel UND hell; die App sagt, welche Fassung gilt.
   - Kein Netz, keine fremde Schrift, kein Inline-Skript (Blunderluck-CSP); nur style-Attribute.
   - Tippen oder Taste ueberspringt; "Bewegung reduzieren" zeigt kurz das Endbild.

   Nutzung:  UPCREW_INTRO.zeigen(behaelter, { modus: "dunkel" | "hell",
                                             app: { nr: "01", name: "Blunderluck", version: "0.140.2" } })
             -> Promise, erfuellt nach dem Ausblenden mit { art, welt, modus }.

   WER SPIELT (seit 04.10.2026, Runde 10 Teil 3; Einbau: EINBAU-INTRO-WER-SPIELT.md):
             UPCREW_INTRO.zeigen(behaelter, { ..., werSpielt: versprechen })
   Mit `werSpielt` (ein Promise des Spiels, z. B. UPCREW_WER_SPIELT.starten(...)) endet das Intro erst, wenn die
   Animation fertig ist (oder uebersprungen wurde) UND das Versprechen erfuellt/abgelehnt ist - spaetestens aber
   zur FRIST = Laenge der Animation + WARTEN_MS ab Beginn. Dann erfuellt es mit { art, welt, modus, wer, frist }:
   `wer` = Wert des Versprechens (null bei Ablehnung oder Frist), `frist` = true, wenn die Frist entschieden hat.
   Reicht die Zeit nicht, bleibt der letzte Bild-Stand der Animation stehen (alle Animationen halten ihr Endbild,
   `both`) - kein Spinner, kein Neustart. Waehrend des Wartens traegt der Behaelter nur die Klasse `upi-wartet` und
   aria-busy="true" (keine Grafik). Ohne `werSpielt` (Trainer) alles wie bisher. Endet in jedem Fall genau einmal.
   SPIEL-INTRO (Nutzer 04.10.2026, 13:50: "spaeter noch ein intro fuer das jeweilige spiel ... nach dem studio
   intro"): `danach: (behaelter, ergebnis) => Promise` laeuft nach dem Ausblenden; erst wenn es fertig ist (oder
   scheitert), erfuellt zeigen(). Heute uebergibt kein Spiel etwas - kein sichtbarer Unterschied. */
(function () {
  "use strict";

  const SCHLUESSEL_ZAEHLER = "upcrew.intro-zaehler";
  const SCHLUESSEL_WELT = "upcrew.farbwelt";
  const HALTEN_MS = 700, AUSBLENDEN_MS = 400, RUHIG_MS = 1200;
  // Frist fuer "wer spielt": so lange wartet das Intro hoechstens NACH seiner Animation auf das Versprechen des
  // Spiels. Annahme der Koordination 04.10.2026 (offen beim Nutzer) - EINE Zahl, nur hier. Laengste Art (B) mit
  // Frist und Ausblenden: rund 8,8 s, also vor dem Notfall-Weg der Spiele (10 s; tests\test-intro-wer-spielt.js).
  const WARTEN_MS = 3000;
  const MONO = 'ui-monospace, "Cascadia Mono", Consolas, Menlo, monospace';
  const ARTEN = ["A", "B", "C", "D", "E", "F"];

  // ---------- Farbwelten: 7 Bausteine je dunkel und hell ----------
  // bg Grund, fl Flaeche, ta Taste, ink Schrift, lei Leise, ak Akzent, lcd Anzeige
  const WELTEN = {
    // Grau (seit 29.09.2026c): Schwarz · Weiss · Grau, Start-Farbwelt fuer neue Spieler (Level 0) in beiden Spielen.
    // Vorlage: entwuerfe\Sammlung-Neu (graustufe). Akzent dunkel = fast weiss, hell = fast schwarz.
    grau: { name: "Grau",
      dunkel: { bg: "#141414", fl: "#222222", ta: "#3c3c3c", ink: "#f2f2f2", lei: "#9c9c9c", ak: "#ececec", lcd: "#0b0b0b" },
      hell:   { bg: "#e2e2e2", fl: "#f8f8f8", ta: "#c8c8c8", ink: "#141414", lei: "#666666", ak: "#1d1d1d", lcd: "#222222" } },
    werkstatt: { name: "Werkstatt",
      dunkel: { bg: "#17181a", fl: "#232427", ta: "#3b3c3f", ink: "#eeebe4", lei: "#8f8c85", ak: "#ff6a2b", lcd: "#0c0d0e" },
      hell:   { bg: "#e6e3dc", fl: "#f5f3ee", ta: "#cdcac2", ink: "#1d1e20", lei: "#76736c", ak: "#ff5b1f", lcd: "#26272a" } },
    studio: { name: "Studio",   // das bisherige UPCrew-Violett
      dunkel: { bg: "#120e1c", fl: "#1d1729", ta: "#342b47", ink: "#efeaf8", lei: "#9189a3", ak: "#7a5cf0", lcd: "#0a0812" },
      hell:   { bg: "#e9e5f0", fl: "#f7f5fa", ta: "#d2cbe0", ink: "#1c1729", lei: "#736b84", ak: "#6a4be6", lcd: "#221c30" } },
    feld: { name: "Feld",
      dunkel: { bg: "#121714", fl: "#1c231f", ta: "#324038", ink: "#e9efe9", lei: "#86938a", ak: "#39c178", lcd: "#0a0d0b" },
      hell:   { bg: "#e2e7e1", fl: "#f3f6f2", ta: "#c7d0c5", ink: "#17201b", lei: "#6d786f", ak: "#1f9c5a", lcd: "#1f2822" } },
    tiefsee: { name: "Tiefsee",
      dunkel: { bg: "#0f1420", fl: "#18202f", ta: "#2c3a52", ink: "#e8eef8", lei: "#8490a5", ak: "#4d86ff", lcd: "#080b12" },
      hell:   { bg: "#e1e6ee", fl: "#f3f6fa", ta: "#c5cedc", ink: "#141b29", lei: "#6a7488", ak: "#2f68e8", lcd: "#1b2230" } },
    gold: { name: "Gold",
      dunkel: { bg: "#1a1712", fl: "#25211a", ta: "#403828", ink: "#f4efe3", lei: "#9a9180", ak: "#f0b43a", lcd: "#0e0c09" },
      hell:   { bg: "#ede5d4", fl: "#faf6ec", ta: "#d9cdb2", ink: "#221d13", lei: "#7c735f", ak: "#c98a12", lcd: "#2a2418" } },
  };

  // ---------- Speicher (darf fehlen: privates Fenster, gesperrt) ----------
  const lies = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const schreib = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ohne Speicher: immer Art A */ } };
  function naechsteArt() {
    const alt = parseInt(lies(SCHLUESSEL_ZAEHLER), 10);
    const n = Number.isFinite(alt) && alt >= 0 ? alt + 1 : 0;
    schreib(SCHLUESSEL_ZAEHLER, String(n));
    return ARTEN[n % ARTEN.length];
  }

  // ---------- Buchstaben: feste Strich-Geometrie ----------
  const Z = {
    U: x => `M${x+11} 61 V120 A19 19 0 0 0 ${x+49} 120 V61`,
    P: x => `M${x+11} 139 V61 H${x+30} A20 20 0 0 1 ${x+30} 101 H${x+11}`,
    C: x => `M${x+49} 61 H${x+30} A19 19 0 0 0 ${x+11} 80 V120 A19 19 0 0 0 ${x+30} 139 H${x+49}`,
    R: x => `M${x+11} 139 V61 H${x+30} A20 20 0 0 1 ${x+30} 101 H${x+11} M${x+30} 101 L${x+50} 139`,
    E: x => `M${x+49} 61 H${x+11} V139 H${x+49} M${x+11} 100 H${x+40}`,
    W: x => `M${x+11} 61 L${x+23} 139 L${x+36} 92 L${x+49} 139 L${x+61} 61`,
  };
  const WORT = [["U", 10], ["P", 88], ["C", 190], ["R", 268], ["E", 346], ["W", 424]];
  const strich = (d, farbe, b = 22) => `<path d="${d}" fill="none" stroke="${farbe}" stroke-width="${b}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const mono = (x, y, t, farbe, gr = 10, anker = "start") =>
    `<text x="${x}" y="${y}" font-family='${MONO}' font-size="${gr}" fill="${farbe}" text-anchor="${anker}">${t}</text>`;
  const mische = (a, b, t) => "#" + [1, 3, 5].map(i => Math.round(parseInt(a.substr(i, 2), 16) * (1 - t) + parseInt(b.substr(i, 2), 16) * t)
    .toString(16).padStart(2, "0")).join("");
  const text = s => String(s).replace(/[&<>"]/g, z => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[z]);

  let zaehler = 0;
  // Buchstaben, die einzeln erscheinen; tiefe = Retro-Schichten dahinter (je 5 nach rechts unten, hinterste zuerst)
  function buchstaben(ink, zeichen, t0, tiefe = []) {
    return WORT.filter(([z]) => zeichen.includes(z)).map(([z, x], i) => {
      const hinten = tiefe.map((farbe, j) => [j + 1, farbe]).reverse()
        .map(([k, farbe]) => `<g transform="translate(${k * 5} ${k * 5})">${strich(Z[z](x), farbe)}</g>`).join("");
      return `<g class="upi-bu" style="--t0:${t0}s;--i:${i}">${hinten}${strich(Z[z](x), ink)}</g>`;
    }).join("");
  }
  const marke = (vb, innen, vorher = "", nachher = "") =>
    `<svg viewBox="${vb}" aria-hidden="true" focusable="false">${vorher}<g>${innen}</g>${nachher}</svg>`;

  // ---------- A: Segment-Anzeige ----------
  const SEG = { U: "bcdef", P: "abefg" };
  function segment(ch, x, y, w, h, t, farbe) {
    const r = t / 2, lang = w - 1.3 * t, halb = h / 2 - 1.1 * t;
    const teile = {
      a: [x + .65 * t, y, lang, t], g: [x + .65 * t, y + h / 2 - r, lang, t], d: [x + .65 * t, y + h - t, lang, t],
      f: [x, y + .6 * t, t, halb], b: [x + w - t, y + .6 * t, t, halb],
      e: [x, y + h / 2 + .5 * t, t, halb], c: [x + w - t, y + h / 2 + .5 * t, t, halb],
    };
    let i = 0;
    return Object.entries(teile).map(([k, [sx, sy, sw, sh]]) => {
      const ein = SEG[ch].includes(k);
      return `<rect ${ein ? `class="upi-seg" style="--i:${i++}"` : 'opacity=".06"'} x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="${r}" fill="${farbe}"/>`;
    }).join("");
  }
  const lcd = (f, x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">
      <rect width="120" height="84" rx="12" fill="${f.lcd}"/>
      ${segment("U", 18, 14, 36, 56, 8, f.ak)}${segment("P", 66, 14, 36, 56, 8, f.ak)}
      ${mono(108, 78, "lvl", f.ak, 7, "end").replace("<text", '<text opacity=".7"')}</g>`;

  // ---------- B: Taste ----------
  function taste(f, cx, cy, s, t0, kreuz = f.lcd) {
    const a = s * .3;
    return `<g class="upi-taste" style="--t0:${t0}s"><rect x="${cx - s / 2}" y="${cy - s / 2 + 5}" width="${s}" height="${s}" rx="${s * .18}" fill="${f.ta}"/>
      <rect x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" rx="${s * .18}" fill="${f.ak}"/>
      <path d="M${cx} ${cy - a} V${cy + a} M${cx - a} ${cy} H${cx + a}" stroke="${kreuz}" stroke-width="${s * .14}" stroke-linecap="round"/></g>`;
  }

  // ---------- C: Pad-Raster 3 x 4, Pfeil nach oben ----------
  const PFEIL = [".x.", "xxx", ".x.", ".x."];
  function pads(f, x, y, g, abst, t0) {
    let out = "", n = 0;
    for (let r = PFEIL.length - 1; r >= 0; r--) for (let c = 0; c < 3; c++) {   // von unten nach oben aufleuchten
      const an = PFEIL[r][c] === "x";
      out += `<rect x="${x + c * (g + abst)}" y="${y + r * (g + abst)}" width="${g}" height="${g}" rx="${g * .22}" fill="${an ? f.ak : f.ta}"
        ${an ? `class="upi-pad" style="--t0:${t0}s;--i:${n++};--aus:${f.ta};--an:${f.ak}"` : ""}/>`;
    }
    return out;
  }

  // ---------- Plus -> P (Werte wie GESTALTUNG.md Abschnitt 6) ----------
  const K = 0.5523, PX = 88;
  const PLUS  = x => `M ${x+30} 139 V 61 M ${x-9} 100 H ${x+30} C ${x+43} 100 ${x+56} 100 ${x+69} 100 C ${x+69} 100 ${x+69} 100 ${x+69} 100 H ${x+69}`;
  const P1    = x => `M ${x+11} 139 V 61 M ${x+11} 61 H ${x+30} C ${x+30+K*20} 61 ${x+50} ${81-K*20} ${x+50} 81 C ${x+50} ${81+K*20} ${x+30+K*20} 101 ${x+30} 101 H ${x+11}`;
  const PLUS2 = x => `M ${x+30} 139 V 61 M ${x-9} 100 H ${x+30} M ${x+30} 100 H ${x+30} C ${x+43} 100 ${x+56} 100 ${x+69} 100 C ${x+69} 100 ${x+69} 100 ${x+69} 100 H ${x+69}`;
  const P2    = x => `M ${x+11} 139 V 61 M ${x+11} 100 H ${x+11} M ${x+11} 61 H ${x+30} C ${x+30+K*20} 61 ${x+50} ${81-K*20} ${x+50} 81 C ${x+50} ${81+K*20} ${x+30+K*20} 101 ${x+30} 101 H ${x+11}`;
  const WIRBEL  = { k: "wirbel",  dauer: 1500, von: PLUS2, zu: P2 };
  const KLAPPEN = { k: "klappen", dauer: 850,  von: PLUS,  zu: P1 };

  // Plus mit Schichten: oben Akzent (Satz "aus") ueber derselben Form in Schriftfarbe (Satz "ein")
  function plusP(akzent, ink, ue, t0, tiefe = [], sofort = false) {
    const p = (satz, farbe, k) => `<path data-satz="${satz}" data-k="${k}" d="${ue.von(PX)}" fill="none" stroke="${farbe}" stroke-width="22"
      stroke-linecap="round" stroke-linejoin="round" ${satz === "ein" ? 'opacity="0"' : ""}/>`;
    const hinten = tiefe.map((farbe, i) => [i + 1, farbe]).reverse()
      .map(([k, farbe]) => `<g transform="translate(${k * 5} ${k * 5})">${p("nur", farbe, k)}</g>`).join("");
    return `<g class="upi-pp${sofort ? "" : " upi-ein"}" style="--t0:${t0 - .3}s" data-t0="${t0 * 1000}" data-ue="${ue.k}">
      <g class="upi-pp-form">${hinten}${p("aus", akzent, 0)}${p("ein", ink, 0)}</g></g>`;
  }

  // Startet alle Plus->P-Gruppen (Web Animations); endet exakt auf dem P
  function plusLauf(c, ruhig) {
    c.querySelectorAll(".upi-pp").forEach(g => {
      const ue = g.dataset.ue === "wirbel" ? WIRBEL : KLAPPEN, start = +g.dataset.t0;
      const pfade = [...g.querySelectorAll("path")];
      const aus = [...g.querySelectorAll('[data-satz="aus"]')], ein = [...g.querySelectorAll('[data-satz="ein"]')];
      if (ruhig || !pfade[0].animate) {
        pfade.forEach(p => p.setAttribute("d", ue.zu(PX)));
        aus.forEach(p => p.setAttribute("opacity", 0)); ein.forEach(p => p.setAttribute("opacity", 1));
        return;
      }
      const zeit = (dauer, easing = "linear") => ({ delay: start, duration: dauer, easing, fill: "both" });
      const form = (p, offs, segEasing) => p.animate([ue.von(PX), ue.von(PX), ue.zu(PX), ue.zu(PX)]
        .map((d, i) => ({ d: `path("${d}")`, offset: offs[i], ...(segEasing ? { easing: segEasing } : {}) })), zeit(ue.dauer));
      if (ue === WIRBEL) {
        // zwei Runden um den festen Punkt 118/100; jeder Pfad dreht sich selbst, die Schichten bleiben rechts unten
        pfade.forEach(p => {
          form(p, [0, .08, .62, 1], "cubic-bezier(.45,0,.2,1)");
          p.style.transformBox = "view-box"; p.style.transformOrigin = "118px 100px";
          p.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(720deg)" }], zeit(1500, "cubic-bezier(.3,.1,.15,1)"));
        });
        const weich = { delay: start + 250, duration: 800, easing: "cubic-bezier(.45,0,.2,1)", fill: "both" };
        aus.forEach(p => p.animate([{ opacity: 1 }, { opacity: 0 }], weich));
        ein.forEach(p => p.animate([{ opacity: 0 }, { opacity: 1 }], weich));
      } else {
        g.querySelector(".upi-pp-form").animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)", offset: .45 },
          { transform: "scaleX(0)", offset: .5 }, { transform: "scaleX(1.12)", offset: .8 }, { transform: "scaleX(1)" }], zeit(850, "ease-in-out"));
        pfade.forEach(p => form(p, [0, .47, .48, 1]));
        const hart = (a, b) => [{ opacity: a }, { opacity: a, offset: .47 }, { opacity: b, offset: .48 }, { opacity: b }];
        aus.forEach(p => p.animate(hart(1, 0), zeit(850))); ein.forEach(p => p.animate(hart(0, 1), zeit(850)));
      }
    });
  }

  // Stapel-Stil "Beige auf Akzent" (dunkel) / "Tinte auf Akzent" (hell), Werkstatt mit den exakten v2-Werten
  function stapel(weltKey, modus) {
    const W = WELTEN[weltKey], ak = W.dunkel.ak;
    if (modus === "hell") {
      const f = W.hell;
      return { ink: f.ink, akzent: f.ak, tiefe: [f.ak, weltKey === "werkstatt" ? "#ffb48f" : mische(f.ak, "#ffffff", .5)] };
    }
    return weltKey === "werkstatt"
      ? { ink: "#f4f1ea", akzent: ak, tiefe: [ak, "#c9461b", "#6e2a12"] }
      : { ink: W.dunkel.ink, akzent: ak, tiefe: [ak, mische(ak, "#000000", .3), mische(ak, "#000000", .62)] };
  }

  // ---------- Die sechs Starts: jeder liefert Markup und seine Laenge (s) ----------
  const INTRO = {
    // A: die Anzeige schaltet UP ein und bleibt stehen; CREW kommt daneben dazu
    A: f => ({ ende: 1.7, html: marke("-48 26 578 150", buchstaben(f.ink, "CREW", 1.0),
      `<g class="upi-ein" style="--t0:0s">${lcd(f, -42, 36, 1.55)}</g>`) }),

    // B: Taste faellt ein, wird gedrueckt; das dunkle Kreuz loest sich, waechst, faerbt sich aus der Mitte ein
    //    und wirbelt zum P; CREW und eine kleine Taste folgen
    B: (f, o) => {
      // Kreuz auf der Taste: dunkel auf dunklem Grund (wird hell), hell auf hellem Grund (wird dunkel) - sichtbarer Wechsel
      const kreuz = o.modus === "hell" ? f.fl : f.lcd;
      const tLos = 1.4, tFarbig = tLos + .5, tM = 1.95, tE = tM + WIRBEL.dauer / 1000;
      const grosse = `<g class="upi-aus" style="--t0:${tM + .1}s"><g class="upi-fall" style="--t0:.35s">${taste(f, 118, 100, 56, .95, kreuz)}</g></g>`;
      // Einfaerben: vier Arme in Schriftfarbe wachsen von der Mitte zur Spitze ueber das dunkle Kreuz (Strich-Zug,
      // keine Maske - laeuft auch in Safari). Sobald alles farbig ist, uebernimmt das gleich aussehende Wirbel-Kreuz.
      const arm = e => `<path class="upi-zieh upi-arm" style="--t0:${tLos}s" pathLength="1" d="M118 100 ${e}" fill="none"
        stroke="${f.ink}" stroke-width="22" stroke-linecap="round"/>`;
      const dunkel = `<g class="upi-verbergen" style="--t0:${tFarbig}s">
        <path d="${PLUS2(PX)}" fill="none" stroke="${kreuz}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
        ${["V61", "V139", "H79", "H157"].map(arm).join("")}</g>`;
      const wirbelKreuz = `<g class="upi-zeigen" style="--t0:${tFarbig}s">${plusP(f.ink, f.ink, WIRBEL, tM, [], true)}</g>`;
      const loesen = `<g class="upi-zeigen" style="--t0:${tLos}s"><g class="upi-wachsen" style="--t0:${tLos}s">${wirbelKreuz}${dunkel}</g></g>`;
      const klein = `<g class="upi-ein" style="--t0:${tE + .5}s">${taste(f, 560, 100, 60, tE + .8)}</g>`;
      return { ende: tE + 1.2, html: marke("-12 30 640 150", buchstaben(f.ink, "U", 0) + grosse + loesen + buchstaben(f.ink, "CREW", tE - .1) + klein) };
    },

    // C: die Pads leuchten von unten nach oben, dann der Name
    C: f => ({ ende: 2.0, html: marke("-100 30 640 150", buchstaben(f.ink, "UPCREW", 1.2), pads(f, -94, 50, 20, 5, .25)) }),

    // D: Passmarken, Name, Linie, Beschriftung - wie ein Typenschild, das gedruckt wird
    D: (f, o) => {
      const ecke = (x, y, dx, dy, t) => `<path class="upi-ein" style="--t0:${t}s" d="M${x} ${y + dy} V${y} H${x + dx}" stroke="${f.lei}" stroke-width="1.5" fill="none"/>`;
      // links oben die App-Version (z. B. "v0.140.2"), rechts oben Nummer und Name der App
      const v = o.app && o.app.version ? String(o.app.version) : "";
      const links = v ? (/^v/i.test(v) ? v : "v" + v).toLowerCase() : "";
      const rechts = o.app && o.app.name ? `${o.app.nr ? o.app.nr + " · " : ""}${o.app.name}` : "";
      const schild = ecke(-24, 22, 14, 14, .1) + ecke(524, 22, -14, 14, .2) + ecke(-24, 178, 14, -14, .3) + ecke(524, 178, -14, -14, .4)
        + `<line class="upi-zieh" style="--t0:1.35s" pathLength="1" x1="-6" y1="164" x2="480" y2="164" stroke="${f.lei}" stroke-width="1"/>`
        + (links ? `<g class="upi-ein" style="--t0:1.8s">${mono(-6, 40, text(links), f.lei, 11)}</g>` : "")
        + (rechts ? `<g class="upi-ein" style="--t0:2.0s">${mono(506, 40, text(rechts.toLowerCase()), f.lei, 11, "end")}</g>` : "")
        + `<rect class="upi-ein" style="--t0:2.3s" x="492" y="158" width="14" height="12" rx="2" fill="${f.ak}"/>`;
      return { ende: 2.65, html: marke("-30 16 562 170", buchstaben(f.ink, "UPCREW", .55), "", schild) };
    },

    // E / F: gestapeltes Farb-Logo; das Plus wirbelt (E) oder klappt (F) zum P, dann CREW
    E: (f, o) => gestapelt(o, WIRBEL),
    F: (f, o) => gestapelt(o, KLAPPEN),
  };
  function gestapelt(o, ue) {
    const s = stapel(o.welt, o.modus), tM = .95, tE = tM + ue.dauer / 1000;
    return { ende: tE + .65, html: marke("-12 30 560 165",
      buchstaben(s.ink, "U", .2, s.tiefe) + plusP(s.akzent, s.ink, ue, tM, s.tiefe) + buchstaben(s.ink, "CREW", tE - .1, s.tiefe)) };
  }

  // ---------- Zeigen ----------
  let laufend = null;   // ein zweiter Aufruf ersetzt das laufende Intro sauber (alte Uhr darf nicht nachfeuern)
  function zeigen(behaelter, optionen) {
    const opt = optionen || {};
    if (laufend) laufend();
    return new Promise(fertig => {
      if (!behaelter) { fertig(null); return; }
      const modus = opt.modus === "hell" ? "hell" : "dunkel";
      const gewaehlt = opt.welt || lies(SCHLUESSEL_WELT);
      const welt = WELTEN[gewaehlt] ? gewaehlt : "werkstatt";
      const art = ARTEN.includes(opt.art) ? opt.art : naechsteArt();
      const f = WELTEN[welt][modus];
      const ruhig = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
      const { html, ende } = INTRO[art](f, { modus, welt, app: opt.app });

      behaelter.classList.add("upi");
      behaelter.classList.remove("upi-weg");
      behaelter.style.background = f.bg;
      behaelter.setAttribute("role", "img");
      behaelter.setAttribute("aria-label", "UPCrew");
      behaelter.innerHTML = `<div class="upi-buehne">${html}</div>`;
      behaelter.hidden = false;
      plusLauf(behaelter, ruhig);

      // "wer spielt": ohne Versprechen gilt es als erfuellt - dann ist alles wie bisher
      const wer = opt.werSpielt && typeof opt.werSpielt.then === "function" ? opt.werSpielt : null;
      let werDa = !wer, werWert = null, animDa = false, durchFrist = false;

      let vorbei = false, ausUhr = 0, fristUhr = 0;
      const loesen = () => {
        vorbei = true;
        clearTimeout(uhr);
        clearTimeout(fristUhr);
        behaelter.removeEventListener("click", animEnde);
        document.removeEventListener("keydown", animEnde);
        if (wer) { behaelter.classList.remove("upi-wartet"); behaelter.removeAttribute("aria-busy"); }
        if (laufend === abbrechen) laufend = null;
      };
      const abbrechen = () => { if (vorbei) { clearTimeout(ausUhr); } else { loesen(); } fertig(null); };
      const beenden = () => {
        if (vorbei) return;
        loesen();
        laufend = abbrechen;
        behaelter.classList.add("upi-weg");
        ausUhr = setTimeout(() => {
          if (laufend === abbrechen) laufend = null;
          behaelter.hidden = true;
          behaelter.classList.remove("upi-weg");
          behaelter.innerHTML = "";
          behaelter.style.background = "";
          const wert = wer ? { art, welt, modus, wer: werDa ? werWert : null, frist: durchFrist } : { art, welt, modus };
          // Glied fuer ein spaeteres Spiel-Intro NACH dem Studio-Intro (heute leer): erst danach erfuellt es
          if (typeof opt.danach !== "function") { fertig(wert); return; }
          let glied;
          try { glied = Promise.resolve(opt.danach(behaelter, wert)); } catch (e) { glied = Promise.resolve(); }
          glied.then(() => fertig(wert), () => fertig(wert));
        }, AUSBLENDEN_MS);
      };
      // Endet erst, wenn beides da ist: Animation fertig (oder uebersprungen) UND wer spielt
      const pruefen = () => {
        if (vorbei || !animDa) return;
        if (werDa) { beenden(); return; }
        behaelter.classList.add("upi-wartet");
        behaelter.setAttribute("aria-busy", "true");
      };
      const animEnde = () => { animDa = true; pruefen(); };
      const dauer = ruhig ? RUHIG_MS : Math.round(ende * 1000) + HALTEN_MS;
      const uhr = setTimeout(animEnde, dauer);
      if (wer) {
        const da = w => { if (vorbei || werDa) return; werDa = true; werWert = w === undefined ? null : w; pruefen(); };
        wer.then(da, () => da(null));
        fristUhr = setTimeout(() => { if (vorbei) return; durchFrist = !werDa; animDa = true; beenden(); }, dauer + WARTEN_MS);
      }
      behaelter.addEventListener("click", animEnde);
      document.addEventListener("keydown", animEnde);
      laufend = abbrechen;
    });
  }

  window.UPCREW_INTRO = { zeigen, WELTEN, ARTEN, SCHLUESSEL_ZAEHLER, SCHLUESSEL_WELT, AUSBLENDEN_MS, WARTEN_MS };
})();
