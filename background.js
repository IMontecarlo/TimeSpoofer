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
    const baseLanguage = settings.language.split("-")[0];
    const accepted = [...new Set([settings.language, baseLanguage, "en"])];
    const headerValue = accepted.map((language, index) =>
      index === 0 ? language : `${language};q=${(1 - index * 0.1).toFixed(1)}`
    ).join(",");
    addRules.push({
      id: ruleId,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [{ header: "accept-language", operation: "set", value: headerValue }]
      },
      condition: { urlFilter: "|http", resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest", "other"] }
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
      const replaceGetter = (object, key, getter) => replace(object, key, { configurable: true, enumerable: true, get: getter });

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

      function SpoofedDate(...args) {
        if (!new.target) return new NativeDate().toLocaleString(locale, { timeZone: displayZone });
        return args.length ? new NativeDate(...args) : new NativeDate();
      }
      Object.setPrototypeOf(SpoofedDate, NativeDate);
      SpoofedDate.prototype = NativeDate.prototype;
      replaceValue(globalThis, "Date", SpoofedDate);
      replaceValue(Date.prototype, "getTimezoneOffset", function () { return offset(this); });
      const getters = { getFullYear: "year", getMonth: "month", getDate: "day", getHours: "hour", getMinutes: "minute", getSeconds: "second", getMilliseconds: "millisecond" };
      for (const [method, part] of Object.entries(getters)) replaceValue(Date.prototype, method, function () { return localParts(this)?.[part] ?? NaN; });
      replaceValue(Date.prototype, "getDay", function () { const p = localParts(this); return p ? new NativeDate(NativeDate.UTC(p.year, p.month, p.day)).getUTCDay() : NaN; });
      replaceValue(Date.prototype, "getYear", function () { const p = localParts(this); return p ? p.year - 1900 : NaN; });
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
      replaceValue(Date.prototype, "toDateString", function () { return Number.isFinite(this.getTime()) ? new NativeDateTimeFormat("en-US", { timeZone: displayZone, weekday: "short", month: "short", day: "2-digit", year: "numeric" }).format(this) : "Invalid Date"; });
      replaceValue(Date.prototype, "toTimeString", function () { return Number.isFinite(this.getTime()) ? new NativeDateTimeFormat("en-US", { timeZone: displayZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZoneName: "short" }).format(this) : "Invalid Date"; });

      const dateLocaleMethods = {
        toLocaleString: {
          year: "numeric", month: "numeric", day: "numeric",
          hour: "numeric", minute: "2-digit", second: "2-digit"
        },
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
          const options = requestedOptions == null
            ? { ...defaultsForMethod }
            : Object.fromEntries(Object.entries(requestedOptions).filter(([key]) => dateTimeOptionNames.has(key)));
          options.timeZone = displayZone;
          return new NativeDateTimeFormat(requestedLocale === undefined ? locale : requestedLocale, options).format(this);
        });
      }

      function SpoofedDateTimeFormat(...args) {
        const options = { ...(args[1] || {}) };
        if (!options.timeZone) options.timeZone = displayZone;
        const formatter = new NativeDateTimeFormat(args[0] === undefined ? locale : args[0], options);
        formatterZones.set(formatter, options.timeZone);
        return formatter;
      }
      Object.setPrototypeOf(SpoofedDateTimeFormat, NativeDateTimeFormat);
      SpoofedDateTimeFormat.prototype = NativeDateTimeFormat.prototype;
      replaceValue(Intl, "DateTimeFormat", SpoofedDateTimeFormat);
      const formatterZones = new WeakMap();
      const nativeResolvedOptions = NativeDateTimeFormat.prototype.resolvedOptions;
      replaceValue(NativeDateTimeFormat.prototype, "resolvedOptions", function () {
        const options = nativeResolvedOptions.call(this);
        return { ...options, timeZone: formatterZones.get(this) || options.timeZone };
      });
      for (const key of ["NumberFormat", "Collator", "PluralRules", "RelativeTimeFormat", "ListFormat", "DisplayNames", "Segmenter"]) {
        const Native = Intl[key];
        if (typeof Native !== "function") continue;
        function LocaleConstructor(...args) { return new Native(args[0] === undefined ? locale : args[0], ...args.slice(1)); }
        Object.setPrototypeOf(LocaleConstructor, Native);
        LocaleConstructor.prototype = Native.prototype;
        replaceValue(Intl, key, LocaleConstructor);
      }

      replaceGetter(navigator, "language", () => locale);
      replaceGetter(navigator, "languages", () => [locale]);
      replaceGetter(navigator, "deviceMemory", () => Number(settings.deviceMemory));
      replaceGetter(navigator, "hardwareConcurrency", () => Number(settings.hardwareConcurrency));
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
