var background = (function() {
	//#region node_modules/wxt/dist/utils/define-background.mjs
	function defineBackground(arg) {
		if (arg == null || typeof arg === "function") return { main: arg };
		return arg;
	}
	//#endregion
	//#region src/lib/background-logic.ts
	function isManagedByBrowser(url, extensionBaseUrl) {
		return url.startsWith("blob:") || url.startsWith("data:") || url.startsWith(extensionBaseUrl);
	}
	function resolveDownloadFilename(item) {
		if (item.filename) return item.filename;
		try {
			const derivedFilename = new URL(item.url).pathname.split("/").pop();
			if (derivedFilename) return derivedFilename;
		} catch {}
		return "download";
	}
	async function handleDownload(item, deps) {
		if (isManagedByBrowser(item.url, deps.extensionBaseUrl)) return "ignored";
		if (deps.passThroughUrls.has(item.url)) {
			deps.passThroughUrls.delete(item.url);
			return "browser";
		}
		await deps.ensureSettingsReady();
		const settings = deps.getSettings();
		if (!settings.enabled) return "browser";
		const filename = resolveDownloadFilename(item);
		if (!await deps.isOpheliaAvailable(settings.port)) return "browser";
		if (!await deps.cancelDownload(item.id)) return "browser";
		if (await deps.postDownload(settings.port, {
			url: item.url,
			filename
		})) return "ophelia";
		deps.passThroughUrls.add(item.url);
		await deps.redownload({
			url: item.url,
			filename
		});
		return "fallback-browser";
	}
	//#endregion
	//#region src/lib/settings.ts
	var DEFAULT_PORT = 7373;
	var DEFAULT_SETTINGS = {
		port: DEFAULT_PORT,
		enabled: true
	};
	function resolvePort(value) {
		return typeof value === "number" && Number.isInteger(value) && value >= 1024 && value <= 65535 ? value : DEFAULT_PORT;
	}
	function resolveEnabled(value) {
		return typeof value === "boolean" ? value : DEFAULT_SETTINGS.enabled;
	}
	function resolveSettings(value) {
		return {
			port: resolvePort(value.port),
			enabled: resolveEnabled(value.enabled)
		};
	}
	//#endregion
	//#region src/entrypoints/background.ts
	var settings = { ...DEFAULT_SETTINGS };
	var extensionBaseUrl = chrome.runtime.getURL("");
	var storageArea = chrome.storage.local;
	function createTimeoutSignal(timeoutMs) {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
		controller.signal.addEventListener("abort", () => clearTimeout(timeoutId), { once: true });
		return controller.signal;
	}
	async function loadPersistedSettings() {
		settings = await new Promise((resolve, reject) => {
			storageArea.get(DEFAULT_SETTINGS, (result) => {
				if (chrome.runtime.lastError) {
					reject(new Error(chrome.runtime.lastError.message));
					return;
				}
				resolve(resolveSettings(result));
			});
		});
	}
	async function isOpheliaAvailable(port) {
		try {
			const response = await fetch(`http://localhost:${port}/health`, { signal: createTimeoutSignal(2e3) });
			if (!response.ok) return false;
			return (await response.json()).app === "ophelia";
		} catch {
			return false;
		}
	}
	async function cancelDownload(downloadId) {
		return new Promise((resolve) => {
			chrome.downloads.cancel(downloadId, () => {
				resolve(!chrome.runtime.lastError);
			});
		});
	}
	async function postDownload(port, payload) {
		try {
			return (await fetch(`http://localhost:${port}/download`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
				signal: createTimeoutSignal(3e3)
			})).ok;
		} catch {
			return false;
		}
	}
	async function redownload(payload) {
		await new Promise((resolve) => {
			chrome.downloads.download(payload, () => resolve());
		});
	}
	var settingsReady = loadPersistedSettings().catch((error) => {
		settings = { ...DEFAULT_SETTINGS };
		console.error("Failed to load background settings, falling back to defaults.", error);
	});
	chrome.storage.onChanged.addListener((changes, areaName) => {
		if (areaName !== "local") return;
		if (changes.port) settings.port = resolvePort(changes.port.newValue);
		if (changes.enabled) settings.enabled = resolveEnabled(changes.enabled.newValue);
	});
	var passThroughUrls = /* @__PURE__ */ new Set();
	var background_default = defineBackground(() => {
		chrome.downloads.onCreated.addListener(async (item) => {
			await handleDownload(item, {
				extensionBaseUrl,
				passThroughUrls,
				ensureSettingsReady: () => settingsReady,
				getSettings: () => settings,
				isOpheliaAvailable,
				cancelDownload,
				postDownload,
				redownload
			});
		});
	});
	//#endregion
	//#region node_modules/wxt/dist/browser.mjs
	/**
	* Contains the `browser` export which you should use to access the extension
	* APIs in your project:
	*
	* ```ts
	* import { browser } from 'wxt/browser';
	*
	* browser.runtime.onInstalled.addListener(() => {
	*   // ...
	* });
	* ```
	*
	* @module wxt/browser
	*/
	var browser = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;
	//#endregion
	//#region node_modules/@webext-core/match-patterns/lib/index.js
	var _MatchPattern = class {
		constructor(matchPattern) {
			if (matchPattern === "<all_urls>") {
				this.isAllUrls = true;
				this.protocolMatches = [..._MatchPattern.PROTOCOLS];
				this.hostnameMatch = "*";
				this.pathnameMatch = "*";
			} else {
				const groups = /(.*):\/\/(.*?)(\/.*)/.exec(matchPattern);
				if (groups == null) throw new InvalidMatchPattern(matchPattern, "Incorrect format");
				const [_, protocol, hostname, pathname] = groups;
				validateProtocol(matchPattern, protocol);
				validateHostname(matchPattern, hostname);
				validatePathname(matchPattern, pathname);
				this.protocolMatches = protocol === "*" ? ["http", "https"] : [protocol];
				this.hostnameMatch = hostname;
				this.pathnameMatch = pathname;
			}
		}
		includes(url) {
			if (this.isAllUrls) return true;
			const u = typeof url === "string" ? new URL(url) : url instanceof Location ? new URL(url.href) : url;
			return !!this.protocolMatches.find((protocol) => {
				if (protocol === "http") return this.isHttpMatch(u);
				if (protocol === "https") return this.isHttpsMatch(u);
				if (protocol === "file") return this.isFileMatch(u);
				if (protocol === "ftp") return this.isFtpMatch(u);
				if (protocol === "urn") return this.isUrnMatch(u);
			});
		}
		isHttpMatch(url) {
			return url.protocol === "http:" && this.isHostPathMatch(url);
		}
		isHttpsMatch(url) {
			return url.protocol === "https:" && this.isHostPathMatch(url);
		}
		isHostPathMatch(url) {
			if (!this.hostnameMatch || !this.pathnameMatch) return false;
			const hostnameMatchRegexs = [this.convertPatternToRegex(this.hostnameMatch), this.convertPatternToRegex(this.hostnameMatch.replace(/^\*\./, ""))];
			const pathnameMatchRegex = this.convertPatternToRegex(this.pathnameMatch);
			return !!hostnameMatchRegexs.find((regex) => regex.test(url.hostname)) && pathnameMatchRegex.test(url.pathname);
		}
		isFileMatch(url) {
			throw Error("Not implemented: file:// pattern matching. Open a PR to add support");
		}
		isFtpMatch(url) {
			throw Error("Not implemented: ftp:// pattern matching. Open a PR to add support");
		}
		isUrnMatch(url) {
			throw Error("Not implemented: urn:// pattern matching. Open a PR to add support");
		}
		convertPatternToRegex(pattern) {
			const starsReplaced = this.escapeForRegex(pattern).replace(/\\\*/g, ".*");
			return RegExp(`^${starsReplaced}$`);
		}
		escapeForRegex(string) {
			return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		}
	};
	var MatchPattern = _MatchPattern;
	MatchPattern.PROTOCOLS = [
		"http",
		"https",
		"file",
		"ftp",
		"urn"
	];
	var InvalidMatchPattern = class extends Error {
		constructor(matchPattern, reason) {
			super(`Invalid match pattern "${matchPattern}": ${reason}`);
		}
	};
	function validateProtocol(matchPattern, protocol) {
		if (!MatchPattern.PROTOCOLS.includes(protocol) && protocol !== "*") throw new InvalidMatchPattern(matchPattern, `${protocol} not a valid protocol (${MatchPattern.PROTOCOLS.join(", ")})`);
	}
	function validateHostname(matchPattern, hostname) {
		if (hostname.includes(":")) throw new InvalidMatchPattern(matchPattern, `Hostname cannot include a port`);
		if (hostname.includes("*") && hostname.length > 1 && !hostname.startsWith("*.")) throw new InvalidMatchPattern(matchPattern, `If using a wildcard (*), it must go at the start of the hostname`);
	}
	function validatePathname(matchPattern, pathname) {}
	//#endregion
	//#region \0virtual:wxt-background-entrypoint?/Users/viktorluna/Documents/ophelia-extensions/chrome/src/entrypoints/background.ts
	function print(method, ...args) {
		if (typeof args[0] === "string") method(`[wxt] ${args.shift()}`, ...args);
		else method("[wxt]", ...args);
	}
	/** Wrapper around `console` with a "[wxt]" prefix */
	var logger = {
		debug: (...args) => print(console.debug, ...args),
		log: (...args) => print(console.log, ...args),
		warn: (...args) => print(console.warn, ...args),
		error: (...args) => print(console.error, ...args)
	};
	var ws;
	/** Connect to the websocket and listen for messages. */
	function getDevServerWebSocket() {
		if (ws == null) {
			const serverUrl = "ws://localhost:3000";
			logger.debug("Connecting to dev server @", serverUrl);
			ws = new WebSocket(serverUrl, "vite-hmr");
			ws.addWxtEventListener = ws.addEventListener.bind(ws);
			ws.sendCustom = (event, payload) => ws?.send(JSON.stringify({
				type: "custom",
				event,
				payload
			}));
			ws.addEventListener("open", () => {
				logger.debug("Connected to dev server");
			});
			ws.addEventListener("close", () => {
				logger.debug("Disconnected from dev server");
			});
			ws.addEventListener("error", (event) => {
				logger.error("Failed to connect to dev server", event);
			});
			ws.addEventListener("message", (e) => {
				try {
					const message = JSON.parse(e.data);
					if (message.type === "custom") ws?.dispatchEvent(new CustomEvent(message.event, { detail: message.data }));
				} catch (err) {
					logger.error("Failed to handle message", err);
				}
			});
		}
		return ws;
	}
	/** https://developer.chrome.com/blog/longer-esw-lifetimes/ */
	function keepServiceWorkerAlive() {
		setInterval(async () => {
			await browser.runtime.getPlatformInfo();
		}, 5e3);
	}
	function reloadContentScript(payload) {
		if (browser.runtime.getManifest().manifest_version == 2) reloadContentScriptMv2(payload);
		else reloadContentScriptMv3(payload);
	}
	async function reloadContentScriptMv3({ registration, contentScript }) {
		if (registration === "runtime") await reloadRuntimeContentScriptMv3(contentScript);
		else await reloadManifestContentScriptMv3(contentScript);
	}
	async function reloadManifestContentScriptMv3(contentScript) {
		const id = `wxt:${contentScript.js[0]}`;
		logger.log("Reloading content script:", contentScript);
		const registered = await browser.scripting.getRegisteredContentScripts();
		logger.debug("Existing scripts:", registered);
		const existing = registered.find((cs) => cs.id === id);
		if (existing) {
			logger.debug("Updating content script", existing);
			await browser.scripting.updateContentScripts([{
				...contentScript,
				id,
				css: contentScript.css ?? []
			}]);
		} else {
			logger.debug("Registering new content script...");
			await browser.scripting.registerContentScripts([{
				...contentScript,
				id,
				css: contentScript.css ?? []
			}]);
		}
		await reloadTabsForContentScript(contentScript);
	}
	async function reloadRuntimeContentScriptMv3(contentScript) {
		logger.log("Reloading content script:", contentScript);
		const registered = await browser.scripting.getRegisteredContentScripts();
		logger.debug("Existing scripts:", registered);
		const matches = registered.filter((cs) => {
			const hasJs = contentScript.js?.find((js) => cs.js?.includes(js));
			const hasCss = contentScript.css?.find((css) => cs.css?.includes(css));
			return hasJs || hasCss;
		});
		if (matches.length === 0) {
			logger.log("Content script is not registered yet, nothing to reload", contentScript);
			return;
		}
		await browser.scripting.updateContentScripts(matches);
		await reloadTabsForContentScript(contentScript);
	}
	async function reloadTabsForContentScript(contentScript) {
		const allTabs = await browser.tabs.query({});
		const matchPatterns = contentScript.matches.map((match) => new MatchPattern(match));
		const matchingTabs = allTabs.filter((tab) => {
			const url = tab.url;
			if (!url) return false;
			return !!matchPatterns.find((pattern) => pattern.includes(url));
		});
		await Promise.all(matchingTabs.map(async (tab) => {
			try {
				await browser.tabs.reload(tab.id);
			} catch (err) {
				logger.warn("Failed to reload tab:", err);
			}
		}));
	}
	async function reloadContentScriptMv2(_payload) {
		throw Error("TODO: reloadContentScriptMv2");
	}
	try {
		const ws = getDevServerWebSocket();
		ws.addWxtEventListener("wxt:reload-extension", () => {
			browser.runtime.reload();
		});
		ws.addWxtEventListener("wxt:reload-content-script", (event) => {
			reloadContentScript(event.detail);
		});
		ws.addEventListener("open", () => ws.sendCustom("wxt:background-initialized"));
		keepServiceWorkerAlive();
	} catch (err) {
		logger.error("Failed to setup web socket connection with dev server", err);
	}
	browser.commands.onCommand.addListener((command) => {
		if (command === "wxt:reload-extension") browser.runtime.reload();
	});
	var result;
	try {
		result = background_default.main();
		if (result instanceof Promise) console.warn("The background's main() function return a promise, but it must be synchronous");
	} catch (err) {
		logger.error("The background crashed on startup!");
		throw err;
	}
	//#endregion
	return result;
})();

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsIm5hbWVzIjpbImJyb3dzZXIiXSwic291cmNlcyI6WyIuLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWJhY2tncm91bmQubWpzIiwiLi4vLi4vc3JjL2xpYi9iYWNrZ3JvdW5kLWxvZ2ljLnRzIiwiLi4vLi4vc3JjL2xpYi9zZXR0aW5ncy50cyIsIi4uLy4uL3NyYy9lbnRyeXBvaW50cy9iYWNrZ3JvdW5kLnRzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL0B3eHQtZGV2L2Jyb3dzZXIvc3JjL2luZGV4Lm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC9icm93c2VyLm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ad2ViZXh0LWNvcmUvbWF0Y2gtcGF0dGVybnMvbGliL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vI3JlZ2lvbiBzcmMvdXRpbHMvZGVmaW5lLWJhY2tncm91bmQudHNcbmZ1bmN0aW9uIGRlZmluZUJhY2tncm91bmQoYXJnKSB7XG5cdGlmIChhcmcgPT0gbnVsbCB8fCB0eXBlb2YgYXJnID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiB7IG1haW46IGFyZyB9O1xuXHRyZXR1cm4gYXJnO1xufVxuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBkZWZpbmVCYWNrZ3JvdW5kIH07XG4iLCJpbXBvcnQgdHlwZSB7IFNldHRpbmdzIH0gZnJvbSAnLi9zZXR0aW5ncyc7XG5cbmV4cG9ydCB0eXBlIERvd25sb2FkSXRlbSA9IHtcbiAgICBpZDogbnVtYmVyO1xuICAgIHVybDogc3RyaW5nO1xuICAgIGZpbGVuYW1lPzogc3RyaW5nO1xufTtcblxudHlwZSBEb3dubG9hZFBheWxvYWQgPSB7XG4gICAgdXJsOiBzdHJpbmc7XG4gICAgZmlsZW5hbWU6IHN0cmluZztcbn07XG5cbmV4cG9ydCB0eXBlIEhhbmRsZURvd25sb2FkUmVzdWx0ID1cbiAgICB8ICdpZ25vcmVkJ1xuICAgIHwgJ2Jyb3dzZXInXG4gICAgfCAnb3BoZWxpYSdcbiAgICB8ICdmYWxsYmFjay1icm93c2VyJztcblxuZXhwb3J0IHR5cGUgSGFuZGxlRG93bmxvYWREZXBzID0ge1xuICAgIGV4dGVuc2lvbkJhc2VVcmw6IHN0cmluZztcbiAgICBwYXNzVGhyb3VnaFVybHM6IFNldDxzdHJpbmc+O1xuICAgIGVuc3VyZVNldHRpbmdzUmVhZHk6ICgpID0+IFByb21pc2U8dm9pZD47XG4gICAgZ2V0U2V0dGluZ3M6ICgpID0+IFNldHRpbmdzO1xuICAgIGlzT3BoZWxpYUF2YWlsYWJsZTogKHBvcnQ6IG51bWJlcikgPT4gUHJvbWlzZTxib29sZWFuPjtcbiAgICBjYW5jZWxEb3dubG9hZDogKGRvd25sb2FkSWQ6IG51bWJlcikgPT4gUHJvbWlzZTxib29sZWFuPjtcbiAgICBwb3N0RG93bmxvYWQ6IChwb3J0OiBudW1iZXIsIHBheWxvYWQ6IERvd25sb2FkUGF5bG9hZCkgPT4gUHJvbWlzZTxib29sZWFuPjtcbiAgICByZWRvd25sb2FkOiAocGF5bG9hZDogRG93bmxvYWRQYXlsb2FkKSA9PiBQcm9taXNlPHZvaWQ+O1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGlzTWFuYWdlZEJ5QnJvd3Nlcih1cmw6IHN0cmluZywgZXh0ZW5zaW9uQmFzZVVybDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIChcbiAgICAgICAgdXJsLnN0YXJ0c1dpdGgoJ2Jsb2I6JykgfHxcbiAgICAgICAgdXJsLnN0YXJ0c1dpdGgoJ2RhdGE6JykgfHxcbiAgICAgICAgdXJsLnN0YXJ0c1dpdGgoZXh0ZW5zaW9uQmFzZVVybClcbiAgICApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZURvd25sb2FkRmlsZW5hbWUoaXRlbTogUGljazxEb3dubG9hZEl0ZW0sICd1cmwnIHwgJ2ZpbGVuYW1lJz4pOiBzdHJpbmcge1xuICAgIGlmIChpdGVtLmZpbGVuYW1lKSByZXR1cm4gaXRlbS5maWxlbmFtZTtcblxuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGRlcml2ZWRGaWxlbmFtZSA9IG5ldyBVUkwoaXRlbS51cmwpLnBhdGhuYW1lLnNwbGl0KCcvJykucG9wKCk7XG4gICAgICAgIGlmIChkZXJpdmVkRmlsZW5hbWUpIHJldHVybiBkZXJpdmVkRmlsZW5hbWU7XG4gICAgfSBjYXRjaCB7XG4gICAgICAgIC8vIEZhbGwgdGhyb3VnaCB0byB0aGUgZ2VuZXJpYyBicm93c2VyLXN0eWxlIGZhbGxiYWNrLlxuICAgIH1cblxuICAgIHJldHVybiAnZG93bmxvYWQnO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlRG93bmxvYWQoXG4gICAgaXRlbTogRG93bmxvYWRJdGVtLFxuICAgIGRlcHM6IEhhbmRsZURvd25sb2FkRGVwcyxcbik6IFByb21pc2U8SGFuZGxlRG93bmxvYWRSZXN1bHQ+IHtcbiAgICBpZiAoaXNNYW5hZ2VkQnlCcm93c2VyKGl0ZW0udXJsLCBkZXBzLmV4dGVuc2lvbkJhc2VVcmwpKSByZXR1cm4gJ2lnbm9yZWQnO1xuXG4gICAgaWYgKGRlcHMucGFzc1Rocm91Z2hVcmxzLmhhcyhpdGVtLnVybCkpIHtcbiAgICAgICAgZGVwcy5wYXNzVGhyb3VnaFVybHMuZGVsZXRlKGl0ZW0udXJsKTtcbiAgICAgICAgcmV0dXJuICdicm93c2VyJztcbiAgICB9XG5cbiAgICBhd2FpdCBkZXBzLmVuc3VyZVNldHRpbmdzUmVhZHkoKTtcblxuICAgIGNvbnN0IHNldHRpbmdzID0gZGVwcy5nZXRTZXR0aW5ncygpO1xuICAgIGlmICghc2V0dGluZ3MuZW5hYmxlZCkgcmV0dXJuICdicm93c2VyJztcblxuICAgIGNvbnN0IGZpbGVuYW1lID0gcmVzb2x2ZURvd25sb2FkRmlsZW5hbWUoaXRlbSk7XG4gICAgaWYgKCEoYXdhaXQgZGVwcy5pc09waGVsaWFBdmFpbGFibGUoc2V0dGluZ3MucG9ydCkpKSByZXR1cm4gJ2Jyb3dzZXInO1xuXG4gICAgY29uc3QgY2FuY2VsbGVkID0gYXdhaXQgZGVwcy5jYW5jZWxEb3dubG9hZChpdGVtLmlkKTtcbiAgICBpZiAoIWNhbmNlbGxlZCkgcmV0dXJuICdicm93c2VyJztcblxuICAgIGNvbnN0IGhhbmRlZE9mZiA9IGF3YWl0IGRlcHMucG9zdERvd25sb2FkKHNldHRpbmdzLnBvcnQsIHsgdXJsOiBpdGVtLnVybCwgZmlsZW5hbWUgfSk7XG4gICAgaWYgKGhhbmRlZE9mZikgcmV0dXJuICdvcGhlbGlhJztcblxuICAgIGRlcHMucGFzc1Rocm91Z2hVcmxzLmFkZChpdGVtLnVybCk7XG4gICAgYXdhaXQgZGVwcy5yZWRvd25sb2FkKHsgdXJsOiBpdGVtLnVybCwgZmlsZW5hbWUgfSk7XG4gICAgcmV0dXJuICdmYWxsYmFjay1icm93c2VyJztcbn1cbiIsImV4cG9ydCBjb25zdCBERUZBVUxUX1BPUlQgPSA3MzczO1xuXG5leHBvcnQgdHlwZSBTZXR0aW5ncyA9IHtcbiAgICBwb3J0OiBudW1iZXI7XG4gICAgZW5hYmxlZDogYm9vbGVhbjtcbn07XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX1NFVFRJTkdTOiBTZXR0aW5ncyA9IHtcbiAgICBwb3J0OiBERUZBVUxUX1BPUlQsXG4gICAgZW5hYmxlZDogdHJ1ZSxcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlUG9ydCh2YWx1ZTogdW5rbm93bik6IG51bWJlciB7XG4gICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgJiZcbiAgICAgICAgTnVtYmVyLmlzSW50ZWdlcih2YWx1ZSkgJiZcbiAgICAgICAgdmFsdWUgPj0gMTAyNCAmJlxuICAgICAgICB2YWx1ZSA8PSA2NTUzNVxuICAgICAgICA/IHZhbHVlXG4gICAgICAgIDogREVGQVVMVF9QT1JUO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZUVuYWJsZWQodmFsdWU6IHVua25vd24pOiBib29sZWFuIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnYm9vbGVhbicgPyB2YWx1ZSA6IERFRkFVTFRfU0VUVElOR1MuZW5hYmxlZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVTZXR0aW5ncyh2YWx1ZTogeyBwb3J0PzogdW5rbm93bjsgZW5hYmxlZD86IHVua25vd24gfSk6IFNldHRpbmdzIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBwb3J0OiByZXNvbHZlUG9ydCh2YWx1ZS5wb3J0KSxcbiAgICAgICAgZW5hYmxlZDogcmVzb2x2ZUVuYWJsZWQodmFsdWUuZW5hYmxlZCksXG4gICAgfTtcbn1cbiIsImltcG9ydCB7IGRlZmluZUJhY2tncm91bmQgfSBmcm9tICd3eHQvdXRpbHMvZGVmaW5lLWJhY2tncm91bmQnO1xuXG5pbXBvcnQgeyBoYW5kbGVEb3dubG9hZCB9IGZyb20gJy4uL2xpYi9iYWNrZ3JvdW5kLWxvZ2ljJztcbmltcG9ydCB7XG4gICAgREVGQVVMVF9TRVRUSU5HUyxcbiAgICByZXNvbHZlRW5hYmxlZCxcbiAgICByZXNvbHZlUG9ydCxcbiAgICByZXNvbHZlU2V0dGluZ3MsXG4gICAgdHlwZSBTZXR0aW5ncyxcbn0gZnJvbSAnLi4vbGliL3NldHRpbmdzJztcblxubGV0IHNldHRpbmdzOiBTZXR0aW5ncyA9IHsgLi4uREVGQVVMVF9TRVRUSU5HUyB9O1xuY29uc3QgZXh0ZW5zaW9uQmFzZVVybCA9IGNocm9tZS5ydW50aW1lLmdldFVSTCgnJyk7XG5jb25zdCBzdG9yYWdlQXJlYSA9IGNocm9tZS5zdG9yYWdlLmxvY2FsO1xuXG5mdW5jdGlvbiBjcmVhdGVUaW1lb3V0U2lnbmFsKHRpbWVvdXRNczogbnVtYmVyKTogQWJvcnRTaWduYWwge1xuICAgIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgY29uc3QgdGltZW91dElkID0gc2V0VGltZW91dCgoKSA9PiBjb250cm9sbGVyLmFib3J0KCksIHRpbWVvdXRNcyk7XG5cbiAgICBjb250cm9sbGVyLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsICgpID0+IGNsZWFyVGltZW91dCh0aW1lb3V0SWQpLCB7XG4gICAgICAgIG9uY2U6IHRydWUsXG4gICAgfSk7XG5cbiAgICByZXR1cm4gY29udHJvbGxlci5zaWduYWw7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGxvYWRQZXJzaXN0ZWRTZXR0aW5ncygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBzZXR0aW5ncyA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgc3RvcmFnZUFyZWEuZ2V0KERFRkFVTFRfU0VUVElOR1MsIChyZXN1bHQpID0+IHtcbiAgICAgICAgICAgIGlmIChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpIHtcbiAgICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKGNocm9tZS5ydW50aW1lLmxhc3RFcnJvci5tZXNzYWdlKSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXNvbHZlKHJlc29sdmVTZXR0aW5ncyhyZXN1bHQpKTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGlzT3BoZWxpYUF2YWlsYWJsZShwb3J0OiBudW1iZXIpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGBodHRwOi8vbG9jYWxob3N0OiR7cG9ydH0vaGVhbHRoYCwge1xuICAgICAgICAgICAgc2lnbmFsOiBjcmVhdGVUaW1lb3V0U2lnbmFsKDIwMDApLFxuICAgICAgICB9KTtcblxuICAgICAgICBpZiAoIXJlc3BvbnNlLm9rKSByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgY29uc3QgYm9keSA9IChhd2FpdCByZXNwb25zZS5qc29uKCkpIGFzIHsgYXBwPzogdW5rbm93biB9O1xuICAgICAgICByZXR1cm4gYm9keS5hcHAgPT09ICdvcGhlbGlhJztcbiAgICB9IGNhdGNoIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY2FuY2VsRG93bmxvYWQoZG93bmxvYWRJZDogbnVtYmVyKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgIGNocm9tZS5kb3dubG9hZHMuY2FuY2VsKGRvd25sb2FkSWQsICgpID0+IHtcbiAgICAgICAgICAgIHJlc29sdmUoIWNocm9tZS5ydW50aW1lLmxhc3RFcnJvcik7XG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBwb3N0RG93bmxvYWQoXG4gICAgcG9ydDogbnVtYmVyLFxuICAgIHBheWxvYWQ6IHsgdXJsOiBzdHJpbmc7IGZpbGVuYW1lOiBzdHJpbmcgfSxcbik6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYGh0dHA6Ly9sb2NhbGhvc3Q6JHtwb3J0fS9kb3dubG9hZGAsIHtcbiAgICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShwYXlsb2FkKSxcbiAgICAgICAgICAgIHNpZ25hbDogY3JlYXRlVGltZW91dFNpZ25hbCgzMDAwKSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHJlc3BvbnNlLm9rO1xuICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiByZWRvd25sb2FkKHBheWxvYWQ6IHsgdXJsOiBzdHJpbmc7IGZpbGVuYW1lOiBzdHJpbmcgfSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiB7XG4gICAgICAgIGNocm9tZS5kb3dubG9hZHMuZG93bmxvYWQocGF5bG9hZCwgKCkgPT4gcmVzb2x2ZSgpKTtcbiAgICB9KTtcbn1cblxuY29uc3Qgc2V0dGluZ3NSZWFkeSA9IGxvYWRQZXJzaXN0ZWRTZXR0aW5ncygpLmNhdGNoKChlcnJvcikgPT4ge1xuICAgIHNldHRpbmdzID0geyAuLi5ERUZBVUxUX1NFVFRJTkdTIH07XG4gICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIGxvYWQgYmFja2dyb3VuZCBzZXR0aW5ncywgZmFsbGluZyBiYWNrIHRvIGRlZmF1bHRzLicsIGVycm9yKTtcbn0pO1xuXG5jaHJvbWUuc3RvcmFnZS5vbkNoYW5nZWQuYWRkTGlzdGVuZXIoKGNoYW5nZXMsIGFyZWFOYW1lKSA9PiB7XG4gICAgaWYgKGFyZWFOYW1lICE9PSAnbG9jYWwnKSByZXR1cm47XG5cbiAgICBpZiAoY2hhbmdlcy5wb3J0KSBzZXR0aW5ncy5wb3J0ID0gcmVzb2x2ZVBvcnQoY2hhbmdlcy5wb3J0Lm5ld1ZhbHVlKTtcbiAgICBpZiAoY2hhbmdlcy5lbmFibGVkKSBzZXR0aW5ncy5lbmFibGVkID0gcmVzb2x2ZUVuYWJsZWQoY2hhbmdlcy5lbmFibGVkLm5ld1ZhbHVlKTtcbn0pO1xuXG4vLyBVUkxzIHdlJ3ZlIGV4cGxpY2l0bHkgaGFuZGVkIGJhY2sgdG8gdGhlIGJyb3dzZXIgYWZ0ZXIgT3BoZWxpYSB3YXMgdW5yZWFjaGFibGUuXG4vLyBXaGVuIG9uQ3JlYXRlZCBmaXJlcyBmb3IgdGhlc2UsIHdlIGxldCB0aGVtIHRocm91Z2ggaW5zdGVhZCBvZiBpbnRlcmNlcHRpbmcgYWdhaW4uXG5jb25zdCBwYXNzVGhyb3VnaFVybHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQmFja2dyb3VuZCgoKSA9PiB7XG4gICAgY2hyb21lLmRvd25sb2Fkcy5vbkNyZWF0ZWQuYWRkTGlzdGVuZXIoYXN5bmMgKGl0ZW0pID0+IHtcbiAgICAgICAgYXdhaXQgaGFuZGxlRG93bmxvYWQoaXRlbSwge1xuICAgICAgICAgICAgZXh0ZW5zaW9uQmFzZVVybCxcbiAgICAgICAgICAgIHBhc3NUaHJvdWdoVXJscyxcbiAgICAgICAgICAgIGVuc3VyZVNldHRpbmdzUmVhZHk6ICgpID0+IHNldHRpbmdzUmVhZHksXG4gICAgICAgICAgICBnZXRTZXR0aW5nczogKCkgPT4gc2V0dGluZ3MsXG4gICAgICAgICAgICBpc09waGVsaWFBdmFpbGFibGUsXG4gICAgICAgICAgICBjYW5jZWxEb3dubG9hZCxcbiAgICAgICAgICAgIHBvc3REb3dubG9hZCxcbiAgICAgICAgICAgIHJlZG93bmxvYWQsXG4gICAgICAgIH0pO1xuICAgIH0pO1xufSk7XG4iLCIvLyAjcmVnaW9uIHNuaXBwZXRcbmV4cG9ydCBjb25zdCBicm93c2VyID0gZ2xvYmFsVGhpcy5icm93c2VyPy5ydW50aW1lPy5pZFxuICA/IGdsb2JhbFRoaXMuYnJvd3NlclxuICA6IGdsb2JhbFRoaXMuY2hyb21lO1xuLy8gI2VuZHJlZ2lvbiBzbmlwcGV0XG4iLCJpbXBvcnQgeyBicm93c2VyIGFzIGJyb3dzZXIkMSB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG4vLyNyZWdpb24gc3JjL2Jyb3dzZXIudHNcbi8qKlxuKiBDb250YWlucyB0aGUgYGJyb3dzZXJgIGV4cG9ydCB3aGljaCB5b3Ugc2hvdWxkIHVzZSB0byBhY2Nlc3MgdGhlIGV4dGVuc2lvblxuKiBBUElzIGluIHlvdXIgcHJvamVjdDpcbipcbiogYGBgdHNcbiogaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gJ3d4dC9icm93c2VyJztcbipcbiogYnJvd3Nlci5ydW50aW1lLm9uSW5zdGFsbGVkLmFkZExpc3RlbmVyKCgpID0+IHtcbiogICAvLyAuLi5cbiogfSk7XG4qIGBgYFxuKlxuKiBAbW9kdWxlIHd4dC9icm93c2VyXG4qL1xuY29uc3QgYnJvd3NlciA9IGJyb3dzZXIkMTtcbi8vI2VuZHJlZ2lvblxuZXhwb3J0IHsgYnJvd3NlciB9O1xuIiwiLy8gc3JjL2luZGV4LnRzXG52YXIgX01hdGNoUGF0dGVybiA9IGNsYXNzIHtcbiAgY29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuKSB7XG4gICAgaWYgKG1hdGNoUGF0dGVybiA9PT0gXCI8YWxsX3VybHM+XCIpIHtcbiAgICAgIHRoaXMuaXNBbGxVcmxzID0gdHJ1ZTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gWy4uLl9NYXRjaFBhdHRlcm4uUFJPVE9DT0xTXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IFwiKlwiO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gXCIqXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGdyb3VwcyA9IC8oLiopOlxcL1xcLyguKj8pKFxcLy4qKS8uZXhlYyhtYXRjaFBhdHRlcm4pO1xuICAgICAgaWYgKGdyb3VwcyA9PSBudWxsKVxuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIFwiSW5jb3JyZWN0IGZvcm1hdFwiKTtcbiAgICAgIGNvbnN0IFtfLCBwcm90b2NvbCwgaG9zdG5hbWUsIHBhdGhuYW1lXSA9IGdyb3VwcztcbiAgICAgIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCk7XG4gICAgICB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpO1xuICAgICAgdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gcHJvdG9jb2wgPT09IFwiKlwiID8gW1wiaHR0cFwiLCBcImh0dHBzXCJdIDogW3Byb3RvY29sXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IGhvc3RuYW1lO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gcGF0aG5hbWU7XG4gICAgfVxuICB9XG4gIGluY2x1ZGVzKHVybCkge1xuICAgIGlmICh0aGlzLmlzQWxsVXJscylcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIGNvbnN0IHUgPSB0eXBlb2YgdXJsID09PSBcInN0cmluZ1wiID8gbmV3IFVSTCh1cmwpIDogdXJsIGluc3RhbmNlb2YgTG9jYXRpb24gPyBuZXcgVVJMKHVybC5ocmVmKSA6IHVybDtcbiAgICByZXR1cm4gISF0aGlzLnByb3RvY29sTWF0Y2hlcy5maW5kKChwcm90b2NvbCkgPT4ge1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImh0dHBcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiaHR0cHNcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwc01hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImZpbGVcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGaWxlTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiZnRwXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzRnRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwidXJuXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzVXJuTWF0Y2godSk7XG4gICAgfSk7XG4gIH1cbiAgaXNIdHRwTWF0Y2godXJsKSB7XG4gICAgcmV0dXJuIHVybC5wcm90b2NvbCA9PT0gXCJodHRwOlwiICYmIHRoaXMuaXNIb3N0UGF0aE1hdGNoKHVybCk7XG4gIH1cbiAgaXNIdHRwc01hdGNoKHVybCkge1xuICAgIHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiaHR0cHM6XCIgJiYgdGhpcy5pc0hvc3RQYXRoTWF0Y2godXJsKTtcbiAgfVxuICBpc0hvc3RQYXRoTWF0Y2godXJsKSB7XG4gICAgaWYgKCF0aGlzLmhvc3RuYW1lTWF0Y2ggfHwgIXRoaXMucGF0aG5hbWVNYXRjaClcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBob3N0bmFtZU1hdGNoUmVnZXhzID0gW1xuICAgICAgdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5ob3N0bmFtZU1hdGNoKSxcbiAgICAgIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaC5yZXBsYWNlKC9eXFwqXFwuLywgXCJcIikpXG4gICAgXTtcbiAgICBjb25zdCBwYXRobmFtZU1hdGNoUmVnZXggPSB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLnBhdGhuYW1lTWF0Y2gpO1xuICAgIHJldHVybiAhIWhvc3RuYW1lTWF0Y2hSZWdleHMuZmluZCgocmVnZXgpID0+IHJlZ2V4LnRlc3QodXJsLmhvc3RuYW1lKSkgJiYgcGF0aG5hbWVNYXRjaFJlZ2V4LnRlc3QodXJsLnBhdGhuYW1lKTtcbiAgfVxuICBpc0ZpbGVNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZmlsZTovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgaXNGdHBNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZnRwOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBpc1Vybk1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiB1cm46Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGNvbnZlcnRQYXR0ZXJuVG9SZWdleChwYXR0ZXJuKSB7XG4gICAgY29uc3QgZXNjYXBlZCA9IHRoaXMuZXNjYXBlRm9yUmVnZXgocGF0dGVybik7XG4gICAgY29uc3Qgc3RhcnNSZXBsYWNlZCA9IGVzY2FwZWQucmVwbGFjZSgvXFxcXFxcKi9nLCBcIi4qXCIpO1xuICAgIHJldHVybiBSZWdFeHAoYF4ke3N0YXJzUmVwbGFjZWR9JGApO1xuICB9XG4gIGVzY2FwZUZvclJlZ2V4KHN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csIFwiXFxcXCQmXCIpO1xuICB9XG59O1xudmFyIE1hdGNoUGF0dGVybiA9IF9NYXRjaFBhdHRlcm47XG5NYXRjaFBhdHRlcm4uUFJPVE9DT0xTID0gW1wiaHR0cFwiLCBcImh0dHBzXCIsIFwiZmlsZVwiLCBcImZ0cFwiLCBcInVyblwiXTtcbnZhciBJbnZhbGlkTWF0Y2hQYXR0ZXJuID0gY2xhc3MgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1hdGNoUGF0dGVybiwgcmVhc29uKSB7XG4gICAgc3VwZXIoYEludmFsaWQgbWF0Y2ggcGF0dGVybiBcIiR7bWF0Y2hQYXR0ZXJufVwiOiAke3JlYXNvbn1gKTtcbiAgfVxufTtcbmZ1bmN0aW9uIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCkge1xuICBpZiAoIU1hdGNoUGF0dGVybi5QUk9UT0NPTFMuaW5jbHVkZXMocHJvdG9jb2wpICYmIHByb3RvY29sICE9PSBcIipcIilcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihcbiAgICAgIG1hdGNoUGF0dGVybixcbiAgICAgIGAke3Byb3RvY29sfSBub3QgYSB2YWxpZCBwcm90b2NvbCAoJHtNYXRjaFBhdHRlcm4uUFJPVE9DT0xTLmpvaW4oXCIsIFwiKX0pYFxuICAgICk7XG59XG5mdW5jdGlvbiB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpIHtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiOlwiKSlcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIGBIb3N0bmFtZSBjYW5ub3QgaW5jbHVkZSBhIHBvcnRgKTtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiKlwiKSAmJiBob3N0bmFtZS5sZW5ndGggPiAxICYmICFob3N0bmFtZS5zdGFydHNXaXRoKFwiKi5cIikpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4oXG4gICAgICBtYXRjaFBhdHRlcm4sXG4gICAgICBgSWYgdXNpbmcgYSB3aWxkY2FyZCAoKiksIGl0IG11c3QgZ28gYXQgdGhlIHN0YXJ0IG9mIHRoZSBob3N0bmFtZWBcbiAgICApO1xufVxuZnVuY3Rpb24gdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKSB7XG4gIHJldHVybjtcbn1cbmV4cG9ydCB7XG4gIEludmFsaWRNYXRjaFBhdHRlcm4sXG4gIE1hdGNoUGF0dGVyblxufTtcbiJdLCJ4X2dvb2dsZV9pZ25vcmVMaXN0IjpbMCw0LDUsNl0sIm1hcHBpbmdzIjoiOztDQUNBLFNBQVMsaUJBQWlCLEtBQUs7QUFDOUIsTUFBSSxPQUFPLFFBQVEsT0FBTyxRQUFRLFdBQVksUUFBTyxFQUFFLE1BQU0sS0FBSztBQUNsRSxTQUFPOzs7O0NDMkJSLFNBQWdCLG1CQUFtQixLQUFhLGtCQUFtQztBQUMvRSxTQUNJLElBQUksV0FBVyxRQUFRLElBQ3ZCLElBQUksV0FBVyxRQUFRLElBQ3ZCLElBQUksV0FBVyxpQkFBaUI7O0NBSXhDLFNBQWdCLHdCQUF3QixNQUFzRDtBQUMxRixNQUFJLEtBQUssU0FBVSxRQUFPLEtBQUs7QUFFL0IsTUFBSTtHQUNBLE1BQU0sa0JBQWtCLElBQUksSUFBSSxLQUFLLElBQUksQ0FBQyxTQUFTLE1BQU0sSUFBSSxDQUFDLEtBQUs7QUFDbkUsT0FBSSxnQkFBaUIsUUFBTztVQUN4QjtBQUlSLFNBQU87O0NBR1gsZUFBc0IsZUFDbEIsTUFDQSxNQUM2QjtBQUM3QixNQUFJLG1CQUFtQixLQUFLLEtBQUssS0FBSyxpQkFBaUIsQ0FBRSxRQUFPO0FBRWhFLE1BQUksS0FBSyxnQkFBZ0IsSUFBSSxLQUFLLElBQUksRUFBRTtBQUNwQyxRQUFLLGdCQUFnQixPQUFPLEtBQUssSUFBSTtBQUNyQyxVQUFPOztBQUdYLFFBQU0sS0FBSyxxQkFBcUI7RUFFaEMsTUFBTSxXQUFXLEtBQUssYUFBYTtBQUNuQyxNQUFJLENBQUMsU0FBUyxRQUFTLFFBQU87RUFFOUIsTUFBTSxXQUFXLHdCQUF3QixLQUFLO0FBQzlDLE1BQUksQ0FBRSxNQUFNLEtBQUssbUJBQW1CLFNBQVMsS0FBSyxDQUFHLFFBQU87QUFH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