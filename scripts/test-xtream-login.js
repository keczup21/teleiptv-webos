/* Test logowania do panelu Xtream - bez telewizora i bez panelu.

   Zgloszony blad: panel wystawiony na https (port 443) nie chcial sie polaczyc,
   a kazdy kanal konczyl sie komunikatem „manifestLoadError” i „format
   nieobslugiwany”. Powod: adres bez schematu dostawal na sztywno „http://”,
   wiec „host:443” wolalo http na porcie TLS. Teraz schemat wynika z portu
   (443 → https, reszta → http), a gdy pierwsza proba nie odpowiada, aplikacja
   pyta pod drugim schematem i zapamietuje ten, ktory zadzialal.

   Test sprawdza:
     1. adres serwera: schemat z portu, drugi schemat do proby, kodowanie danych,
     2. logowanie: udane za pierwszym razem, przelaczenie schematu, zle haslo
        (bez powtorki), brak odpowiedzi z obu adresow, konto nieaktywne, cisza
        (limit czasu) - na prawdziwych funkcjach z www/app.js (vm),
     3. interfejs: podglad hasla (przycisk, style, napisy) i Enter w polu
        ustawien przechodzacy do nastepnego pola.

   Uruchomienie: npm run test:xtream */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "www", "app.js"), "utf8").replace(/\r\n/g, "\n");
const html = fs.readFileSync(path.join(ROOT, "www", "index.html"), "utf8").replace(/\r\n/g, "\n");
const css = fs.readFileSync(path.join(ROOT, "www", "styles.css"), "utf8").replace(/\r\n/g, "\n");

let fails = 0;
function check(name, cond, extra) {
  if (cond) { console.log("  OK   " + name); }
  else { fails++; console.log("  FAIL " + name + (extra ? "   -> " + extra : "")); }
}

/* wyciagamy dokladnie te funkcje z app.js, ktore obsluguja adres i logowanie -
   test nie kopiuje logiki, wiec nie rozjedzie sie z aplikacja */
function slice(from, to) {
  const start = src.indexOf(from);
  const end = start < 0 ? -1 : src.indexOf(to, start + from.length);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Nie znalazlem bloku w app.js: " + from + " .. " + to);
  }
  let block = src.slice(start, end);
  /* granica wypadla w srodku komentarza - obcinamy go, zeby niezamkniety
     "/* ..." nie polknal reszty sklejonego kodu */
  const stray = block.lastIndexOf("/*");
  if (stray > 0 && block.indexOf("*/", stray) < 0) block = block.slice(0, stray);
  return block;
}

const codeServer = slice("function serverScheme(", "function xtreamEndpoint(");
const codeEndpoint = slice("function xtreamEndpoint(", "AKTUALIZACJE  ===");
const codeLogin = slice("var XTREAM_LOGIN_TIMEOUT", "/* krok 1: logowanie");

console.log("Xtream: adres serwera, logowanie, podglad hasla i Enter w polach");

/* --- 1. adres serwera ---------------------------------------------------- */

const profile = { xtreamServer: "", xtreamUser: "u ser", xtreamPass: "p@ss&word" };

