const memoryChoices = [8, 12, 16, 24, 32, 48, 64, 128, 256];
const threadChoices = [2, 4, 6, 8, 12, 16, 20, 24, 32];
const defaults = {
  enabled: false,
  timezone: "UTC",
  language: "en-US",
  deviceMemory: 8,
  hardwareConcurrency: 8
};

void getSettings().then((settings) => updateIcon(settings.enabled));

async function getSettings() {
  return { ...defaults, ...(await chrome.storage.local.get(defaults)) };
}

async function updateIcon(enabled) {
  try {
    await chrome.action.setIcon({
      path: enabled ? {
        16: "icons/timezonesecure-16.png", 32: "icons/timezonesecure-32.png", 48: "icons/timezonesecure-48.png", 128: "icons/timezonesecure-128.png"
      } : {
        16: "icons/timezonesecure-gray-16.png", 32: "icons/timezonesecure-gray-32.png", 48: "icons/timezonesecure-gray-48.png", 128: "icons/timezonesecure-gray-128.png"
      }
    });
    await chrome.action.setTitle({ title: enabled ? "TimeSpoofer — enabled" : "TimeSpoofer — disabled" });
  } catch (_error) {
    // An old extension worker may still be finishing an icon update.
  }
}

async function updateLanguageHeader(settings) {
  const ruleId = 1;
  const removeRuleIds = [ruleId];
  const addRules = [];
  if (settings.enabled) {
    const acceptedLanguages = [settings.language];
    const baseLanguage = settings.language.split("-")[0];
    if (baseLanguage.toLowerCase() !== settings.language.toLowerCase()) {
      acceptedLanguages.push(baseLanguage);
    }
    const headerValue = acceptedLanguages
      .map((language, index) => index === 0 ? language : `${language};q=0.9`)
      .join(",");
    addRules.push({
      id: ruleId,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [{ header: "accept-language", operation: "set", value: headerValue }]
      },
      condition: {
        urlFilter: "|http",
        resourceTypes: ["main_frame", "sub_frame", "stylesheet", "script", "image", "font", "object", "xmlhttprequest", "ping", "csp_report", "media", "websocket", "other"]
      }
    });
  }
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
}

