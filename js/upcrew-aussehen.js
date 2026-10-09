/*
 * upcrew-aussehen.js — das Aussehen der UPCrew-Apps (Blunderluck, Typoluck, seit 09.10.2026 Kaffekasse; NICHT Trainer).
 *
 * DER SCHALTER `GETEILT` (Entwickler-Schalter, nichts für Spieler; Nutzer 27.09.2026: „mach es doch so, dass es
 * nicht sync ist, also die Designs — wenn man auf Übernehmen drückt, soll sich nur das Spiel ändern. Aber mach einen
 * Schalter rein für die Zukunft, falls ich beide wieder sync haben will“):
 *   GETEILT = false (Standard seit 27.09.2026): JEDES SPIEL HAT SEIN EIGENES AUSSEHEN.
 *     - Gerät: Schlüssel je Spiel, `<app>.aussehen` (z. B. `blunderluck.aussehen`, `typoluck.aussehen`). Das Spiel
 *       ergibt sich aus dem ersten Pfad-Teil der Seite (/Blunderluck/ → "blunderluck"); die App kann es auch setzen:
 *       `UPCREW_AUSSEHEN.app = "typoluck"` (VOR dem ersten Lesen). Unbekanntes Spiel → wie GETEILT.
 *     - Kein Mitziehen über das `storage`-Ereignis: Die andere App hat einen anderen Schlüssel.
 *     - EINMALIGER UMZUG: Fehlt der eigene Schlüssel, startet das Spiel mit dem bisherigen gemeinsamen
 *       `upcrew.aussehen` (nur gelesen, nie mehr geschrieben) — niemand verliert seine Wahl.
 *     - Konto: je Spiel (`konten/<uid>/aussehenJe/<app>`, Regel SICHERHEIT.md §11c in Blunderluck) — das
 *       entscheidet die App; `fuerKonto`/`uebernehmen` liefern und nehmen weiter die sechs Felder.
 *   GETEILT = true: EIN Aussehen für alle Spiele, genau wie bis 27.09.2026 (Rest dieses Kopfs).
 *
 * Nutzer, 26.09.2026 (gilt bei GETEILT = true): „wenn man die eine App auf hell umstellt oder die Farbpalette /
 * Schriftart nutzt, sollen sich alle anderen Apps auch so umstellen.“
 *
 * Was hier liegt (ein JSON unter `upcrew.aussehen`, bei GETEILT = false unter `<app>.aussehen`):
 *     darstellung  "geraet" | "hell" | "dunkel"
 *     farbwelt     "grau" | "werkstatt" | "studio" | "feld" | "tiefsee" | "gold"   (Standard seit 29.09.2026c: "grau")
 *     schrift      "S1" … "S6"   (Crew-Schnitte)
 *     knoepfe      "K1" … "K6"
 *     (leseschrift — seit 29.09.2026 WEG, Nutzer: „was macht standart schrift? brauchen wir eigentlich nicht“. Ein
 *      alter Wert im Gerät oder am Konto wird still übergangen und beim nächsten Speichern nicht mehr geschrieben;
 *      es gilt immer die gewählte `schrift`. Die Apps nehmen ihren Schalter „Standard-Schrift“ samt Hilfe heraus.)
 *     stand        Zeitpunkt der letzten Änderung (ms) — die neuere Wahl gewinnt
 *     umstellung   Merker der einmaligen Umstellungen (Zahl, fehlt = 0). 1 = „Alle auf Grau" ist erledigt.
 *
 * EINMALIGE UMSTELLUNG AUF GRAU (Nutzer 29.09.2026 abends: bestehende Spieler „alle auf Schwarz-Weiß"; Farbwelten
 * werden über das Level neu freigeschaltet, Shop-Käufe bleiben Besitz):
 *   - Jedes Aussehen OHNE Merker (umstellung < UMSTELLUNG) gilt als „von vorher": seine Farbwelt wird "grau", der
 *     Merker gesetzt, `stand` bleibt gleich (die Umstellung ist keine neue Wahl). Das gilt für das Gerät (beim ersten
 *     Lesen, sofort zurückgeschrieben) UND für alles, was vom Konto kommt (`uebernehmen`) — so gewinnt eine NACH der
 *     Umstellung getroffene Wahl (neuer `stand`, mit Merker) auf jedem Gerät, eine alte Wahl ohne Merker nie.
 *   - Der Merker steht IM Aussehen-Objekt, also dort, wo es liegt: Gerät `<app>.aussehen` (GETEILT = false) bzw.
 *     `upcrew.aussehen` (GETEILT = true, dann stellt die zweite App NICHT erneut um), Konto `aussehen` bzw.
 *     `aussehenJe/<app>` über `fuerKonto()`. Der Umzug aus dem gemeinsamen `upcrew.aussehen` nimmt den Merker mit.
 *   - Danach wählt jeder frei (`setzen` behält den Merker). `umgestelltJetzt` = true, wenn DIESER Start umgestellt
 *     hat (für einen Hinweis der App); `kontoBraucht(vomKonto)` = true, wenn das Konto-Objekt noch keinen Merker hat
 *     (die App schreibt dann einmal `fuerKonto()` ans Konto).
 *   - Das Konto-Feld `umstellung` und der Wert "grau" brauchen die Regel-Ergänzung (EINBAU-2026-09-29c.md). Fehlt
 *     sie, filtert die App beides heraus; das Gerät bleibt richtig, ein Konto-Objekt ohne Merker wird bei jedem
 *     Übernehmen wieder auf Grau gestellt.
 *
 * WIE DIE ANDEREN APPS MITZIEHEN
 *  1. Gleicher Browser: beide Spiele liegen auf https://up-birdo.github.io/ → `localStorage` ist geteilt. Ist die
 *     andere App gerade offen, meldet der Browser die Änderung (`storage`-Ereignis) → sie stellt sich SOFORT um.
 *     Beim Zurückholen in den Vordergrund wird zusätzlich nachgelesen.
 *  2. Andere Geräte und iPhone-Home-Bildschirm-Apps (jede hat eigenen Speicher): über das UPCrew-Konto. Die App
 *     schreibt `fuerKonto()` nach jeder Änderung an ihr Konto und gibt beim Start/Vordergrund das Konto-Objekt an
 *     `uebernehmen()`; die neuere Wahl (`stand`) gewinnt. Gäste: nur Punkt 1.
 *
 * Freischalten entscheidet die App (Inventar am Konto, Pfad-Stufen): `setzen` nimmt nur, was `erlaubt` durchlässt.
 * Unbekannte Werte (z. B. eine neuere App kennt eine Schrift, die ältere nicht) fallen still auf den Standard.
 *
 * Nutzung:
 *     UPCREW_AUSSEHEN.anwenden();                    früh beim Laden (kein Aufblitzen)
 *     UPCREW_AUSSEHEN.beobachten(() => neuZeichnen);  andere App hat umgestellt
 *     UPCREW_AUSSEHEN.setzen({ darstellung: "hell" });
 *
 * Gemeinsamer Baustein — nie in einer App abwandeln.
 */
