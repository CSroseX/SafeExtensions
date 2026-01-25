export function renderActionButtons(extensionId, isEnabled) {
  const disableBtn = isEnabled === true ? `
      <button
        class="btn-disable disable-btn"
        data-extension-id="${extensionId}"
        title="Disable this extension">
        Disable
      </button>
  ` : '';

  return `
    <div class="flex gap-2">
      ${disableBtn}
      <button
        class="btn-uninstall uninstall-btn"
        data-extension-id="${extensionId}"
        title="Uninstall this extension">
        Uninstall
C      </button>
    </div>
  `;
}