async function injectIntoTab(tabId, settings, frameIds) {
  return chrome.scripting.executeScript({
    target: frameIds ? { tabId, frameIds } : { tabId, allFrames: true },
    world: "MAIN",
    injectImmediately: true,
    func: (settings) => {
      const marker = "__timeSpooferState";
      const current = globalThis[marker];
      if (current) current.restore();
      if (!settings.enabled) {
        delete globalThis[marker];
        return;
      }

      const restorers = [];
      const replace = (object, key, descriptor) => {
        const old = Object.getOwnPropertyDescriptor(object, key);
        restorers.push(() => old ? Object.defineProperty(object, key, old) : delete object[key]);
        Object.defineProperty(object, key, descriptor);
      };
      const replaceValue = (object, key, value) => replace(object, key, { configurable: true, writable: true, value });
      const replaceGetter = (object, key, getter) => {
        const old = Object.getOwnPropertyDescriptor(object, key);
        replace(object, key, { configurable: true, enumerable: old?.enumerable ?? true, get: getter });
      };

      const timezone = settings.timezone;
      const locale = settings.language;
      const NativeDate = Date;
      const NativeDateTimeFormat = Intl.DateTimeFormat;
      const displayZone = timezone;
      const formatter = new NativeDateTimeFormat("en-US", {
        timeZone: displayZone, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
      });
      const localParts = (date) => {
        if (!Number.isFinite(date.getTime())) return null;
        const parts = formatter.formatToParts(date);
        const get = (name) => Number(parts.find((part) => part.type === name).value);
        return { year: get("year"), month: get("month") - 1, day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second"), millisecond: date.getUTCMilliseconds() };
      };
      const offset = (date) => {
        if (!Number.isFinite(date.getTime())) return NaN;
        const parts = new NativeDateTimeFormat("en-US", {
          timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
        }).formatToParts(date);
        const part = (name) => Number(parts.find((item) => item.type === name).value);
        const representedUtc = NativeDate.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"), date.getUTCMilliseconds());
        // Date#getTimezoneOffset is UTC minus local time (negative east of UTC).
        return Math.round((date.getTime() - representedUtc) / 60000);
      };

      const componentsToUtc = (parts) => {
        const date = new NativeDate(0);
        date.setUTCFullYear(parts.year, parts.month, parts.day);
        date.setUTCHours(parts.hour, parts.minute, parts.second, parts.millisecond);
        return date.getTime();
      };
      const localComponentsToEpoch = (parts) => {
        const wallTime = componentsToUtc(parts);
        const offsets = new Set();
        for (const hours of [-72, -48, -24, -12, 0, 12, 24, 48, 72]) {
          const sample = new NativeDate(wallTime + hours * 3600000);
          const sampleOffset = offset(sample);
          if (Number.isFinite(sampleOffset)) offsets.add(sampleOffset);
        }
        const candidates = [...offsets].map((minutes) => wallTime + minutes * 60000);
        const toWallTime = (timestamp) => {
          const local = localParts(new NativeDate(timestamp));
          return local ? componentsToUtc(local) : NaN;
        };
        const exactMatches = candidates.filter((candidate) => toWallTime(candidate) === wallTime);
        if (exactMatches.length) return Math.min(...exactMatches);

        // A wall time in a spring-forward gap maps forward by the size of the gap.
        const afterGap = candidates
          .map((candidate) => ({ candidate, wall: toWallTime(candidate) }))
          .filter(({ wall }) => Number.isFinite(wall) && wall > wallTime)
          .sort((a, b) => a.wall - b.wall || a.candidate - b.candidate);
        if (afterGap.length) return afterGap[0].candidate;

        let candidate = wallTime;
        for (let attempt = 0; attempt < 6; attempt += 1) {
          const next = wallTime + offset(new NativeDate(candidate)) * 60000;
          if (!Number.isFinite(next) || next === candidate) break;
          candidate = next;
        }
        return candidate;
      };
      const setLocalDateFields = (date, utcSetter, args, recoverInvalid = false) => {
        const current = localParts(date) || (recoverInvalid
          ? { year: 1970, month: 0, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 }
          : null);
        if (!current) return NaN;
        const normalized = new NativeDate(componentsToUtc(current));
        normalized[utcSetter](...args);
        const parts = {
          year: normalized.getUTCFullYear(), month: normalized.getUTCMonth(), day: normalized.getUTCDate(),
          hour: normalized.getUTCHours(), minute: normalized.getUTCMinutes(), second: normalized.getUTCSeconds(),
          millisecond: normalized.getUTCMilliseconds()
        };
        date.setTime(localComponentsToEpoch(parts));
        return date.getTime();
      };
      const parseLocalIso = (value) => {
        const match = /^([+-]\d{6}|\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?$/.exec(value);
        if (!match || match[4] === undefined) return null;
        const fraction = (match[7] || "").slice(0, 3).padEnd(3, "0");
        return localComponentsToEpoch({
          year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]),
          hour: Number(match[4] || 0), minute: Number(match[5] || 0),
          second: Number(match[6] || 0), millisecond: Number(fraction || 0)
        });
      };

      function SpoofedDate(year, month, date, hours, minutes, seconds, milliseconds) {
        const args = arguments;
        if (!new.target) return new SpoofedDate().toString();
        if (args.length === 0) return new NativeDate();
        if (args.length === 1) {
          if (typeof year === "string") {
            const parsed = parseLocalIso(year);
            if (parsed !== null) return new NativeDate(parsed);
          }
          return new NativeDate(year);
        }
        let fullYear = Number(year);
        if (fullYear >= 0 && fullYear <= 99) fullYear += 1900;
        return new NativeDate(localComponentsToEpoch({
          year: fullYear,
          month: Number(month),
          day: args.length > 2 ? Number(date) : 1,
          hour: args.length > 3 ? Number(hours) : 0,
          minute: args.length > 4 ? Number(minutes) : 0,
          second: args.length > 5 ? Number(seconds) : 0,
          millisecond: args.length > 6 ? Number(milliseconds) : 0
        }));
      }
      replaceValue(SpoofedDate, "name", "Date");
      replaceValue(SpoofedDate, "length", 7);
      Object.setPrototypeOf(SpoofedDate, NativeDate);
      SpoofedDate.prototype = NativeDate.prototype;
      replaceValue(globalThis, "Date", SpoofedDate);
      replaceValue(Date.prototype, "constructor", SpoofedDate);
      replaceValue(SpoofedDate, "parse", (value) => {
        if (typeof value === "string") {
          const parsed = parseLocalIso(value);
          if (parsed !== null) return parsed;
        }
        return NativeDate.parse(value);
      });
      replaceValue(Date.prototype, "getTimezoneOffset", function () { return offset(this); });
      const getters = { getFullYear: "year", getMonth: "month", getDate: "day", getHours: "hour", getMinutes: "minute", getSeconds: "second", getMilliseconds: "millisecond" };
      for (const [method, part] of Object.entries(getters)) replaceValue(Date.prototype, method, function () { return localParts(this)?.[part] ?? NaN; });
      replaceValue(Date.prototype, "getDay", function () { const p = localParts(this); return p ? new NativeDate(NativeDate.UTC(p.year, p.month, p.day)).getUTCDay() : NaN; });
      replaceValue(Date.prototype, "getYear", function () { const p = localParts(this); return p ? p.year - 1900 : NaN; });
      for (const [method, utcSetter] of Object.entries({
        setFullYear: "setUTCFullYear", setMonth: "setUTCMonth", setDate: "setUTCDate",
        setHours: "setUTCHours", setMinutes: "setUTCMinutes", setSeconds: "setUTCSeconds",
        setMilliseconds: "setUTCMilliseconds"
      })) {
        replaceValue(Date.prototype, method, function (...args) {
          return setLocalDateFields(this, utcSetter, args, method === "setFullYear");
        });
      }
      replaceValue(Date.prototype, "setYear", function (year) {
        let normalizedYear = Number(year);
        if (normalizedYear >= 0 && normalizedYear <= 99) normalizedYear += 1900;
        return setLocalDateFields(this, "setUTCFullYear", [normalizedYear], true);
      });
      replaceValue(Date.prototype, "toString", function () {
        if (!Number.isFinite(this.getTime())) return "Invalid Date";
        const parts = new NativeDateTimeFormat("en-GB", {
          timeZone: displayZone,
          weekday: "short", month: "short", day: "numeric", year: "numeric",
          hour: "2-digit", minute: "2-digit", second: "2-digit",
          hourCycle: "h23", timeZoneName: "short"
        }).formatToParts(this);
        const part = (type) => parts.find((item) => item.type === type)?.value || "";
        const offsetMinutes = offset(this);
        const absoluteOffset = Math.abs(offsetMinutes);
        const sign = offsetMinutes <= 0 ? "+" : "-";
        const gmtOffset = `GMT${sign}${String(Math.floor(absoluteOffset / 60)).padStart(2, "0")}${String(absoluteOffset % 60).padStart(2, "0")}`;
        const zoneName = part("timeZoneName");
        const zoneLabel = /^(GMT|UTC)[+-]/.test(zoneName) ? gmtOffset : zoneName;
        return `${part("weekday")} ${part("month")} ${part("day")} ${part("year")} ${part("hour")}:${part("minute")}:${part("second")} ${gmtOffset} (${zoneLabel})`;
      });
      replaceValue(Date.prototype, "toDateString", function () {
        if (!Number.isFinite(this.getTime())) return "Invalid Date";
        const parts = new NativeDateTimeFormat("en-US", { timeZone: displayZone, weekday: "short", month: "short", day: "2-digit", year: "numeric" }).formatToParts(this);
        const part = (type) => parts.find((item) => item.type === type)?.value || "";
        return `${part("weekday")} ${part("month")} ${part("day")} ${part("year")}`;
      });
      replaceValue(Date.prototype, "toTimeString", function () {
        if (!Number.isFinite(this.getTime())) return "Invalid Date";
        const parts = new NativeDateTimeFormat("en-GB", { timeZone: displayZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZoneName: "short" }).formatToParts(this);
        const part = (type) => parts.find((item) => item.type === type)?.value || "";
        const offsetMinutes = offset(this);
        const absoluteOffset = Math.abs(offsetMinutes);
        const sign = offsetMinutes <= 0 ? "+" : "-";
        const gmtOffset = `GMT${sign}${String(Math.floor(absoluteOffset / 60)).padStart(2, "0")}${String(absoluteOffset % 60).padStart(2, "0")}`;
        const name = part("timeZoneName");
        const zoneLabel = /^(GMT|UTC)[+-]/.test(name) ? gmtOffset : name;
        return `${part("hour")}:${part("minute")}:${part("second")} ${gmtOffset} (${zoneLabel})`;
      });

      const dateLocaleMethods = {
        toLocaleString: { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" },
        toLocaleDateString: { year: "numeric", month: "numeric", day: "numeric" },
        toLocaleTimeString: { hour: "numeric", minute: "numeric", second: "numeric" }
      };
      const dateTimeOptionNames = new Set([
        "localeMatcher", "weekday", "era", "year", "month", "day", "dayPeriod",
        "hour", "minute", "second", "fractionalSecondDigits", "timeZoneName",
        "formatMatcher", "hour12", "hourCycle", "timeZone", "dateStyle", "timeStyle"
      ]);
      for (const [method, defaultsForMethod] of Object.entries(dateLocaleMethods)) {
        replaceValue(Date.prototype, method, function (requestedLocale, requestedOptions) {
          if (!Number.isFinite(this.getTime())) return "Invalid Date";
          const options = {};
          if (requestedOptions != null) {
            const source = Object(requestedOptions);
            for (const key of dateTimeOptionNames) {
              const value = source[key];
              if (value !== undefined) options[key] = value;
            }
          }
          const componentKeys = ["weekday", "era", "year", "month", "day", "dayPeriod", "hour", "minute", "second", "fractionalSecondDigits", "dateStyle", "timeStyle"];
          if (!componentKeys.some((key) => options[key] !== undefined)) Object.assign(options, defaultsForMethod);
          if (options.timeZone === undefined) options.timeZone = displayZone;
          const locales = requestedLocale === undefined ? locale : requestedLocale;
          return new NativeDateTimeFormat(locales, options).format(this);
        });
      }

      function SpoofedDateTimeFormat(...args) {
        const options = args[1] == null ? {} : Object.create(Object(args[1]));
        if (!options.timeZone) options.timeZone = displayZone;
        const formatter = new NativeDateTimeFormat(args[0] === undefined ? locale : args[0], options);
        formatterZones.set(formatter, options.timeZone);
        return formatter;
      }
      replaceValue(SpoofedDateTimeFormat, "name", "DateTimeFormat");
      replaceValue(SpoofedDateTimeFormat, "length", 0);
      Object.setPrototypeOf(SpoofedDateTimeFormat, NativeDateTimeFormat);
      SpoofedDateTimeFormat.prototype = NativeDateTimeFormat.prototype;
      replaceValue(Intl, "DateTimeFormat", SpoofedDateTimeFormat);
      replaceValue(NativeDateTimeFormat.prototype, "constructor", SpoofedDateTimeFormat);
      const formatterZones = new WeakMap();
      const nativeResolvedOptions = NativeDateTimeFormat.prototype.resolvedOptions;
      replaceValue(NativeDateTimeFormat.prototype, "resolvedOptions", function () {
        const options = nativeResolvedOptions.call(this);
        return { ...options, timeZone: formatterZones.get(this) || options.timeZone };
      });
      const nativeNumberToLocaleString = Number.prototype.toLocaleString;
      replaceValue(Number.prototype, "toLocaleString", function (requestedLocale, requestedOptions) {
        const locales = requestedLocale === undefined ? locale : requestedLocale;
        return nativeNumberToLocaleString.call(this, locales, requestedOptions);
      });
      for (const key of ["NumberFormat", "Collator", "PluralRules", "RelativeTimeFormat", "ListFormat", "DisplayNames", "Segmenter"]) {
        const Native = Intl[key];
        if (typeof Native !== "function") continue;
        function LocaleConstructor(...args) { return new Native(args[0] === undefined ? locale : args[0], ...args.slice(1)); }
        replaceValue(LocaleConstructor, "name", key);
        replaceValue(LocaleConstructor, "length", Native.length);
        Object.setPrototypeOf(LocaleConstructor, Native);
        LocaleConstructor.prototype = Native.prototype;
        replaceValue(Intl, key, LocaleConstructor);
        replaceValue(Native.prototype, "constructor", LocaleConstructor);
      }

      const navigatorPrototype = Object.getPrototypeOf(navigator);
      const navigatorLanguages = [locale];
      const baseLanguage = locale.split("-")[0];
      if (baseLanguage.toLowerCase() !== locale.toLowerCase()) navigatorLanguages.push(baseLanguage);
      replaceGetter(navigatorPrototype, "language", () => locale);
      replaceGetter(navigatorPrototype, "languages", () => [...navigatorLanguages]);
      replaceGetter(navigatorPrototype, "deviceMemory", () => Number(settings.deviceMemory));
      replaceGetter(navigatorPrototype, "hardwareConcurrency", () => Number(settings.hardwareConcurrency));
      if (document.documentElement) document.documentElement.lang = locale;
      globalThis[marker] = { restore: () => restorers.reverse().forEach((restore) => restore()) };
    },
    args: [settings]
  });
}

async function applyToOpenTabs(settings) {
  const tabs = await chrome.tabs.query({});
  const results = await Promise.all(tabs.filter((tab) => Number.isInteger(tab.id)).map(async (tab) => {
    try {
      await injectIntoTab(tab.id, settings);
      return null;
    } catch (error) {
      return { title: tab.title || tab.url || `Tab ${tab.id}`, error: error.message };
    }
  }));
  return results.filter(Boolean);
}

async function reloadWebTabs() {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs
    .filter((tab) => Number.isInteger(tab.id) && tab.url && /^https?:/i.test(tab.url))
    .map((tab) => chrome.tabs.reload(tab.id).catch(() => {})));
}

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(Object.keys(defaults));
  await chrome.storage.local.set({
    ...defaults,
    ...stored,
    enabled: typeof stored.enabled === "boolean" ? stored.enabled : false
  });
  const settings = await getSettings();
  await updateLanguageHeader(settings);
  await updateIcon(settings.enabled);
  await applyToOpenTabs(settings);
});

