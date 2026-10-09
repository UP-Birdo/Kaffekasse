/* UPCrew-Farbwelten — macht aus einer Farbwelt die Farb-Platzhalter (CSS-Variablen) der Apps.
   Gemeinsamer Baustein: in die Apps KOPIEREN, nicht abwandeln.
   Braucht upcrew-intro.js (dort stehen die sieben Grundfarben je Welt in UPCREW_INTRO.WELTEN).

   - Jede Welt gibt es dunkel UND hell.
   - Gemeinsame Oberflaeche: --flaeche --karte --karte-leise --rahmen --schrift --schrift-leise
     --haupt --haupt-schrift --haupt-kante --still-kante (gleiche Namen in Blunderluck und Typoluck).
   - Typoluck zusaetzlich Kacheln und Tastatur (--kachel-*, --taste-*), Blunderluck das Brett (--feld-hell/-dunkel).
   - Bedeutungsfarben bleiben unberuehrt: --gefahr, --gut, --warnung*, --feld-gewaehlt.
   - Wordguesser-Sperre wie Typoluck darstellung.js: "richtig" nie gruen (75-165 Grad), "vorhanden" nie gelb (38-70).
   - Seit 29.09.2026c Welt "grau" (Schwarz · Weiss · Grau) = Start fuer neue Spieler; KACHELN duerfen je Modus
     abweichen (KACHELN.x.hell), EIGEN setzt einzelne Werte je Welt/Modus fest. pruefen() zusaetzlich: die drei
     Kachel-Zustaende und die Brett-Felder muessen sich unterscheiden.
   - Seit 29.09.2026d Taste "falsch" (--taste-aus*): Schrift >= 4.5, gegen normale Taste >= 1.8 (pruefen()).

   Nutzung:  UPCREW_FARBWELTEN.anwenden("studio", "dunkel")          -> setzt die Variablen auf <html>
             UPCREW_FARBWELTEN.werte("studio", "hell")                -> { "--haupt": "#...", ... }
             UPCREW_FARBWELTEN.pruefen("studio", "hell")              -> Liste der Verstoesse (leer = gut) */