function harness(options) {
  const opts = options || {};
  const calls = [];
  const saved = [];
  const sandbox = {
    profile: { xtreamServer: opts.server || "host:443", xtreamUser: "u ser", xtreamPass: "p@ss" },
    /* napis zamiast tlumaczenia: widac, ktory klucz poszedl na ekran */
    t: function (key, params) {
      let out = key;
      if (params) for (const name in params) out += "|" + name + "=" + params[name];
      return out;
    },
    saveSettings: function () { saved.push(Date.now()); },
    fetchJson: function (url) { calls.push(url); return opts.fetch(url, calls.length); },
    /* zegar bez czekania: limit czasu logowania ma odpalac sie od razu, a nie
       po dwunastu sekundach testu (najpierw mikrozdania, potem timer) */
    window: {
      setTimeout: function (fn) { return setTimeout(fn, 0); },
      clearTimeout: function (id) { clearTimeout(id); }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(codeServer + codeEndpoint + codeLogin, sandbox);
  return { api: sandbox, calls: calls, saved: saved };
}

const base = harness({});
check("adres bez portu: http (port 80)",
  base.api.normalizeServer("host") === "http://host", base.api.normalizeServer("host"));
check("port 443: schemat https (panel na porcie TLS, nie http)",
  base.api.normalizeServer("host:443") === "https://host:443", base.api.normalizeServer("host:443"));
check("port 80: schemat http",
  base.api.normalizeServer("host:80") === "http://host:80", base.api.normalizeServer("host:80"));
check("inny port (8080): http",
  base.api.normalizeServer("host:8080") === "http://host:8080", base.api.normalizeServer("host:8080"));
check("adres ze schematem zostaje, jak wpisany (bez ucinania portu)",
  base.api.normalizeServer(" https://host:8443/ ") === "https://host:8443",
  base.api.normalizeServer(" https://host:8443/ "));
check("pusty adres zostaje pusty", base.api.normalizeServer("   ") === "");
check("drugi schemat do proby: host:443 -> http://host:443",
  base.api.alternateServer("host:443") === "http://host:443", base.api.alternateServer("host:443"));
check("drugi schemat do proby: host -> https://host",
  base.api.alternateServer("host") === "https://host", base.api.alternateServer("host"));
check("drugi schemat do proby: https://host:8080 -> http://host:8080",
  base.api.alternateServer("https://host:8080") === "http://host:8080",
  base.api.alternateServer("https://host:8080"));
check("server_info: strumienie ida po adres z server_info (inny port niz panel)",
  base.api.xtreamStreamBase({ url: "stream.example.com", port: "8080", server_protocol: "http" }) === "http://stream.example.com:8080",
  base.api.xtreamStreamBase({ url: "stream.example.com", port: "8080", server_protocol: "http" }));
check("server_info: https bierze https_port, a nie port http",
  base.api.xtreamStreamBase({ url: "s.example.com", port: "8080", https_port: "443", server_protocol: "https" }) === "https://s.example.com:443",
  base.api.xtreamStreamBase({ url: "s.example.com", port: "8080", https_port: "443", server_protocol: "https" }));
check("server_info: brak pola url -> pusty adres (kanaly zostaja przy adresie panelu)",
  base.api.xtreamStreamBase({ port: "8080" }) === "",
  base.api.xtreamStreamBase({ port: "8080" }));
check("server_info: port wpisany juz w url nie jest dublowany",
  base.api.xtreamStreamBase({ url: "s.example.com:25461", port: "25461", server_protocol: "http" }) === "http://s.example.com:25461",
  base.api.xtreamStreamBase({ url: "s.example.com:25461", port: "25461", server_protocol: "http" }));

const endpoint = base.api.xtreamEndpoint(profile, "", "https://host:443");
check("adres logowania idzie pod wskazany serwer (probny schemat), nie pod profil",
  endpoint === "https://host:443/player_api.php?username=u%20ser&password=p%40ss%26word", endpoint);
check("akcja panelu dopisana na koncu (kategorie, kanaly)",
  base.api.xtreamEndpoint(profile, "action=get_live_streams", "http://host:80")
    .indexOf("&action=get_live_streams") > 0);

/* --- 2. logowanie -------------------------------------------------------- */

function flush() {
  return new Promise(function (done) { setImmediate(function () { setImmediate(done); }); });
}

const OK_INFO = { user_info: { auth: 1, status: "Active" } };

/* mapa: adres serwera -> odpowiedz panelu; brak adresu = blad sieci */
function respond(map) {
  return function (url) {
    const href = url.split("/player_api.php")[0];
    const value = map[href];
    if (typeof value === "function") return value(url);
    if (value === undefined) return Promise.reject(new Error("network"));
    return Promise.resolve(value);
  };
}

(async function () {
  /* 1. panel odpowiada pod adresem z profilu */
  let h = harness({ server: "host:80", fetch: respond({ "http://host:80": OK_INFO }) });
  let result = await h.api.xtreamLogin(h.api.profile);
  check("logowanie: panel pod wpisanym adresem, profil bez zmian, bez zapisu",
    result && result.user_info && result.user_info.auth === 1 &&
    h.api.profile.xtreamServer === "host:80" && h.saved.length === 0 && h.calls.length === 1,
    JSON.stringify({ calls: h.calls.length, server: h.api.profile.xtreamServer }));

  /* 2. port 443 z https - adres poprawiony, kanaly dostana https */
  h = harness({ server: "host:443", fetch: respond({ "https://host:443": OK_INFO }) });
  result = await h.api.xtreamLogin(h.api.profile);
  check("logowanie: host:443 idzie po https (z tego adresu powstaja kanaly)",
    h.calls[0].indexOf("https://host:443/player_api.php") === 0, h.calls[0]);
  check("logowanie: udane https zostawia profil z normalnym adresem (bez zapisu)",
    !!result && h.api.profile.xtreamServer === "host:443" && h.saved.length === 0);

  /* 2b. server_info: strumienie stoja pod innym adresem niz panel */
  h = harness({ server: "host:80", fetch: respond({
    "http://host:80": {
      user_info: { auth: 1, status: "Active" },
      server_info: { url: "stream.example.com", port: "8080", server_protocol: "http" }
    }
  }) });
  result = await h.api.xtreamLogin(h.api.profile);
  check("logowanie: server_info trafia do profilu (kanaly ida po adres strumieni)",
    !!result && h.api.profile.xtreamStreamServer === "http://stream.example.com:8080" &&
    h.saved.length === 1 && h.api.profile.xtreamServer === "host:80",
    JSON.stringify({ stream: h.api.profile.xtreamStreamServer, panel: h.api.profile.xtreamServer }));

  /* 3. pierwszy schemat nie odpowiada -> proba pod drugim i zapamietanie go */
  h = harness({ server: "host:8080", fetch: respond({ "https://host:8080": OK_INFO }) });
  result = await h.api.xtreamLogin(h.api.profile);
  check("logowanie: po bledzie sieci aplikacja probuje drugiego schematu",
    h.calls.length === 2 && h.calls[0].indexOf("http://host:8080") === 0 &&
    h.calls[1].indexOf("https://host:8080") === 0, JSON.stringify(h.calls));
  check("logowanie: dzialajacy schemat trafia do profilu i jest zapisany",
    h.api.profile.xtreamServer === "https://host:8080" && h.saved.length === 1,
    h.api.profile.xtreamServer);

  /* 4. zle haslo: odpowiedz panelu, wiec bez proby drugiego schematu */
  h = harness({ server: "host:443", fetch: respond({ "https://host:443": { user_info: { auth: 0 } } }) });
  const authError = await h.api.xtreamLogin(h.api.profile).then(function () { return null; },
    function (error) { return error; });
  check("logowanie: zle haslo to od razu komunikat o danych, bez drugiej proby",
    !!authError && authError.message.indexOf("err_xtream_auth") === 0 && h.calls.length === 1,
    authError ? authError.message : "brak bledu");

  /* 5. panel nie odpowiada pod zadnym schematem */
  h = harness({ server: "host:443", fetch: respond({}) });
  const downError = await h.api.xtreamLogin(h.api.profile).then(function () { return null; },
    function (error) { return error; });
  check("logowanie: brak odpowiedzi pokazuje oba wyprobowane adresy i podpowiedz o porcie",
    !!downError && downError.message.indexOf("err_xtream_unreachable") === 0 &&
    downError.message.indexOf("https://host:443") > 0 &&
    downError.message.indexOf("http://host:443") > 0,
    downError ? downError.message : "brak bledu");

  /* 6. konto nieaktywne */
  h = harness({
    server: "host:80",
    fetch: respond({ "http://host:80": { user_info: { auth: 1, status: "Expired" } } })
  });
  const expiredError = await h.api.xtreamLogin(h.api.profile).then(function () { return null; },
    function (error) { return error; });
  check("logowanie: nieaktywne konto mowi o dacie waznosci",
    !!expiredError && expiredError.message.indexOf("err_xtream_inactive") === 0 &&
    expiredError.message.indexOf("Expired") > 0,
    expiredError ? expiredError.message : "brak bledu");

  /* 7. cisza: pierwszy adres nie odpowiada wcale (limit czasu), drugi dziala */
  h = harness({
    server: "host:443",
    fetch: function (url) {
      if (url.indexOf("https://") === 0) return new Promise(function () {});
      return Promise.resolve(OK_INFO);
    }
  });
  result = await h.api.xtreamLogin(h.api.profile);
  check("logowanie: milczenie https nie blokuje proby http (limit czasu)",
    !!result && h.calls.length === 2 && h.calls[1].indexOf("http://host:443") === 0 &&
    h.api.profile.xtreamServer === "http://host:443", JSON.stringify(h.calls));
  await flush();

  /* --- 3. interfejs: podglad hasla i Enter w polach --------------------- */

  const toggle = /<button[^>]*id="xtreamPassToggle"[^>]*>/.exec(html);
  check("index.html: przycisk podgladu hasla to <button> z tabindex (pilot do niego dojedzie)",
    !!toggle && toggle[0].indexOf('tabindex="0"') > 0 &&
    toggle[0].indexOf('type="button"') > 0 && toggle[0].indexOf('aria-pressed="false"') > 0,
    toggle ? toggle[0] : "brak przycisku");
  check("index.html: przycisk stoi w wierszu z polem hasla (field-row), nie osobna linia",
    /<label[^>]*class="field-with-toggle"[\s\S]{0,400}class="field-row"[\s\S]{0,400}id="xtreamPass"/.test(html));
  check("index.html: pole hasla zostaje na poczatku ukryte (type=password)",
    /<input[^>]*id="xtreamPass"[^>]*type="password"/.test(html));
  check("index.html: przycisk podgladu ma napis ze slownika (data-i18n=show_password)",
    !!toggle && toggle[0].indexOf('data-i18n="show_password"') > 0);

  check("styles.css: przycisk podgladu ma wlasny wyglad (field-toggle)",
    /\.settings-card \.field-toggle \{[^}]*min-height: 58px/.test(css));
  check("styles.css: wlaczony podglad jest podswietlony (aria-pressed=true)",
    /\.settings-card \.field-toggle\[aria-pressed="true"\] \{[^}]*background: var\(--grad\)/.test(css));
  check("styles.css: tryb TV powieksza przycisk podgladu",
    /body\.uimode-tv \.settings-card \.field-toggle \{[^}]*font-size: 22px/.test(css));

  check("app.js: klik przelacza tylko typ pola (wartosc hasla zostaje)",
    /\$\("xtreamPassToggle"\)\.onclick = function \(\) \{[\s\S]{0,400}setPasswordVisible\(shown\)/.test(src));
  check("app.js: po podgladzie fokus wraca do pola (klawiatura otwiera sie od razu)",
    /\$\("xtreamPassToggle"\)\.onclick = function \(\) \{[\s\S]{0,600}focusField\(input\)/.test(src));
  check("app.js: haslo wraca ukryte przy wczytaniu profilu",
    /function loadProfileIntoForm[\s\S]{0,1200}setPasswordVisible\(false\)/.test(src));
  check("app.js: zmiana jezyka poprawia napis na przycisku (syncPasswordToggle)",
    /function applyTranslations[\s\S]{0,1400}syncPasswordToggle\(\)/.test(src));

  check("app.js: Enter w polu ustawien szuka nastepnego pola (focusNextSettingsField)",
    src.indexOf("function focusNextSettingsField(field) {") > 0 &&
    src.indexOf("focusNextSettingsField(field);") > 0);
  check("app.js: Enter dziala tylko w karcie ustawien (pole szukania bez zmian)",
    /\$\("settingsScreen"\)\.classList\.contains\("hidden"\)[\s\S]{0,120}\$\(\"settingsScreen\"\)\.contains\(field\)/.test(src));
  check("app.js: nastepne pole pomija ptaszki i pola ukryte (isTextField, offsetParent)",
    /function nextSettingsField\(field\)[\s\S]{0,600}isTextField\(item\)/.test(src) &&
    /function nextSettingsField\(field\)[\s\S]{0,400}offsetParent === null/.test(src));
  check("app.js: z ostatniego pola Enter schodzi do nastepnego wiersza (focusNearest)",
    /function focusNextSettingsField\(field\)[\s\S]{0,400}focusNearest\(40\)/.test(src));

  const plPart = src.slice(src.indexOf("var I18N_PL"), src.indexOf("var I18N_EN"));
  const enPart = src.slice(src.indexOf("var I18N_EN"), src.indexOf("var I18N = {"));
  ["show_password", "hide_password", "err_xtream_unreachable"].forEach(function (key) {
    check("app.js: napis " + key + " jest po polsku i po angielsku",
      plPart.indexOf(key + ":") > 0 && enPart.indexOf(key + ":") > 0);
  });

  if (fails > 0) {
    console.log("\n" + fails + " sprawdzen nie przeszlo.");
    process.exit(1);
  }
  console.log("\nWszystkie sprawdzenia przeszly.");
})();