chrome.runtime.onStartup.addListener(async () => {
  const settings = await getSettings();
  await updateLanguageHeader(settings);
  await updateIcon(settings.enabled);
  await applyToOpenTabs(settings);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message.type === "inject-document-start") {
      const tabId = _sender.tab?.id;
      if (!Number.isInteger(tabId)) return { ignored: true };
      const settings = await getSettings();
      await injectIntoTab(tabId, settings, [_sender.frameId ?? 0]);
      return { injected: settings.enabled };
    }
    if (message.type === "set-settings") {
      const timezone = String(message.timezone || "").trim();
      const language = String(message.language || "").trim();
      const deviceMemory = Number(message.deviceMemory);
      const hardwareConcurrency = Number(message.hardwareConcurrency);
      if (!timezone || !language) throw new Error("Choose both a timezone and a language.");
      if (!memoryChoices.includes(deviceMemory)) throw new Error("Choose a supported RAM value.");
      if (!threadChoices.includes(hardwareConcurrency)) throw new Error("Choose a supported CPU thread count.");
      await chrome.storage.local.set({ timezone, language, deviceMemory, hardwareConcurrency });
    } else if (message.type === "set-enabled" && typeof message.enabled === "boolean") {
      await chrome.storage.local.set({ enabled: message.enabled });
    } else {
      throw new Error("Unknown command.");
    }

    const settings = await getSettings();
    await updateLanguageHeader(settings);
    await updateIcon(settings.enabled);
    const saved = await chrome.storage.local.get(defaults);
    if (Object.keys(defaults).some((key) => saved[key] !== settings[key])) {
      throw new Error("Could not verify saved settings.");
    }
    const failures = await applyToOpenTabs(settings);
    await reloadWebTabs();
    sendResponse({ saved: true, failures });
  })().catch((error) => sendResponse({ error: error.message }));
  return true;
});
