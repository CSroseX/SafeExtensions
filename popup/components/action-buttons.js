export function renderActionButtons(extensionId) {
  return `
    <div class="flex gap-2">
      <button
        class="btn-disable disable-btn"
        data-extension-id="${extensionId}"
        title="Disable this extension">
        Disable
      </button>
      <button
        class="btn-uninstall uninstall-btn"
        data-extension-id="${extensionId}"
        title="Uninstall this extension">
        Uninstall
      </button>
    </div>
  `;
}
