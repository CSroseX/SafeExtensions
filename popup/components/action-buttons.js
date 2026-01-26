export function renderActionButtons(extensionId, isEnabled) {
  const toggleSwitch = `
    <div class="toggle-switch-container">
      <input
        type="checkbox"
        id="toggle-${extensionId}"
        class="toggle-switch-input toggle-disable-btn"
        data-extension-id="${extensionId}"
        ${isEnabled === true ? 'checked' : ''}
        aria-label="Toggle extension"
      />
      <label for="toggle-${extensionId}" class="toggle-switch-label"></label>
    </div>
  `;

  return `
    <div class="flex gap-2 items-center">
      ${toggleSwitch}
      <button
        class="btn-uninstall uninstall-btn"
        data-extension-id="${extensionId}"
        title="Uninstall this extension">
        Uninstall
      </button>
    </div>
  `;
}