(function () {
  "use strict";

  // Kachel-Farben je Welt: bewusst gesetzt, nicht abgeleitet (Sperre + Unterscheidbarkeit)
  const KACHELN = {
    werkstatt: { richtig: "#e8702a", vorhanden: "#3f8fe0" },   // = Typoluck 0.6.2
    studio:    { richtig: "#7a5cf0", vorhanden: "#e0622e" },
    feld:      { richtig: "#15989a", vorhanden: "#e8702a" },   // Feld ist gruen - die Kachel darf es nicht sein
    tiefsee:   { richtig: "#2f7de8", vorhanden: "#e0622e" },
    gold:      { richtig: "#b8800f", vorhanden: "#6b5cf0" },
    // Grau (29.09.2026c, Nachbesserung): falsch fast schwarz, richtig helles Grau, vorhanden als einzige Ausnahme
    // ein GEDAEMPFTES Blau (wie die Warnfarben: Bedeutung vor Schema). vorhanden:falsch >= 3 (abstand), in hell
    // und dunkel gleich; weisse Schrift ueberall >= 3.2. Blau 214 Grad: ausserhalb der Sperre.
    grau:      { richtig: "#8c8c8c", vorhanden: "#6f8fb8", abstand: 3 },
  };
  // Einzelne Werte, die eine Welt je Modus fest setzt (nach der Ableitung, vor den Kanten). Grau: falsch und Brett
  // brauchen feste Stufen, weil der Akzent fast weiss/schwarz ist (sonst schwarze Felder im hellen Modus).
  const EIGEN = {
    grau: {
      dunkel: { "--kachel-falsch": "#333333", "--feld-hell": "#dedede", "--feld-dunkel": "#8e8e8e" },
      hell:   { "--kachel-falsch": "#333333", "--feld-hell": "#dedede", "--feld-dunkel": "#8e8e8e" },
    },
  };
  const SPERRE = { richtig: { von: 75, bis: 165, name: "gruen" }, vorhanden: { von: 38, bis: 70, name: "gelb" } };

  // ---------- Farb-Rechnen ----------
  const rgb = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
  const hex = a => "#" + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  const mische = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v * (1 - t) + y[i] * t)); };
  function leucht(h) {
    const k = rgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
    return .2126 * k[0] + .7152 * k[1] + .0722 * k[2];
  }
  const kontrast = (a, b) => { const x = leucht(a), y = leucht(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  function farbton(h) {
    const [r, g, b] = rgb(h).map(v => v / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (!d) return { grad: 0, saettigung: 0 };
    let grad = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    const hell = (max + min) / 2;
    return { grad: (grad * 60 + 360) % 360, saettigung: d / (1 - Math.abs(2 * hell - 1)) };
  }
  // Schrift auf einer Farbe: die lesbarere von zwei Kandidaten
  const aufFarbe = (grund, dunkel, hell) => kontrast(grund, dunkel) >= kontrast(grund, hell) ? dunkel : hell;

  // ---------- Werte einer Welt ----------
  function werte(welt, modus) {
    const W = window.UPCREW_INTRO && UPCREW_INTRO.WELTEN;
    if (!W) throw new Error("upcrew-intro.js fehlt");
    const key = W[welt] ? welt : "werkstatt", m = modus === "hell" ? "hell" : "dunkel";
    const f = W[key][m], k = Object.assign({}, KACHELN[key], KACHELN[key][m]), d = m === "dunkel";
    const kante = (c, t = .28) => mische(c, "#000000", t);
    const v = {
      // Oberflaeche (beide Spiele)
      "--flaeche": f.bg,
      "--karte": f.fl,
      "--karte-leise": mische(f.fl, f.ta, d ? .35 : .3),
      "--rahmen": mische(f.fl, f.ta, d ? .8 : .75),
      "--schrift": f.ink,
      "--schrift-leise": f.lei,
      "--haupt": f.ak,
      "--haupt-schrift": aufFarbe(f.ak, d ? f.lcd : "#1a1a1a", "#ffffff"),
      "--haupt-kante": kante(f.ak),
      "--still-kante": d ? mische(f.bg, "#000000", .45) : mische(f.ta, "#000000", .08),
      // Typoluck: Kacheln und Tastatur
      "--kachel-richtig": k.richtig,
      "--kachel-vorhanden": k.vorhanden,
      "--kachel-falsch": d ? mische(f.ta, f.bg, .15) : mische(f.lei, f.ink, .25),
      "--kachel-schrift": "#ffffff",
      "--kachel-rahmen": d ? mische(f.fl, f.ta, .6) : mische(f.ta, f.fl, .15),
      "--kachel-rahmen-voll": d ? mische(f.ta, f.ink, .3) : mische(f.lei, f.ta, .2),
      "--kachel-richtig-kante": kante(k.richtig),
      "--kachel-vorhanden-kante": kante(k.vorhanden),
      "--taste": d ? mische(f.ta, f.ink, .12) : mische(f.ta, f.fl, .35),
      "--taste-schrift": d ? "#ffffff" : f.ink,
      // Taste "falsch" (29.09.2026d): Schrift >= 4.5 und klar von der normalen Taste getrennt (Grau dunkel war
      // fast schwarz mit dunkelgrauer Schrift, hell lag die weisse Schrift bei 3.7-4.1)
      "--taste-aus": d ? mische(f.bg, f.ta, .3) : mische(f.lei, f.ink, .12),
      "--taste-aus-schrift": d ? mische(f.lei, f.ink, .4) : "#ffffff",
      "--taste-kante": d ? mische(f.ta, "#000000", .3) : mische(f.ta, "#000000", .12),
      "--taste-aus-kante": d ? mische(f.bg, "#000000", .5) : mische(f.lei, "#000000", .2),
      // Blunderluck: Brett
      "--feld-hell": d ? mische(f.ink, f.ak, .14) : mische("#ffffff", f.ak, .08),
      "--feld-dunkel": d ? mische(f.ak, "#000000", .38) : mische(f.ak, "#000000", .12),
    };
    Object.assign(v, (EIGEN[key] || {})[m] || {});
    v["--kachel-falsch-kante"] = kante(v["--kachel-falsch"]);
    return v;
  }

  // ---------- Pruefen: Sperre und Lesbarkeit ----------
  function pruefen(name, modus) {
    const v = werte(name, modus), fehler = [];
    for (const rolle of ["richtig", "vorhanden"]) {
      const s = SPERRE[rolle], t = farbton(v["--kachel-" + rolle]);
      if (t.saettigung >= .15 && t.grad >= s.von && t.grad <= s.bis) fehler.push(`Kachel ${rolle} ist ${s.name}`);
    }
    const paare = [
      ["--schrift", "--flaeche", 7, "Schrift auf Grund"], ["--schrift", "--karte", 7, "Schrift auf Karte"],
      ["--schrift-leise", "--karte", 3, "leise Schrift auf Karte"], ["--haupt-schrift", "--haupt", 4.5, "Knopf-Schrift auf Hauptfarbe"],
      ["--kachel-schrift", "--kachel-richtig", 3, "Schrift auf Kachel richtig"], ["--kachel-schrift", "--kachel-vorhanden", 3, "Schrift auf Kachel vorhanden"],
      ["--kachel-schrift", "--kachel-falsch", 3, "Schrift auf Kachel falsch"], ["--taste-schrift", "--taste", 4.5, "Tastenschrift"],
      ["--taste-aus-schrift", "--taste-aus", 4.5, "Schrift auf Taste falsch"], ["--taste", "--taste-aus", 1.8, "Taste falsch gegen normale Taste"],
    ];
    for (const [a, b, min, name] of paare) {
      const k = kontrast(v[a], v[b]);
      if (k < min) fehler.push(`${name}: Kontrast ${k.toFixed(1)} (mind. ${min})`);
    }
    // Zustaende unterscheidbar: ueber die Helligkeit (Kontrast >= 1.4) oder ueber den Farbton (bunt vs. grau,
    // bzw. zwei bunte mit >= 40 Grad Abstand). Wichtig fuer Grau, wo nur die Helligkeit traegt.
    const bunt = t => t.saettigung >= .25;
    const unterscheidbar = (a, b) => {
      if (kontrast(a, b) >= 1.4) return true;
      const x = farbton(a), y = farbton(b);
      if (bunt(x) !== bunt(y)) return true;
      const abstand = Math.min(Math.abs(x.grad - y.grad), 360 - Math.abs(x.grad - y.grad));
      return bunt(x) && bunt(y) && abstand >= 40;
    };
    for (const [a, b] of [["richtig", "vorhanden"], ["vorhanden", "falsch"], ["richtig", "falsch"]]) {
      if (!unterscheidbar(v["--kachel-" + a], v["--kachel-" + b])) fehler.push(`Kachel ${a} und ${b} zu aehnlich`);
    }
    // Welten mit `abstand` (Grau): vorhanden und falsch muessen sich auch in der Helligkeit klar trennen
    const ab = (KACHELN[window.UPCREW_INTRO.WELTEN[name] ? name : "werkstatt"] || {}).abstand;
    if (ab) {
      const k = kontrast(v["--kachel-vorhanden"], v["--kachel-falsch"]);
      if (k < ab) fehler.push(`Kachel vorhanden/falsch: Kontrast ${k.toFixed(1)} (mind. ${ab})`);
    }
    const felder = kontrast(v["--feld-hell"], v["--feld-dunkel"]);
    if (felder < 1.8) fehler.push(`Brett-Felder: Kontrast ${felder.toFixed(1)} (mind. 1.8)`);
    return fehler;
  }

  function anwenden(welt, modus, ziel) {
    const el = ziel || document.documentElement, v = werte(welt, modus);
    for (const [k, w] of Object.entries(v)) el.style.setProperty(k, w);
    el.dataset.farbwelt = window.UPCREW_INTRO.WELTEN[welt] ? welt : "werkstatt";
    return v;
  }

  window.UPCREW_FARBWELTEN = { werte, pruefen, anwenden, kontrast, KACHELN, EIGEN };
})();
