# TeleIPTV — LG webOS

To repozytorium buduje **wyłącznie paczkę na LG webOS (`.ipk`)**, pakowaną przez
`ares-cli`. Wydanie na Android TV, Google TV i Amazon Fire TV (`.apk`: WebView +
Capacitor) ma własne repozytorium —
[keczup21/teleiptv](https://github.com/keczup21/teleiptv). Do wersji 2.1.13 oba
wydania powstawały z jednego kodu w jednym repozytorium; od 2.1.14 rozwijają się
osobno, więc zmiany tutaj dotyczą tylko telewizora LG.

> Do wersji 1.22.0 aplikacja nazywała się **OpenIPTV**. Tożsamość paczki
> (`pl.openiptv.player`) się nie zmieniła, więc wersja 2.0.0 weszła jako
> zwykła aktualizacja — profile, ustawienia i ulubione zostają na urządzeniu.

Odtwarzacz na telewizor LG (M3U, EPG/XMLTV, panele Xtream Codes):

- źródła: link M3U, plik M3U albo login Xtream (serwer, użytkownik, hasło),
- program TV (siatka wszystkich kanałów kategorii na osi czasu, z pionową linią
  bieżącej godziny i podpisem `LIVE` przy tym, co leci) i mini-EPG na karcie
  kanału,
- catch-up/archiwum: programy z przeszłości odtwarzane z adresu liczonego
  ze znaczników czasu; przycisk `EPG` na pasku odtwarzacza otwiera listę
  programów oglądanego kanału — poprzednie, bieżący i następne — z której
  wybiera się materiał do odtworzenia, a `Na żywo` wraca do bieżącej chwili,
- ulubione, ostatnio oglądane, wyszukiwarka, profile źródeł,
- ustawienia w trzech zakładkach: **Ogólne** (sama aplikacja), **Aktualizacja**
  (tylko wydania) i **Instrukcja** (poradnik obsługi pilota),
- interfejs po polsku i angielsku, motyw jasny i ciemny, tryb TV z obsługą
  pilota oraz wspólna obsługa klawisza Wstecz (z pytaniem o wyjście zamiast
  zamykania aplikacji z przypadku),
- rozmiar interfejsu dobierany do rozdzielczości ekranu (720p / 1080p / 4K)
  albo wybierany ręcznie w 100–150% — dla czytelności z dużej odległości,
- aktualizacja bez przymusu: ustawienia tylko pokazują, że jest nowsza wersja
  i krótko co się zmieniło, a aktualizację uruchamia przycisk,
- zegar w rogu obrazu: włączany w ustawieniach, pokazuje godzinę `HH:MM`
  w lewym górnym rogu, ale tylko podczas oglądania programu.

## Rozmiar interfejsu

Projekt układu ma 1920 px szerokości, a przeglądarka telewizora skaluje go do
ekranu — dzięki temu ten sam kod obsługuje 720p, 1080p i 4K. Żeby litery były
czytelne z kanapy, aplikacja wykrywa rozdzielczość ekranu (px CSS ekranu ×
gęstość) i sama dobiera wielkość układu (`www/ui-scale.js`):

| Ekran | Skala automatyczna | Układ |
|---|---|---|
| 720p i mniejsze | 140% | 1371 px |
| 1080p | 100% | 1920 px |
| 4K | 100% | 1920 px |

W **Ustawieniach** (zakładka **Ogólne**) jest lista **Rozmiar interfejsu** —
Automatyczny, 100%, 115%, 130% i 150% — a pod nią informacja, co aplikacja
wykryła (np. „Wykryty ekran:
1920×1080 px, gęstość 2.0× — układ 1920 px, skala 100%”). Skala obowiązuje od
razu: szerokość układu ustawia się jeszcze przed pierwszym rysowaniem strony,
a gdy telewizor zmieni rozdzielczość w trakcie pracy, układ przelicza się sam.
W przeglądarce na komputerze skalę robi zoom CSS.

## Zegar w rogu obrazu

W **Ustawieniach** (zakładka **Ogólne**) jest przełącznik **Zegar w rogu
obrazu**. Włączony pokazuje godzinę w formacie `HH:MM` w lewym górnym rogu
i tylko podczas oglądania programu:

| Gdzie jesteś | Zegar |
|---|---|
| odtwarzacz z kanałem (na żywo, archiwum, pauza) | widoczny w lewym górnym rogu |
| lista kanałów, program TV, ustawienia | schowany |

Domyślnie jest wyłączony — włącza go ten, kto chce. Zegar nie łapie kliknięć ani
fokusu (`pointer-events: none`), więc pilot dalej chodzi po obrazie, a budzik
przelicza się raz na pełną minutę (między tyknięciami nic nie chodzi). Po powrocie
do aplikacji z tła zegar od razu pokazuje właściwą godzinę.

## Ustawienia: trzy zakładki

Karta ustawień rosła razem z aplikacją i wszystko trafiało do jednej, długiej
listy — instrukcja pilota stała między polami formularza. Teraz na górze karty
jest pasek zakładek, a pilot zmienia zakładkę strzałkami `◀` `▶` (`▼` wchodzi
w treść, `OK` też przełącza):

| Zakładka | Co trzyma |
|---|---|
| **Ogólne** | wszystko o samej aplikacji: profil i źródło (M3U / plik / Xtream), adres EPG, odświeżanie EPG, archiwum i odtwarzanie, wygląd, język i rozmiar interfejsu |
| **Aktualizacja** | tylko wydania: numer nowszej wersji, co się zmieniło i przyciski `Sprawdź aktualizacje` / `Pobierz i zainstaluj` |
| **Instrukcja** | poradnik obsługi: źródło kanałów, poruszanie się po aplikacji, pilot w odtwarzaczu, program TV, archiwum i telefon |

Przyciski `Zapisz i pobierz` oraz `Wstecz` są widoczne w każdej zakładce —
`Wstecz` wychodzi z ustawień bez zapisu.

## Pilot w odtwarzaczu

Podczas oglądania kanału (na żywo i w archiwum) pilot działa jak w telewizorze —
bez wchodzenia fokusem w przyciski:

| Klawisz | Co robi |
|---|---|
| `▲` `▼` (CH+ / CH−) | następny / poprzedni kanał z listy, którą widzisz (z kategorii, wyszukiwania), z zawijaniem na końcach |
| `◀` `▶` / `⏪` `⏩` | przewijanie o krok z ustawień; w archiwum skok, na kanale na żywo `⏪` wchodzi w catch-up, a `▶` na zatrzymanym obrazie wznawia od miejsca pauzy. Po skoku komunikat („Cofnięto o 10 s” / „Przesunięto o +10 s”) widać na środku obrazu — nie tylko w pasku, który po chwili sam się chowa; kolejne naciśnięcia pod rząd sumują się (5 × `⏩` = „Przesunięto o +50 s”) |
| `OK` | pokaż / schowaj pasek informacyjny (mini-EPG kanału); zaraz po otwarciu `▲` `▼` wchodzą w jego przyciski |
| `OK` przytrzymane, `MENU` | opcje kanału i obrazu (od początku, poprzedni/następny program, na żywo, cisza, EPG, ulubione) |
| `⏵` `⏸` / `⏹` | pauza i wznowienie. Po dłuższej pauzie kanał na żywo jest wznawiany z archiwum dokładnie od chwili zatrzymania (jeśli kanał ma archiwum), a nie od bieżącej sceny |
| `🔇` | cisza / dźwięk (wyciszenie strumienia; głośność telewizora należy do sprzętu) |
| `Wstecz` | najpierw zamyka otwarty pasek; gdy nic nie jest otwarte, obraz wraca do listy kanałów, a na liście pokazuje pytanie „Wyjdź z aplikacji?” — dopiero tam wyjście kończy aplikację |

`⏵‖` to jeden przycisk, a dekodery wysyłają go różnymi kodami (`85`, `126`,
`415`…) i część z nich zjada go dla własnej sesji multimediów. Aplikacja
obsługuje kody i nazwy tych klawiszy, rejestruje akcje w sesji multimediów,
łapie klawisz też na zwolnieniu, a na Android TV / Fire TV `MainActivity`
oddaje go stronie, gdy na ekranie jest odtwarzacz — dlatego play/pauza działa
także na pilotach, na których wcześniej milczał.

Przewijanie ma tę samą drogę: `⏪` `⏩` pilota rozpoznajemy po kodach i nazwach
(webOS `412`/`417`, Android TV i Fire TV `89`/`90`, a na części pilotów klawisze
„poprzedni / następny” `87`/`88`), więc skok działa też na pilotach, które
wysyłają przewijanie dopiero na zwolnieniu klawisza — jedno naciśnięcie liczy
się jednak raz.

Pasek na dole obrazu pokazuje to, co da się zrobić w danym momencie:
`Pauza`/`Wznów`, `Od początku`, `◀ Poprzedni` i `Następny ▶` (w archiwum),
`EPG`, `Na żywo` (gdy obraz nie jest na żywo), `Wycisz` i `ⓘ Diagnostyka`.
Menu opcji kanału i wyjście do listy są poza paskiem na telewizorze — tam są
pod `MENU` / trzymanym `OK` i pod klawiszem `Wstecz`, więc nie dublują się na
ekranie. Na telefonie i tablecie oba te przyciski zostają na pasku, bo tam nie
ma pilota.

`ⓘ Diagnostyka` pokazuje nad obrazem, co widzi odbiornik: system i przeglądarkę
wbudowaną, kodeki, które ten odtwarzacz potrafi rozebrać, stan elementu obrazu
(gotowość, wymiary klatki, liczba klatek) oraz co naprawdę nadaje dostawca
(manifest HLS). Panel otwiera się też sam, gdy dźwięk już leci, a obrazu nie ma
ani jednej klatki — to jedyny przypadek, w którym wchodzi w drogę; gdy obraz
się pojawi, schodzi sam. Treść przewija się strzałkami, a `Wstecz` zamyka panel
jako pierwszy.

Pasek otwarty klawiszem `OK` to menu: `▲` `▼` wchodzą wtedy w jego przyciski
(`⏸ Pauza`, `📅 EPG`…), a `◀` `▶` chodzą po nich. Z paska wychodzi się `▲` `▼`
albo `Wstecz`, który najpierw zamyka pasek, a dopiero potem wychodzi z kanału.
Pasek pokazany przy zmianie kanału jest tylko informacją i po chwili znika sam —
`▲` `▼` dalej przełączają kanały, więc `CH+` działa naciśnięcie po naciśnięciu.
Długie przytrzymanie `▲` `▼` nie przełącza kanałów seriami: jedno naciśnięcie = jedna zmiana.
Fokus z myszy albo dotyku na przycisku paska działa tak samo — strzałki chodzą
wtedy po pasku, a `▲` `▼` z obrazu zostają przy kanałach.

Ta sama instrukcja jest w aplikacji, na telewizorze:
**Ustawienia → zakładka „Instrukcja”** (tabele klawiszy po polsku i angielsku,
razem z krótkim opisem każdej akcji).

**Wyjście z aplikacji** (`Wstecz` na liście kanałów) potwierdza się przyciskiem.
Na webOS aplikację kończy platforma, a w zwykłej przeglądarce zostaje podpowiedź,
że okno zamyka użytkownik. `Wstecz` w ustawieniach wychodzi **bez zapisu**.

## Pilot na liście kanałów (menu główne)

Lista kanałów to ekran startowy: z boku grupy, obok kanały, u góry szukanie,
`EPG`, odświeżanie i ustawienia. Pod listą jest pasek przypominający klawisze
pilot, a fokus chodzi po przyciskach jak po stronie — bez myszki:

| Klawisz | Co robi |
|---|---|
| `◀` `▲` `▼` `▶` | przejście do najbliższego przycisku w tym kierunku (grupy, kanały, pasek u góry) |
| `OK` | wybór: na grupie pokazuje jej kanały i od razu wchodzi w listę, na kanale włącza obraz |
| `OK` przytrzymane, `MENU` | opcje kanału (ulubione, archiwum, program TV, od początku, cisza) |

Grupa zmienia się **tylko po naciśnięciu `OK`** — samo dojechanie fokusem na
przycisk grupy nie przełącza już listy kanałów, więc przewijanie kanałów nie
przerzuca na inną kategorię. Po wczytaniu playlisty (i po zapisaniu ustawień)
fokus wchodzi od razu w listę kanałów — nigdy w pole szukania, żeby na
telewizorze nie wyskakiwała z niego klawiatura ekranowa.

Z pola **Szukaj** też da się wyjść: `▼` przechodzi do listy kanałów, `▶` przy
końcu wpisanego tekstu do następnego pola paska, a `◀` — gdy kursor stoi na
początku zapytania — do listy grup. W środku tekstu `◀` `▶` przesuwają kursor,
więc zapytanie poprawia się jak na komputerze.

Ikony przycisków (zębatka, odświeżanie, pasek odtwarzacza, gwiazdki ulubionych)
są rysowane jako SVG, a nie znakami emoji: na dekoderach telewizyjnych czcionka
emoji bywa okrojona i z ikony zostawała kropka. Przycisk programu TV to sam
napis `EPG`, a nagrania otwiera się z opcji kanału (`OK` przytrzymane / `MENU`).
Podpowiedź pilota pod listą to pasek z tłem, a nie szary tekst położony na
kanałach.

## Plik M3U i EPG z pamięci

Rodzaj źródła wybiera się w **Ustawieniach** (zakładka **Ogólne**), przyciskami
**Link do M3U**, **Plik M3U** i **Xtream (login)** — wszystkie pozycje widać
naraz, a wybrana jest podświetlona kolorem. Rozwijana lista systemowa odpadała,
bo na telewizorze rysowała się ciemno na ciemnym i nie było widać, co jest
zaznaczone.

Playlistę i program TV można też wskazać plikiem z pamięci urządzenia albo
z karty USB — w **Ustawieniach** (zakładka **Ogólne**), przyciskami
**„Wybierz plik M3U”** i **„Wybierz plik EPG”**. Na każdej platformie robi to
coś innego:

| Platforma | Co się dzieje po naciśnięciu |
|---|---|
| przeglądarka, telefon | otwiera się systemowe okno wyboru plików |
| LG webOS | systemowego okna nie ma, więc jest podpowiedź, czym zastąpić plik |

Na Android TV i Fire TV ten sam przycisk prowadzi przez własną listę katalogów
z natywnego pluginu `OpenIptvFiles` — to kod z repozytorium
[teleiptv](https://github.com/keczup21/teleiptv), bo paczka `.apk` powstaje tam.

Plik EPG czytany jest binarnie, a GZIP rozpoznawany po nagłówku — spakowany plik
o nazwie `.xml` też się rozpakuje.

## Pobieranie

Gotowa paczka `.ipk` leży w
[wydaniach tego repozytorium](https://github.com/keczup21/teleiptv-webos/releases),
a `<wersja>` w nazwie pliku to numer z `package.json`:

| Plik | System |
|---|---|
| `TeleIPTV-<wersja>.ipk` | LG webOS |

Paczka na Android TV / Google TV / Fire TV (`.apk`) jest w
[keczup21/teleiptv](https://github.com/keczup21/teleiptv/releases).

Wydania są developerskie: `npm run build:webos` składa paczkę od razu po
sklonowaniu repozytorium — nic nie trzeba przygotowywać poza nim.

Adres `.../releases/latest` zawsze prowadzi do najnowszego wydania, a numer
wersji i pełna lista zmian są w `CHANGELOG.md`. Wpis w changelogu jest krótki
i dotyczy tylko funkcji aplikacji — tego, co widać na ekranie — bez testów
i skryptów wydania. Opis wydania (to, co widać na GitHubie jako „co nowego”)
wycina z `CHANGELOG.md` generator `scripts/release-notes.js` (`npm run notes`)
— tylko sekcję wydawanej wersji, bez zmian z poprzednich wydań. Kolejne wydanie
tworzy `scripts/publish.ps1` z przełącznikiem `-Release`: robi commit, buduje
paczkę (`npm run build:webos`),
sam generuje opis i tworzy wydanie tylko z tym plikiem — brak gotowej paczki
przerywa publikację. Uwaga: przez npm argumenty podaje się po separatorze `--`,
bo inaczej npm „zjada” `-Tag` / `-Release` jako swoje flagi (skrypt to wychwytuje
i odmawia, gdy tag nie wygląda jak `vX.Y.Z`):

```powershell
npm run publish -- -Message "wersja 1.19.0" -Tag v1.19.0 -Release
# własny opis wydania zamiast z CHANGELOG.md: dodatkowo -Notes C:\sciezka\opis.md
```

Ręcznie to samo robi `gh release create`, z jawnie wskazaną paczką i opisem:

```powershell
gh release create vX.Y.Z dist\ipk\TeleIPTV-X.Y.Z.ipk --title "TeleIPTV X.Y.Z (LG webOS)" --notes-file dist\release-notes-X.Y.Z.md
```

### Numeracja wersji

Numer wersji jest zapisany w trzech miejscach — `www/app.js` (`APP_VERSION`),
`www/appinfo.json` i `package.json` — a podbija je jedna komenda, żeby żadne
miejsce nie zostało ze starą wersją:

```powershell
npm run bump -- 1.20.0   # gruba zmiana: nowa funkcja, przebudowa
npm run bump -- 1.19.1   # poprawka albo drobiazg
```

Zasada: **gruba zmiana** podbija środkową liczbę (`1.19.0 → 1.20.0`), a **bugfix
albo drobiazg** ostatnią (`1.19.0 → 1.19.1`). Skrypt wypisuje podbite miejsca
i przypomina, że nowy numer ma dostać wpis w `CHANGELOG.md`. Numer musi rosnąć —
telewizor porównuje go z numerem wydania na GitHubie, więc cofnięcie numeru
zepsułoby podpowiedź o aktualizacji.

## Struktura

```
TeleIPTV (webOS)/
├─ www/                     kod aplikacji (edytuj tylko tutaj)
│  ├─ index.html app.js styles.css ui-scale.js
│  ├─ epg-worker.js         parser XMLTV poza wątkiem UI (fallback: app.js)
│  ├─ appinfo.json          manifest webOS (id, wersja, ikony, kolor tła)
│  ├─ icon.png icon.svg largeicon.png
│  └─ lib/                  hls.min.js, mpegts.min.js, pako.min.js (ładowane leniwie)
├─ webos-service/           natywny serwis webOS (pobieranie bez CORS)
├─ scripts/
│  ├─ build-webos.ps1       www/ + webos-service/ → .ipk
│  ├─ make-icons.ps1        ikony aplikacji webOS: www/icon.png, largeicon.png, icon.svg
│  ├─ test-*.js             testy bez telewizora (npm test)
│  └─ publish.ps1           commit + push, opcjonalnie z tagiem i wydaniem (-Release)
├─ package.json
└─ CHANGELOG.md
```

## Wymagania

- Node.js 18+ i npm.
- `npm install -g @webos-tools/cli` (daje `ares-package` i `ares-install`).

Paczka `.apk` (Android TV / Google TV / Fire TV) potrzebuje JDK 17 i Android SDK
— to opisuje [README repozytorium teleiptv](https://github.com/keczup21/teleiptv).

## Build — webOS (.ipk)

```powershell
npm install
npm run build:webos
# wynik: dist\ipk\TeleIPTV-<wersja>.ipk
```

`ares-package` nazywa wynik `pl.openiptv.player_<wersja>_all.ipk` (`all`, bo to
czysta aplikacja web) — skrypt zmienia nazwę na `TeleIPTV-<wersja>.ipk`.
Urządzenie czyta `appinfo.json` z wnętrza paczki, więc nazwa pliku nie ma znaczenia.

Instalacja na TV (tryb deweloperski + `ares-setup-device`):

```powershell
ares-install -d <device> dist\ipk\TeleIPTV-<wersja>.ipk
ares-launch  -d <device> pl.openiptv.player
```

## Build — Android (.apk)

Paczka `.apk` nie powstaje z tego repozytorium — składa ją repozytorium
[teleiptv](https://github.com/keczup21/teleiptv) (Capacitor + Gradle; instalacja
przez `adb install -r`). Tutaj buduje się wyłącznie `.ipk` z `www/`
i `webos-service/`.

## Strona projektu

Strona projektu (`docs/`, GitHub Pages pod `https://keczup21.github.io/teleiptv/`)
mieszka w repozytorium [teleiptv](https://github.com/keczup21/teleiptv) — tutaj
nie ma jej kopii, żeby adres strony i `canonical` zostały w jednym miejscu.

Repozytorium nazywa się `teleiptv-webos`. Nazwa jest potrzebna w dwóch miejscach:
`UPDATE_REPO` w `www/app.js` (sprawdzanie aktualizacji na webOS chodzi przez
natywny serwis, który nie podąża za przekierowaniami) oraz `name`
w `package.json`. Po zmianie nazwy repozytorium trzeba ją podmienić w tych dwóch
miejscach.

Strona projektu i jej adres (`https://keczup21.github.io/teleiptv/`, wraz
z wpisem w Google Search Console i plikami `docs/`) zostały w repozytorium
[teleiptv](https://github.com/keczup21/teleiptv), żeby strona i `canonical`
były w jednym miejscu.

## Testy

Bez telewizora i bez emulatora — `npm test` uruchamia wszystkie sześć:

```powershell
npm run test:seek     # przewijanie archiwum, pauza/wznowienie, 🔇 i ▲▼ kanał (www/app.js)
npm run test:update   # porównanie wersji i wybór paczki .ipk
npm run test:ui       # skalowanie interfejsu (www/ui-scale.js)
npm run test:pick     # wybór pliku M3U/EPG: przyciski, ścieżki natywne, błędy odczytu
npm run test:nav      # menu główne i ustawienia: zakładki, ikony SVG, pasek odtwarzacza, klawisze multimedialne
npm run test:notes    # opis wydania: tylko wydawana wersja, bez ogona z poprzednich
```

Testy czytają prawdziwe pliki z repozytorium (wyciągają funkcje z `www/app.js`,
a PNG czytają własnym kodem), więc nie trzymają kopii logiki, która mogłaby się
rozjechać z aplikacją.

## Aktualizacja z aplikacji

Aktualizacja nigdy nie dzieje się sama. Wejście w **Ustawienia** (zakładka
**Aktualizacja**) sprawdza cicho wydanie na GitHubie (`releases/latest`) i — gdy jest
nowsze od `APP_VERSION` — pokazuje tylko informację: numer wersji i krótko, co się
zmieniło (pierwsze punkty opisu wydania). Nic nie pobiera się w tle, a instalację
uruchamia dopiero naciśnięcie przycisku `Pobierz i zainstaluj`. Przycisk
`Sprawdź aktualizacje` robi to samo na żądanie i pokazuje też błędy, np. brak
internetu.

- **Android TV / Google TV / Fire TV** — to wydanie jest w repozytorium
  [keczup21/teleiptv](https://github.com/keczup21/teleiptv): ono sprawdza
  aktualizacje w swoim repozytorium, a `Pobierz i zainstaluj` bierze stamtąd
  paczkę `.apk` (szczegóły w tamtejszym README).
- **LG webOS** — system nie instaluje `.ipk` sam, więc aplikacja pokazuje
  numer wersji, nazwę paczki i adres wydania; paczkę wgrywa się z komputera
  (`ares-install`, sekcja „Build — webOS”).
- **przeglądarka** (`npm run serve`) — zostaje sam komunikat o nowszej wersji.

