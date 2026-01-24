// Listen when extensions are enabled/disabled
chrome.management.onEnabled.addListener(async (info) => {
	console.log('Extension enabled:', info.name);
	// Rescan this extension
});

chrome.management.onDisabled.addListener(async (info) => {
	console.log('Extension disabled:', info.name);
});
