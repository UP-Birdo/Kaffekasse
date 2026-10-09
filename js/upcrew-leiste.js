/*
 * upcrew-leiste.js — die wandernde Kapsel der Tab-Leiste (zu upcrew-leiste.css), gleich in Blunderluck und Typoluck.
 * Gemeinsamer Baustein: in die Apps KOPIEREN, nie abwandeln.
 *
 * Nutzer 27.09.2026: „die Animation beim Tab-Wechseln unten muss besser werden“ → Fassung „C · Gleiten + Hüpfen“
 * aus `entwuerfe\Leiste-Schrift\wechsel.html`: EINE Kapsel fährt gefedert vom alten zum neuen Tab, das Symbol hüpft
 * beim Ankommen kurz.
 *
 * Nutzung (einmal je Leiste, nachdem sie im DOM steht):
 *     UPCREW_LEISTE.an(document.querySelector(".up-leiste"));   → { aus() }
 * Die App wechselt Tabs wie bisher über `aria-current="page"` — das Skript beobachtet das selbst
 * (MutationObserver), auch wenn die App die Knöpfe neu baut. Keine weiteren Aufrufe nötig.
 *
 * WARUM GERECHNET STATT GEMESSEN: Beim Wechsel federn die Tab-Breiten noch (flex). Gemessen würde die Kapsel
 * auf ein halbfertiges Layout zielen. Das Ziel ergibt sich aus den flex-Anteilen (aktiv 2.5, sonst 1 — wie in
 * upcrew-leiste.css) und der Innenbreite der Leiste.
 */
(function () {
    "use strict";

    const AKTIV_ANTEIL = 2.5;      // muss zu `.up-tab[aria-current="page"] { flex: 2.5 }` passen
    const RAND = 4;                // Kapsel 4 px schmaler je Seite als ihr Tab
    const HOEHE = 44;              // wie .up-kapsel
    const HEBEN = 0.12 * HOEHE;    // wie der alte Versatz translate(-50%, -62%)

    function tabsVon(nav) {
        return Array.prototype.filter.call(nav.children, function (el) {
            return el.classList && el.classList.contains("up-tab");
        });
    }

    /* Ziel der Kapsel: x/Breite aus den flex-Anteilen, y aus der Mitte der Tabs. */
    function ziel(nav, tab) {
        const tabs = tabsVon(nav);
        const i = tabs.indexOf(tab);
        if (i < 0) {
            return null;
        }
        const stil = getComputedStyle(nav);
        const links = parseFloat(stil.paddingLeft) || 0;
        const innen = nav.clientWidth - links - (parseFloat(stil.paddingRight) || 0);
        const teil = innen / (tabs.length - 1 + AKTIV_ANTEIL);
        const mitte = tab.offsetTop + tab.offsetHeight / 2;
        return { x: links + i * teil + RAND, y: mitte - HOEHE / 2 - HEBEN, w: AKTIV_ANTEIL * teil - 2 * RAND };
    }

    function setzen(kapsel, z) {
        kapsel.style.transform = "translate(" + z.x + "px," + z.y + "px)";
        kapsel.style.width = Math.max(0, z.w) + "px";
    }

    function an(nav) {
        if (!nav || nav.__upKapsel) {
            return nav && nav.__upKapsel;
        }
        const kapsel = document.createElement("div");
        kapsel.className = "up-kapsel up-ohne-weg";
        kapsel.setAttribute("aria-hidden", "true");
        nav.insertBefore(kapsel, nav.firstChild);
        nav.classList.add("up-mit-kapsel");

        let letzter = null;

        function aktiver() {
            return tabsVon(nav).filter(function (t) { return t.getAttribute("aria-current") === "page"; })[0] || null;
        }

        /* Ohne Weg: beim Start, bei Größenänderung, wenn die Leiste unsichtbar war. */
        function sofort() {
            const t = aktiver();
            kapsel.style.visibility = t ? "" : "hidden";
            if (!t) {
                letzter = null;
                return;
            }
            const z = ziel(nav, t);
            if (!z) {
                return;
            }
            kapsel.classList.add("up-ohne-weg");
            setzen(kapsel, z);
            void kapsel.offsetWidth;
            kapsel.classList.remove("up-ohne-weg");
            letzter = t;
        }

        function wechsel() {
            const t = aktiver();
            if (t === letzter) {
                return;
            }
            if (!t || !letzter || !nav.offsetWidth) {
                sofort();
                return;
            }
            const z = ziel(nav, t);
            if (!z) {
                return;
            }
            kapsel.style.visibility = "";
            setzen(kapsel, z);
            t.classList.remove("up-hopp");
            void t.offsetWidth;
            t.classList.add("up-hopp");
            letzter = t;
        }

        const beobachter = new MutationObserver(function (liste) {
            const neuGebaut = liste.some(function (m) { return m.type === "childList"; });
            if (neuGebaut && !kapsel.parentNode) {
                nav.insertBefore(kapsel, nav.firstChild);
            }
            if (neuGebaut) {
                /* Knöpfe neu gebaut: gleicher Tab aktiv → ohne Weg, sonst gleiten. */
                const t = aktiver();
                if (letzter && t && !nav.contains(letzter)) {
                    const alterName = letzter.getAttribute("aria-label");
                    letzter = t.getAttribute("aria-label") === alterName ? null : letzter;
                }
                if (!letzter) {
                    sofort();
                    return;
                }
            }
            wechsel();
        });
        beobachter.observe(nav, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-current"] });

        const groesse = typeof ResizeObserver === "function" ? new ResizeObserver(sofort) : null;
        if (groesse) {
            groesse.observe(nav);
        } else {
            window.addEventListener("resize", sofort);
        }

        sofort();

        const griff = {
            aus: function () {
                beobachter.disconnect();
                if (groesse) {
                    groesse.disconnect();
                } else {
                    window.removeEventListener("resize", sofort);
                }
                nav.classList.remove("up-mit-kapsel");
                if (kapsel.parentNode) {
                    kapsel.parentNode.removeChild(kapsel);
                }
                delete nav.__upKapsel;
            },
        };
        nav.__upKapsel = griff;
        return griff;
    }

    const UPCREW_LEISTE = { an: an, ziel: ziel, AKTIV_ANTEIL: AKTIV_ANTEIL };
    if (typeof window !== "undefined") {
        window.UPCREW_LEISTE = UPCREW_LEISTE;
    }
    if (typeof module !== "undefined" && module.exports) {
        module.exports = UPCREW_LEISTE;
    }
})();
