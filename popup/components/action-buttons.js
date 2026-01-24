export function renderActionButtons(extensionId) {
  return `
    <div class="flex gap-2">
      <button
        class="text-xs bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600 disable-btn"
        data-extension-id="${extensionId}">
        Disable
      </button>
      <button
        class="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 uninstall-btn"
        data-extension-id="${extensionId}">
        Uninstall
      </button>
    </div>
  `;
}
