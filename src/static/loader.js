(async () => {
	const contentScripts = [
		{
			"matches": [
				"*://*.schoology.com/sPlusBookmarklet*",
				"*://lms.lausd.net/sPlusBookmarklet*",
			],
			"js": [
				"lib/jquery.js",
				"lib/materialize.js",
				"lib/jquery-ui.js",
				"lib/roundslider.js",
				"theme-editor.js"
			],
			"cssPreprocess": [
				"lib/material-icons.css",
			],
			"css": [
				"lib/materialize.css",
				"lib/jquery-ui.css",
				"lib/roundslider.css",
				"lib/spectrum.css",
				"styles/theme-editor.css",
				"styles/modern/theme-editor.css",
			],
			"injectHtml": "theme-editor.html",
		},
		{
			"matches": [
				"https://lms.lausd.net/*",
				"https://*.schoology.com/*"
			],
			"exclude_matches": [
				"https://*.schoology.com/login*",
				"https://*.schoology.com/register*",
				"*://asset-cdn.schoology.com/*",
				"*://developer.schoology.com/*",
				"*://support.schoology.com/*",
				"*://info.schoology.com/*",
				"*://files-cdn.schoology.com/*",
				"*://status.schoology.com/*",
				"*://ui.schoology.com/*",
				"*://www.schoology.com/*",
				"*://api.schoology.com/*",
				"*://developers.schoology.com/*",
				"*://schoology.com/*",
				"*://lti-submission-google.app.schoology.com/*",
				"*://*.schoology.com/sPlusBookmarklet*",
				"*://lms.lausd.net/sPlusBookmarklet*",
			],
			"css": [
				"styles/all.css",
				"styles/modern/all.css",
				"lib/contextmenu.css",
				"lib/izitoast.css",
				"lib/jquery-ui.css"
			],
			"js": [
				"lib/jquery.js",
				"lib/jquery-migrate.js",
				"lib/contextmenu.js",
				"content.js"
			],
			"run_at": "document_start"
		}
	];

	if (window.splusLoaded) return;
	if (window.parent !== window) return;

	const baseUrl = (new URL(window.sPlusBookmarkletSourcePath)).origin + "/";
	const extApisFile = "extension-apis.js"

	const glob = (pattern, input) => {
		var re = new RegExp(pattern.replace(/([.?+^$[\]\\(){}|\/-])/g, "\\$1").replace(/\*/g, '.*'));
		return re.test(input);
	}

	async function cachingFetch(url) {
		let data = JSON.parse(localStorage.getItem("splus-loader")) || { cache: {} };
		if (btoa(url) in data.cache) {
			const updatedDate = Date.parse(data.cache[btoa(url)].lastUpdated);
			const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
			if (updatedDate > sevenDaysAgo) {
				return data.cache[btoa(url)].data;
			}
		}
		const resp = await fetch(url, { cache: "no-store" }).then(r => r.text());
		data.cache[btoa(url)] = { data: resp, lastUpdated: (new Date()).toISOString() };
		localStorage.setItem("splus-loader", JSON.stringify(data));
		return resp;
	}

	const log = (str) => { console.debug(str) }

	let injectedScripts = [];
	let cssToInject = [];
	let jsToDefer = [];
	let parsingFinished = false;
	let domContentLoaded = false;
	let startedInjecting = false;
	window.deferredInjected = false;
	let injectHtml = false;

	function injectDeferred(cssArr, jsArr) {
		for (const css of cssArr) {
			const el = document.createElement("style");
			el.setAttribute("splus-bookmarket", ":3");
			el.innerHTML = css;
			document.head.appendChild(el);
		}
		for (const js of jsArr) {
			eval?.(js);
		}
	}

	async function themeEditorHack() {
		if (injectHtml) {
			document.documentElement.innerHTML = await cachingFetch(baseUrl + injectHtml.injectHtml);
			await injectContentScript(injectHtml);
		}
	}

	async function injectContentScript(contentScript) {
		if (contentScript.js) {
			for (const js of contentScript.js) {
				if (!injectedScripts.includes(js)) {
					injectedScripts.push(js);
					const code = await cachingFetch(baseUrl + js)
					if (contentScript.run_at === "document_start") {
						eval?.(code);
					} else {
						jsToDefer.push(code);
					}
				}
			}
		}
		if (contentScript.css) {
			for (const css of contentScript.css) {
				cssToInject.push(await cachingFetch(baseUrl + css));
			}
			if (contentScript.cssPreprocess) {
				for (const css of contentScript.cssPreprocess) {
					cssToInject.push((await cachingFetch(baseUrl + css)).replace("__LOADER_BASE_URL__", window.sPlusBookmarkletSourcePath));
				}
			}
		}
	}

	window.addEventListener("DOMContentLoaded", async () => {
		domContentLoaded = true;
		if (parsingFinished) {
			startedInjecting = true;
			await themeEditorHack();
			injectDeferred(cssToInject, jsToDefer);
			window.deferredInjected = true;
		}
	})

	eval?.(await cachingFetch(baseUrl + extApisFile));

	for (const contentScript of contentScripts) {
		// matches
		const matches = contentScript.matches;
		if (!matches) {
			console.error("Malformed content script.");
			continue;
		}
		const excludes = contentScript.exclude_matches;
		let urlMatches = false;
		let urlExcludes = false;
		for (const match of matches) {
			const matchMatches = glob(match, window.location.href);
			urlMatches = matchMatches ? true : urlMatches;
			log(`urlMatches? ${urlMatches} glob = ${match}`);
		}
		if (excludes) {
			for (const exclude of excludes) {
				const excludeMatches = glob(exclude, window.location.href);
				urlExcludes = excludeMatches ? true : urlExcludes;
				log(`urlExcludes? ${urlExcludes} glob = ${exclude}`);
			}
		}
		if (urlMatches && !urlExcludes) {
			if (contentScript.injectHtml) {
				injectHtml = contentScript;
				break;
			}
			await injectContentScript(contentScript);
		}
	}
	parsingFinished = true;
	if (domContentLoaded && !startedInjecting && !window.deferredInjected) {
		await themeEditorHack();
		injectDeferred(cssToInject, jsToDefer);
		window.deferredInjected = true;
	}
})();

(async () => {
	while (true) {
		await new Promise(r => setTimeout(r, 100));
		if (window.deferredInjected) {
			console.error("done injecting");
			break;
		}
	}
})();
