export function renderActionButtons(extensionId, isEnabled) {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex gap-2 items-center';

  const toggleContainer = document.createElement('div');
  toggleContainer.className = 'toggle-switch-container';

  const toggleInput = document.createElement('input');
  toggleInput.type = 'checkbox';
  toggleInput.id = `toggle-${extensionId}`;
  toggleInput.className = 'toggle-switch-input toggle-disable-btn';
  toggleInput.dataset.extensionId = extensionId;
  toggleInput.checked = isEnabled === true;
  toggleInput.setAttribute('aria-label', 'Toggle extension');

  const toggleLabel = document.createElement('label');
  toggleLabel.className = 'toggle-switch-label';
  toggleLabel.htmlFor = `toggle-${extensionId}`;

  toggleContainer.appendChild(toggleInput);
  toggleContainer.appendChild(toggleLabel);

  const uninstallButton = document.createElement('button');
  uninstallButton.className = 'btn-uninstall uninstall-btn';
  uninstallButton.dataset.extensionId = extensionId;
  uninstallButton.title = 'Uninstall this extension';
  uninstallButton.type = 'button';
  uninstallButton.textContent = 'Uninstall';

  wrapper.appendChild(toggleContainer);
  wrapper.appendChild(uninstallButton);

  return wrapper;
}
