// Runs in the isolated world at document_start and requests the saved profile.
chrome.runtime.sendMessage({ type: "inject-document-start" }).catch(() => {});
