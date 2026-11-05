![](https://private-user-images.githubusercontent.com/352896854/696294542-6381ee31-8164-4939-a473-4652b313e7a6.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3OTM4ODk3MzksIm5iZiI6MTc5Mzg4OTQzOSwicGF0aCI6Ii8zNTI4OTY4NTQvNjk2Mjk0NTQyLTYzODFlZTMxLTgxNjQtNDkzOS1hNDczLTQ2NTJiMzEzZTdhNi5wbmc_WC1BbXotQWxnb3JpdGhtPUFXUzQtSE1BQy1TSEEyNTYmWC1BbXotQ3JlZGVudGlhbD1BS0lBVkNPRFlMU0E1M1BRSzRaQSUyRjIwMjYxMTA1JTJGdXMtZWFzdC0xJTJGczMlMkZhd3M0X3JlcXVlc3QmWC1BbXotRGF0ZT0yMDI2MTEwNVQxNDM3MTlaJlgtQW16LUV4cGlyZXM9MzAwJlgtQW16LVNpZ25hdHVyZT1mMzMyZmZkNWFjMmIxNGZjMTQyOTc2ZjY0YjgwZDZmMzIzMGJiMmQ1Mzg4MjFhNTUzNmUwODQ4MmUwZDlkNWI5JlgtQW16LVNpZ25lZEhlYWRlcnM9aG9zdCZyZXNwb25zZS1jb250ZW50LXR5cGU9aW1hZ2UlMkZwbmcifQ.6XFYMHXp7QX0jS-kKbUDm9HZTDXeRs6xF2oow0n8rSg)
# TimeSpoofer

TimeSpoofer is a Manifest V3 extension for Chromium-based browsers. It changes selected values exposed to websites through JavaScript and network requests.

![TimeSpoofer Timezone spoofer features](https://private-user-images.githubusercontent.com/352896854/696294778-04bacb97-04fc-440b-929d-e42c37930835.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3OTM4ODk3MzksIm5iZiI6MTc5Mzg4OTQzOSwicGF0aCI6Ii8zNTI4OTY4NTQvNjk2Mjk0Nzc4LTA0YmFjYjk3LTA0ZmMtNDQwYi05MjlkLWU0MmMzNzkzMDgzNS5wbmc_WC1BbXotQWxnb3JpdGhtPUFXUzQtSE1BQy1TSEEyNTYmWC1BbXotQ3JlZGVudGlhbD1BS0lBVkNPRFlMU0E1M1BRSzRaQSUyRjIwMjYxMTA1JTJGdXMtZWFzdC0xJTJGczMlMkZhd3M0X3JlcXVlc3QmWC1BbXotRGF0ZT0yMDI2MTEwNVQxNDM3MTlaJlgtQW16LUV4cGlyZXM9MzAwJlgtQW16LVNpZ25hdHVyZT01YTRiNzM4MTc5MWE0MzcxMmM1MzRmYmM2MTFiMzlmYjI4MjFiNmM3NTEyMzZhOTA5YWNmMzRlMzA5MDhhOTU2JlgtQW16LVNpZ25lZEhlYWRlcnM9aG9zdCZyZXNwb25zZS1jb250ZW50LXR5cGU9aW1hZ2UlMkZwbmcifQ.ekI0r3d03ezbweULK49yW0JxmapfLP7jz8na6bTudPM)

## Features

- IANA timezone selection, for example `Europe/Berlin`;
- UTC offset displayed next to each timezone;
- overrides for local `Date` operations and `Intl` formatting;
- browser language selection;
- `navigator.language` and `navigator.languages` overrides;
- `Accept-Language` request-header rewriting through `declarativeNetRequest`;
- selectable reported `navigator.deviceMemory`;
- selectable `navigator.hardwareConcurrency`;
- a global enable/disable switch;

The extension does not use the Chrome Debugger API and does not show the DevTools debugging notification.

## Installation

1. Open `chrome://extensions` or the equivalent extensions page in your Chromium-based browser.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose the repository root folder.
5. Open the extension popup, enable **Enable spoofing**, choose the settings, and press **Apply settings**.

After changing the language, open HTTP(S) tabs may need to be reloaded so that new requests carry the updated `Accept-Language` header.

## Limitations of the non-Debugger mode

The non-Debugger mode does not change Chromium internals. It uses JavaScript injection in the MAIN world and `declarativeNetRequest` network rules.

Therefore:

- only APIs explicitly overridden by the extension are changed;
- servers see network headers while JavaScript sees separate values, so Client Hints may remain native;
- some sites can detect modified properties, descriptors, or prototype chains;
- execution in every iframe and before the very first page script is not guaranteed;
- Workers, Service Workers, WebAssembly, and some sandboxed or cross-origin iframes may retain native values;
- GPU, Canvas, and AudioContext are not spoofed;
- actual system time, server time, `performance.now()`, and network timestamps are not changed;
- unusual RAM or CPU-thread values can themselves become fingerprinting signals;
- restricted browser pages such as `chrome://` and extension-store pages cannot be injected into.

Changing JavaScript language values and `Accept-Language` does not guarantee that every `Sec-CH-UA-*` header changes. An inconsistent combination of language, timezone, IP address, Client Hints, and system properties can make a fingerprint more distinctive.

## Privacy

The extension does not collect or send fingerprints, browsing history, or telemetry to an external server. Settings are stored locally in browser storage.

Website access is required to apply JavaScript overrides and rewrite the `Accept-Language` request header.

## License

The terms of use and redistribution are available in [LICENSE.md](LICENSE.md).


# RU TimeSpoofer

Расширение Manifest V3 для Chromium-based браузеров, которое изменяет отдельные значения, доступные веб-страницам через JavaScript и сетевые запросы.

## Возможности

- выбор IANA часового пояса, например `Europe/Berlin`;
- отображение UTC-смещения рядом с каждой зоной;
- подмена локальных операций `Date` и форматирования `Intl`;
- выбор языка браузера;
- подмена `navigator.language` и `navigator.languages`;
- изменение HTTP-заголовка `Accept-Language` через `declarativeNetRequest`;
- выбор отображаемого объёма `navigator.deviceMemory`;
- выбор `navigator.hardwareConcurrency`;
- глобальное включение и выключение расширения;

Расширение не использует Chrome Debugger API и не показывает уведомление о подключении DevTools.

## Установка

1. Откройте `chrome://extensions` или аналогичную страницу расширений Chromium-браузера.
2. Включите **Developer mode / Режим разработчика**.
3. Нажмите **Load unpacked / Загрузить распакованное расширение**.
4. Выберите корневую папку репозитория.
5. Откройте popup расширения, включите **Enable spoofing**, выберите настройки и нажмите **Apply settings**.

После изменения языка открытые HTTP(S)-вкладки могут потребовать перезагрузки, чтобы новый `Accept-Language` был отправлен в новых запросах.

## Ограничения режима без Debugger

Режим без `debugger` не меняет настройки самого Chromium. Он использует JavaScript-инъекцию в MAIN world и сетевые правила `declarativeNetRequest`.

Из-за этого:

- подмена выполняется только для API, которые расширение явно переопределяет;
- сервер видит сетевые заголовки, а JavaScript видит отдельные значения, поэтому Client Hints могут остаться системными;
- часть сайтов может обнаружить изменённые свойства, дескрипторы или цепочки прототипов;
- раннее выполнение в каждом iframe и до абсолютно первого скрипта страницы не гарантируется;
- Worker, Service Worker, WebAssembly и некоторые sandboxed/cross-origin iframe могут использовать настоящие значения;
- GPU, Canvas и AudioContext не подменяются;
- реальное системное время, серверное время, `performance.now()` и сетевые timestamps не изменяются;
- нестандартный объём RAM или число CPU-потоков может само стать признаком отпечатка;
- ограниченные страницы браузера (`chrome://`, страницы магазина расширений и подобные) недоступны для инъекции.

В частности, изменение языка в JavaScript и `Accept-Language` не гарантирует изменение всех `Sec-CH-UA-*` заголовков. Несогласованная комбинация языка, часового пояса, IP, Client Hints и системных параметров может сделать отпечаток более заметным.

## Privacy

Расширение не собирает, не сохраняет на внешнем сервере и не отправляет fingerprint, историю посещений или иную телеметрию. Настройки хранятся локально в storage браузера.

Разрешение доступа к сайтам необходимо для применения JavaScript-подмен и изменения сетевого заголовка `Accept-Language`.

## Лицензия

Условия использования и распространения находятся в [LICENSE.md](LICENSE.md).


