import { renderPrivacyScore } from './privacy-score.js';
import { renderActionButtons } from './action-buttons.js';

export function getExtensionCard(ext) {
  const card = document.createElement('div');
  card.className =
    'extension-card bg-white rounded-lg p-3 shadow-sm space-y-2';

  card.innerHTML = `
    <div class="flex justify-between items-start">
      <div>
        <h3 class="font-semibold text-sm">${ext.name}</h3>
        <p class="text-xs text-gray-500">${ext.id}</p>
      </div>
      ${renderPrivacyScore(ext.score)}
    </div>

    <div class="text-xs text-gray-600">
      Version: ${ext.version}
    </div>

    <div class="flex justify-between items-center">
      <button
        class="text-xs text-blue-600 hover:underline view-details-btn"
        data-extension-id="${ext.extensionId}">
        View details
      </button>

      ${renderActionButtons(ext.extensionId)}
    </div>
  `;

  return card;
}
