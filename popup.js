const form = document.querySelector("#settings-form");
const timezoneInput = document.querySelector("#timezone");
const languageInput = document.querySelector("#language");
const memoryInput = document.querySelector("#device-memory");
const threadsInput = document.querySelector("#cpu-threads");
const enabledInput = document.querySelector("#enabled");
const status = document.querySelector("#status");

const timezones = typeof Intl.supportedValuesOf === "function"
  ? ["UTC", ...Intl.supportedValuesOf("timeZone")]
  : ["UTC", "Europe/Berlin", "Europe/London", "Europe/Moscow", "Asia/Tokyo", "America/Los_Angeles", "America/New_York"];
const languages = ["en-US", "en-GB", "de-DE", "fr-FR", "es-ES", "it-IT", "pt-BR", "ru-RU", "uk-UA", "zh-CN", "ja-JP", "ko-KR", "ar-SA", "hi-IN"];
const memoryOptions = [8, 12, 16, 24, 32, 48, 64, 128, 256];
const threadOptions = [2, 4, 6, 8, 12, 16, 20, 24, 32];

function formatUtcOffset(timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "longOffset"
  }).formatToParts(new Date());
  const offset = parts.find((part) => part.type === "timeZoneName")?.value || "GMT";
  if (offset === "GMT" || offset === "UTC") return "UTC+00:00";
  const match = offset.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return offset.replace(/^GMT/, "UTC");
  return `UTC${match[1]}${match[2].padStart(2, "0")}:${match[3] || "00"}`;
}

function populate(select, options, selected, format = (value) => value) {
  const values = [...new Set([...options, selected])];
  values.sort((a, b) => a === "UTC" ? -1 : b === "UTC" ? 1 : a.localeCompare(b));
  for (const value of values) select.add(new Option(format(value), value));
  select.value = selected;
}

chrome.storage.local.get({ enabled: false, timezone: "UTC", language: "en-US", deviceMemory: 8, hardwareConcurrency: 8 }).then((settings) => {
  if (!memoryOptions.includes(Number(settings.deviceMemory))) settings.deviceMemory = 8;
  if (!threadOptions.includes(Number(settings.hardwareConcurrency))) settings.hardwareConcurrency = 8;
  populate(timezoneInput, timezones, settings.timezone, (zone) => `${formatUtcOffset(zone)} | ${zone}`);
  populate(languageInput, languages, settings.language);
  populate(memoryInput, memoryOptions.map(String), String(settings.deviceMemory));
  populate(threadsInput, threadOptions.map(String), String(settings.hardwareConcurrency));
  enabledInput.checked = settings.enabled;
}).catch((error) => {
  status.textContent = `Could not load saved settings: ${error.message}`;
});

async function sendCommand(message) {
  return chrome.runtime.sendMessage(message);
}

enabledInput.addEventListener("change", async () => {
  const requested = enabledInput.checked;
  status.textContent = requested ? "Enabling..." : "Disabling...";
  let result;
  try {
    result = await sendCommand({ type: "set-enabled", enabled: requested });
  } catch (error) {
    result = { error: error.message };
  }
  if (result.error) {
    enabledInput.checked = !requested;
    status.textContent = result.error;
  } else {
    status.textContent = enabledInput.checked ? "Enabled." : "Disabled.";
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  status.textContent = "Saving...";
  let result;
  try {
    result = await sendCommand({
      type: "set-settings",
      timezone: timezoneInput.value,
      language: languageInput.value,
      deviceMemory: Number(memoryInput.value),
      hardwareConcurrency: Number(threadsInput.value)
    });
  } catch (error) {
    result = { error: error.message };
  }
  if (result.error) {
    status.textContent = result.error;
  } else if (result.failures?.length) {
    status.textContent = `Apply failed on ${result.failures.length} tab(s): ${result.failures[0].error}`;
  } else {
    status.textContent = enabledInput.checked
      ? "Settings saved and applied."
      : "Settings saved. Enable spoofing separately to apply them.";
  }
});
