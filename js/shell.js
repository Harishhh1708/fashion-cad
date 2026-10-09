import { logOut } from "./auth.js";
export function renderShell(active) {
  const links = [["dashboard.html","Dashboard"],["profile.html","Profile"],["settings.html","Settings"]];
  const soon = ["Pattern drafting","Fabric library","3D studio"];
  document.getElementById("side").innerHTML =
    '<a class="logo" href="dashboard.html">Fashion<i>CAD</i></a><nav style="margin-top:1.2rem">' +
    links.map(([h,t]) => '<a class="m" href="'+h+'"'+(h===active?' aria-current="page" style="background:var(--mat)"':'')+'>'+t+'</a>').join("") +
    soon.map(t => '<a class="m soon" aria-disabled="true">'+t+' (soon)</a>').join("") +
    '<a class="m" href="#" id="theme">Switch theme</a><a class="m" href="#" id="out">Log out</a></nav>';
  document.getElementById("out").onclick = async (e) => { e.preventDefault(); await logOut(); location.href = "login.html"; };
  document.getElementById("theme").onclick = (e) => { e.preventDefault();
    const r = document.documentElement, n = r.dataset.theme === "light" ? "dark" : "light";
    r.dataset.theme = n; try { localStorage.setItem("fc-theme", n); } catch (x) {} };
}
