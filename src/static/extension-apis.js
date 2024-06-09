(() => {
	let hosting_url = window.sPlusBookmarkletSourcePath;

	// non-extension impl of chrome.storage and chrome.runtime
	const c_storage = {}

	const c_s_sync = {
		get(toGet, callback) {
			console.debug("ExtAPIStubs: Redirected chrome.storage.sync.get");
			var archive = {},
				keys = Object.keys(localStorage),
				i = keys.length;

			while (i--) {
				let item = localStorage.getItem(keys[i])
				var parsedItem;
				try {
					parsedItem = JSON.parse(item);
				} catch (error) {
					parsedItem = item;
				}
				archive[keys[i]] = parsedItem;
			}
			if (toGet) {
				if (toGet.constructor == Object) {
					for (const [key, value] of Object.entries(toGet)) {
						if (!(key in archive)) {
							console.debug("ExtAPIStubs: chrome.storage.sync.get: Set provided default value for " + key + "to value: " + value);
							archive[key] = value;
						}
					}
				}
			}
			if (callback) callback(archive);
			return archive;
		},
		set(toSet, callback) {
			console.debug("ExtAPIStubs: Redirected chrome.storage.sync.set");
			for (const [key, value] of Object.entries(toSet)) {
				console.debug("ExtAPIStubs: setting key " + key + " to value: " + value);
				localStorage.setItem(key, JSON.stringify(value));
			}
			if (callback) callback();
		},
		remove(toSet, callback) {
			console.debug("ExtAPIStubs: Redirected chrome.storage.sync.remove");
			if (typeof toSet === 'string' || toSet instanceof String) {
				localStorage.removeItem(toSet);
			} else {
				for (const toRemove of toSet) {
					localStorage.removeItem(toRemove);
				}
			}
			if (callback) callback();
		}
	}
	function c_r_getManifest() {
		return {
			'version_name': '7.0 (uBlock) [S+ version 10.0.1]',
			'version': '10.0.1'
		}
	}

	function c_r_getURL(ext_url) {
		console.debug("ExtAPIStubs: Redirected chrome.runtime.getURL");
		if (ext_url === "/theme-editor.html") return "/sPlusBookmarkletTricksExtensionForThemeEditor"
		return hosting_url + ext_url
	}
	globalThis.chrome.storage = c_storage;
	globalThis.chrome.storage.sync = c_s_sync;
	if (typeof chrome.runtime === 'undefined') {
		globalThis.chrome.runtime = {};
	}
	globalThis.chrome.runtime.getManifest = c_r_getManifest;
	globalThis.chrome.runtime.getURL = c_r_getURL;

	async function runtimeCallback(request, sender, sendResponse) {
		if (request.type == "fetch" && request.url !== undefined) {
			console.debug("Received fetch request for " + request.url);

			(async function() {
				let finalResponse = {};
				let responseObj;
				try {
					responseObj = await fetch(request.url, request.params);
				} catch (e) {
					finalResponse.success = false;
					finalResponse.error = e;
					return finalResponse;
				}

				finalResponse.success = true;

				finalResponse.headers = responseObj.headers;
				finalResponse.ok = responseObj.ok;
				finalResponse.redirected = responseObj.redirected;
				finalResponse.status = responseObj.status;
				finalResponse.statusText = responseObj.statusText;
				finalResponse.type = responseObj.type;
				finalResponse.url = responseObj.url;
				finalResponse.useFinalURL = responseObj.useFinalURL;

				try {
					switch (request.bodyReadType) {
						case "json":
							finalResponse.json = await responseObj.json();
							break;
						case "text":
							finalResponse.text = await responseObj.text();
							break;
					}
				} catch (e) {
					finalResponse.bodyReadError = e || true;
				}

				return finalResponse;
			})().then(x => sendResponse(JSON.stringify(x))).catch(err => sendResponse(JSON.stringify({
				success: false,
				error: err
			})));

			return true;
		}
	}

	async function c_r_sendMessage(request) {
		await new Promise(r => runtimeCallback(request, 'ExtAPIStubs', r));
	}

	globalThis.chrome.runtime.sendMessage = c_r_sendMessage;
})();
