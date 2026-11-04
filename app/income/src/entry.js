import { RESTORE_KEY } from '../../../src/migration/transfer.js';
import { mountTransferExport } from './transfer-ui.js';
import { createIncomeController } from './controller.js';
import { createHomeLayout } from './home-layout.js';
import { mountIncomeSettings } from './settings-ui.js';
import { mountIncomeWidgets } from './widgets.js';
import settingsMarkup from '../settings.html';
import sharedStyles from '../styles.css';
import settingsStyles from '../settings.css';

const dialog = document.getElementById('appSettings');
const settingsButton = document.getElementById('settingsBtn');
const closeButton = document.getElementById('settingsClose');
const layoutSection = document.getElementById('layoutSettings');
const incomeHost = document.getElementById('incomeSettingsHost');
const tabs = [...dialog.querySelectorAll('[data-settings-tab]')];
let settingsView;
let returnFocus = settingsButton;

function openSettings(section = 'home') {
  if (!dialog.open) {
    returnFocus = document.activeElement;
    while (returnFocus?.shadowRoot?.activeElement) returnFocus = returnFocus.shadowRoot.activeElement;
    dialog.showModal();
  }
  for (const tab of tabs) tab.setAttribute('aria-pressed', String(tab.dataset.settingsTab === section));
  layoutSection.hidden = section !== 'home';
  incomeHost.hidden = section === 'home';
  if (section !== 'home') settingsView?.showSection(section);
  tabs.find((tab) => tab.dataset.settingsTab === section)?.focus();
}
settingsButton.addEventListener('click', () => openSettings('home'));
document.getElementById('emptySettingsBtn').addEventListener('click', () => openSettings('home'));
for (const tab of tabs) tab.addEventListener('click', () => openSettings(tab.dataset.settingsTab));
closeButton.addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  if (returnFocus?.isConnected && !returnFocus.disabled) returnFocus.focus();
  else settingsButton.focus();
});

let restorePending = false;
try { restorePending = localStorage.getItem(RESTORE_KEY) !== null; } catch {}
if (!restorePending) createHomeLayout({
  document,
  grid: document.getElementById('dashboardGrid'),
  settingsContainer: layoutSection,
  onChange: (config) => {
    document.getElementById('dashboardEmpty').hidden = config.enabled.length !== 0;
    document.getElementById('dashboardGrid').classList.toggle('single-module', config.enabled.length === 1);
  },
});

mountTransferExport(layoutSection);

try {
  // Exactly one state owner starts at boot, independent of visible cards and settings.
  if (restorePending) throw new Error('RESTORE_PENDING');
  const controller = createIncomeController();
  window.addEventListener('dogcow:before-restore', () => controller.destroy(), { once: true });
  const root = incomeHost.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${sharedStyles}\n${settingsStyles}</style>${settingsMarkup}`;
  settingsView = mountIncomeSettings(root, controller);
  mountIncomeWidgets({
    hosts: Object.fromEntries(['income', 'work-time', 'clock', 'stolen'].map((id) => [id, document.querySelector(`[data-home-module="${id}"]`)])),
    controller,
    openSettings,
  });
  controller.subscribe((state) => {
    const feedback = document.getElementById('incomeFeedback');
    feedback.textContent = state.storageStatus.message;
    feedback.hidden = !state.storageStatus.message;
  });
} catch (error) {
  console.error('[income:mount] 计价模块未能初始化。', error.name);
  incomeHost.textContent = '计价设置暂时无法载入，请保留本机数据，重新打开应用后重试。';
  const feedback = document.getElementById('incomeFeedback');
  feedback.textContent = '计价模块暂时无法载入，任务和首页定制仍可使用。';
  feedback.hidden = false;
}
