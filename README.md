![Timezone secure](https://github.com/user-attachments/assets/d301b00e-d302-4c68-bc78-ce5a1dd4c4ef)

# TimeSpoofer

TimeSpoofer is a Timezone spoofing extension for Chromium-based browsers. It changes selected values exposed to websites through JavaScript and network requests, specifically Timezone, browser language, RAM, and CPU threads.

![TimeSpoofer UI](https://github.com/user-attachments/assets/9db6199f-d22e-4dda-82fa-a7fbdbb2a297)


## Features

- IANA timezone selection, for example `Europe/Berlin`;
- overrides for local `Date` operations and `Intl` formatting;
- browser language selection;
- `navigator.language` and `navigator.languages` overrides;
- `Accept-Language` request-header rewriting through `declarativeNetRequest`;
- selectable reported `navigator.deviceMemory`;
- selectable `navigator.hardwareConcurrency`;

## Installation

1. Open `chrome://extensions` or the equivalent extensions page in your Chromium-based browser.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Unpack the archive and select the extension's root folder.
5. Open the extension popup, enable **Enable spoofing**, choose the settings, and press **Apply settings**.

After changing the language, open tabs may need to be reloaded so that new requests carry the updated `Accept-Language` header.

## Extension Limitations

Due to the fact that the extension works without using a debugger, it does not change the settings of the Chromium engine itself.
The extension uses JavaScript injection into the MAIN world and `declarativeNetRequest` network rules.

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

TimeSpoofer — это расширение для браузеров на базе Chromium, предназначенное для подмены часового пояса. Оно изменяет определённые параметры, доступные веб-сайтам через JavaScript и сетевые запросы, а именно: часовой пояс, язык браузера, объём оперативной памяти и количество потоков процессора.

## Возможности

- выбор IANA часового пояса, например `Europe/Berlin`;
- подмена локальных операций `Date` и форматирования `Intl`;
- выбор языка браузера;
- подмена `navigator.language` и `navigator.languages`;
- изменение HTTP-заголовка `Accept-Language` через `declarativeNetRequest`;
- выбор отображаемого объёма `navigator.deviceMemory`;
- выбор `navigator.hardwareConcurrency`;

## Установка

1. Откройте `chrome://extensions` или аналогичную страницу расширений Chromium-браузера.
2. Включите **Developer mode / Режим разработчика**.
3. Нажмите **Load unpacked / Загрузить распакованное расширение**.
4. Распакуйте архив и выберите корневую папку расширения.
5. Откройте popup расширения, включите **Enable spoofing**, выберите настройки и нажмите **Apply settings**.

После изменения языка открытые вкладки могут потребовать перезагрузки, чтобы новый `Accept-Language` был отправлен в новых запросах.

## Ограничения функционала расширения

По причине того, что расширение работает без использования отладчика, оно не меняет настройки самого движка Chromium.
Расширение использует JavaScript-инъекцию в MAIN world и сетевые правила `declarativeNetRequest`.

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