(function () {
  "use strict";

  // ENTWICKLER-SCHALTER (siehe Kopf): false = jedes Spiel sein eigenes Aussehen, true = eins für alle.
  const GETEILT = false;
  const GEMEINSAM = "upcrew.aussehen";
  // Die Apps mit eigenem Aussehen (seit 09.10.2026 auch Kaffekasse — kein Spiel, derselbe Baustein).
  const SPIELE = ["blunderluck", "typoluck", "kaffekasse"];
  const ALT_FARBWELT = "upcrew.farbwelt";   // liest das Intro; nur bei GETEILT mitgeschrieben

  let app = (function () {
    try {
      const teil = String((typeof location !== "undefined" && location.pathname) || "").split("/").filter(Boolean)[0] || "";
      return SPIELE.indexOf(teil.toLowerCase()) !== -1 ? teil.toLowerCase() : "";
    } catch (e) { return ""; }
  })();
  /* Der Schlüssel dieses Spiels (bei GETEILT oder unbekanntem Spiel der gemeinsame). */
  const schluessel = () => (GETEILT || !app) ? GEMEINSAM : app + ".aussehen";

  const WAHL = {
    darstellung: ["geraet", "hell", "dunkel"],
    farbwelt: ["grau", "werkstatt", "studio", "feld", "tiefsee", "gold"],
    schrift: ["S1", "S2", "S3", "S4", "S5", "S6"],
    knoepfe: ["K1", "K2", "K3", "K4", "K5", "K6"],
  };
  // Standard = frei für alle. Schrift und Knöpfe: Sieger der Bewertung, bis dahin S1/K1. Farbwelt seit 29.09.2026c
  // "grau" (Schwarz · Weiß · Grau, Level 0), vorher "werkstatt".
  const STANDARD = { darstellung: "geraet", farbwelt: "grau", schrift: "S1", knoepfe: "K1", stand: 0 };
  // Einmalige Umstellungen (siehe Kopf). 1 = alle auf Grau (29.09.2026c). Eine spätere bekäme 2.
  const UMSTELLUNG = 1;
  let umgestelltJetzt = false;

  // Wo die Crew-Schriften liegen (relativ zur Seite). Die App setzt es, falls anders: UPCREW_AUSSEHEN.schriftPfad = "…/".
  let schriftPfad = "schrift/";
  const geladen = new Set();
  /* Meldet beide Stärken einer Crew-Schrift an (einmal je Seite). Die Datei kommt erst, wenn Text sie braucht. */
  function schriftLaden(s) {
    if (geladen.has(s) || typeof FontFace !== "function" || !document.fonts) return;
    geladen.add(s);
    for (const [stil, gewicht] of [["normal", "400"], ["fett", "700"]]) {
      const f = new FontFace("Crew " + s, `url(${schriftPfad}crew-${s}-${stil}.woff2)`, { weight: gewicht, display: "swap" });
      document.fonts.add(f);
    }
  }
  const RUECKFALL = '"Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';

  let erlaubt = () => true;
  const horcher = new Set();

  const lies = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const schreib = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* privat/voll: dann nur für diese Sitzung */ } };

  function bereinigen(roh) {
    const a = Object.assign({}, STANDARD);
    if (roh && typeof roh === "object") {
      for (const k of Object.keys(WAHL)) if (WAHL[k].indexOf(roh[k]) !== -1) a[k] = roh[k];
      a.stand = Number(roh.stand) > 0 ? Number(roh.stand) : 0;
    }
    const u = roh && typeof roh === "object" ? Math.floor(Number(roh.umstellung)) : 0;
    a.umstellung = u > 0 ? u : 0;
    return a;
  }

  /* Die einmalige Umstellung auf ein (bereinigtes) Aussehen anwenden. → true, wenn sich etwas geändert hat. */
  function umstellen(a) {
    if (a.umstellung >= UMSTELLUNG) return false;
    a.farbwelt = "grau";
    a.umstellung = UMSTELLUNG;
    return true;
  }

  let aktuell = null;
  function lesen() {
    if (!aktuell) {
      let roh = null;
      try { roh = JSON.parse(lies(schluessel()) || "null"); } catch (e) { roh = null; }
      if (!roh && schluessel() !== GEMEINSAM) {
        // Einmaliger Umzug: das bisher gemeinsame Aussehen als Start — sofort als EIGENES abgelegt, damit spätere
        // Änderungen am gemeinsamen Schlüssel (ein Spiel mit älterem Baustein) hier nicht mehr ankommen.
        try { roh = JSON.parse(lies(GEMEINSAM) || "null"); } catch (e) { roh = null; }
        if (roh) schreib(schluessel(), JSON.stringify(bereinigen(roh)));
      }
      if (!roh) {
        // Erststart mit diesem Baustein: die schon gewählte Farbwelt übernehmen
        const welt = lies(ALT_FARBWELT);
        roh = welt ? { farbwelt: welt } : null;
      }
      aktuell = bereinigen(roh);
      // Einmalige Umstellung: nur ein VORHANDENES Aussehen zählt (sofort zurückschreiben); ein neuer Spieler hat
      // ohnehin Grau und bekommt den Merker beim ersten Speichern.
      if (umstellen(aktuell) && roh) {
        umgestelltJetzt = true;
        schreib(schluessel(), JSON.stringify(aktuell));
        if (schluessel() === GEMEINSAM) schreib(ALT_FARBWELT, aktuell.farbwelt);
      }
    }
    return Object.assign({}, aktuell);
  }

  function speichern(neu) {
    aktuell = bereinigen(neu);
    schreib(schluessel(), JSON.stringify(aktuell));
    if (schluessel() === GEMEINSAM) schreib(ALT_FARBWELT, aktuell.farbwelt);
  }

  function melden(quelle) {
    const a = lesen();
    horcher.forEach((fn) => { try { fn(a, quelle); } catch (e) { console.error(e); } });
  }

  /* Einmalig je App: die bisherige eigene Wahl (z. B. Typoluck `thema`) mitgeben, solange es noch keine gemeinsame
     gibt. Danach ist `upcrew.aussehen` führend. */
  function migrieren(alt) {
    if (lies(schluessel())) return false;
    if (schluessel() !== GEMEINSAM && lies(GEMEINSAM)) return false;   // der Umzug aus dem gemeinsamen gewinnt
    // Die alte Wahl ist „von vorher" → sie wird gleich mit umgestellt (Farbwelt Grau, Rest bleibt).
    const neu = bereinigen(Object.assign(lesen(), alt || {}, { stand: 0, umstellung: 0 }));
    if (umstellen(neu) && alt && alt.farbwelt) umgestelltJetzt = true;
    speichern(neu);
    return true;
  }

  function setzen(teil) {
    const neu = Object.assign(lesen(), teil || {});
    for (const k of ["farbwelt", "schrift", "knoepfe"]) {
      if (teil && k in teil && !erlaubt(k, teil[k])) neu[k] = aktuell[k];
    }
    neu.stand = Date.now();
    speichern(neu);
    anwenden();
    melden("selbst");
    return lesen();
  }

  function modus() {
    const d = lesen().darstellung;
    if (d === "hell" || d === "dunkel") return d;
    const hell = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: light)").matches;
    return hell ? "hell" : "dunkel";
  }

  function schriftFamilie(a) {
    return `"Crew ${a.schrift}", ${RUECKFALL}`;
  }

  /* Schreibt alles an <html>: data-darstellung (fehlt = Gerät), data-farbwelt, data-schrift, data-knoepfe
     (die Knopf-Familie selbst steht in upcrew-knoepfe.css), die Farbwelt-Variablen (wenn upcrew-farbwelten.js da
     ist) und --schrift-familie. */
  function anwenden(ziel) {
    const el = ziel || (typeof document !== "undefined" && document.documentElement);
    if (!el || !el.dataset) return;
    const a = lesen();
    if (a.darstellung === "geraet") delete el.dataset.darstellung; else el.dataset.darstellung = a.darstellung;
    el.dataset.schrift = a.schrift;
    el.dataset.knoepfe = a.knoepfe;
    if (el.style) {
      schriftLaden(a.schrift);
      el.style.setProperty("--schrift-familie", schriftFamilie(a));
      if (window.UPCREW_FARBWELTEN) window.UPCREW_FARBWELTEN.anwenden(a.farbwelt, modus(), el);
    }
  }

  function beobachten(fn) { horcher.add(fn); return () => horcher.delete(fn); }

  /* Konto → Gerät. Gibt true zurück, wenn sich etwas geändert hat. */
  function uebernehmen(vomKonto) {
    if (!vomKonto || typeof vomKonto !== "object") return false;
    // Ein Konto-Objekt ohne Merker ist „von vorher": erst umstellen (stand bleibt), dann vergleichen.
    const neu = bereinigen(vomKonto);
    umstellen(neu);
    if (!(neu.stand > lesen().stand)) return false;
    speichern(neu);
    anwenden();
    melden("konto");
    return true;
  }
  const fuerKonto = () => lesen();
  /* true, wenn das Konto-Objekt den Merker noch nicht trägt → die App schreibt einmal fuerKonto() ans Konto. */
  const kontoBraucht = (vomKonto) => !vomKonto || typeof vomKonto !== "object"
    || !(Math.floor(Number(vomKonto.umstellung)) >= UMSTELLUNG);

  // Andere App/Tab im selben Browser hat umgestellt
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key !== schluessel() && e.key !== null) return;   // bei GETEILT = false zieht die andere App nicht mit
      aktuell = null;
      anwenden();
      melden("andere-app");
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      const vorher = JSON.stringify(aktuell);
      aktuell = null;
      if (JSON.stringify(lesen()) !== vorher) { anwenden(); melden("andere-app"); }
    });
    if (typeof matchMedia === "function") {
      matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
        if (lesen().darstellung === "geraet") { anwenden(); melden("geraet"); }
      });
    }
  }

  window.UPCREW_AUSSEHEN = {
    GETEILT, GEMEINSAM, WAHL, STANDARD, UMSTELLUNG, START_FARBWELT: STANDARD.farbwelt,
    get umgestelltJetzt() { return umgestelltJetzt; },
    kontoBraucht,
    get SCHLUESSEL() { return schluessel(); },
    get app() { return app; },
    set app(name) { const n = String(name || "").toLowerCase(); app = SPIELE.indexOf(n) !== -1 ? n : ""; aktuell = null; },
    lesen, setzen, anwenden, modus, beobachten, uebernehmen, fuerKonto, migrieren, schriftLaden,
    get schriftPfad() { return schriftPfad; }, set schriftPfad(p) { schriftPfad = String(p); },
    erlaubtSetzen: (fn) => { erlaubt = typeof fn === "function" ? fn : () => true; },
  };
})();
