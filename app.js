import { DEFAULT_CONFIG, NETWORKS } from './config.js';
import { getSetupState } from './assets/ui-state.js';
import { BankClient, formatEther, parseAmount, validateConfig, readableError } from './bank.js';
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const SETTINGS_KEY = 'vault.settings.v1';
const HISTORY_KEY = 'vault.history.v1';
const DEPLOYMENT_KEY = 'vault.deployment.v1';
function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { toast('เบราว์เซอร์ไม่อนุญาตให้บันทึกข้อมูล ข้อมูลจะอยู่เฉพาะครั้งนี้', true); } }
const stored = read(SETTINGS_KEY, {});
let config = { ...DEFAULT_CONFIG };
for (const key of ['contractAddress', 'chainId']) {
  if (typeof stored?.[key] === 'string') config[key] = stored[key];
}
if (!NETWORKS[config.chainId]) config.chainId = DEFAULT_CONFIG.chainId;
let records = read(HISTORY_KEY, []);
if (!Array.isArray(records)) records = [];
records = records.filter(r => r && ['deposit', 'withdraw'].includes(r.mode) && ['pending', 'confirmed', 'failed', 'cancelled'].includes(r.status) && /^0x[a-fA-F0-9]{64}$/.test(r.hash) && /^\d+(\.\d{1,18})?$/.test(r.amount) && typeof r.account === 'string' && typeof r.contract === 'string' && Number.isFinite(r.time)).slice(-100);
let injected, client, account = '', mode = 'deposit', ready = false, busy = false, connecting = false, wrongNetwork = false;
let balances = null, walletBalance = null, connectionError = '', revision = 0;
let pendingDeployment = read(DEPLOYMENT_KEY, null);
if (!pendingDeployment || !/^0x[0-9a-f]{64}$/i.test(pendingDeployment.hash) || !/^0x[0-9a-f]{40}$/i.test(pendingDeployment.address) || !NETWORKS[pendingDeployment.chainId]) pendingDeployment = null;
const clients = new Set();
const discovered = new Map();
window.addEventListener('eip6963:announceProvider', event => {
  const detail = event.detail;
  if (detail?.info?.rdns && detail.provider) discovered.set(detail.info.rdns, detail.provider);
});
window.dispatchEvent(new Event('eip6963:requestProvider'));
const shorten = value => value ? value.slice(0, 6) + '…' + value.slice(-4) : '';
function eth(value, precision = 6) {
  const text = formatEther(value);
  const [whole, decimals = ''] = text.split('.');
  const fraction = decimals.slice(0, precision).replace(/0+$/, '');
  if (value > 0n && whole === '0' && !fraction) return '<0.' + '0'.repeat(precision - 1) + '1';
  return whole + (fraction ? '.' + fraction : '');
}
function toast(message, error = false, url = '') {
  const box = document.createElement('div'); box.className = 'toast' + (error ? ' error' : '');
  const close = document.createElement('button'); close.textContent = '×'; close.ariaLabel = 'ปิดการแจ้งเตือน'; close.onclick = () => box.remove(); box.append(close);
  box.append(document.createTextNode(message));
  if (url) { const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'ดูธุรกรรม ↗'; box.append(link); }
  box.setAttribute('role', error ? 'alert' : 'status');
  const activeDialog = document.querySelector('dialog[open]');
  if (activeDialog) { box.classList.add('modal-toast'); activeDialog.append(box); }
  else $('#toast-region').append(box);
  setTimeout(() => box.remove(), error ? 14000 : 9000);
}
function persistRecords() { records = records.slice(-100); save(HISTORY_KEY, records); }
function contextRecords() {
  if (!account || !config.contractAddress) return [];
  return records.filter(r => r.account.toLowerCase() === account.toLowerCase() && r.contract.toLowerCase() === config.contractAddress.toLowerCase() && r.chainId === config.chainId).sort((a,b) => b.time - a.time);
}
function renderHistory() {
  const items = contextRecords(); $('#activity-count').textContent = `${items.length} รายการ`;
  const list = $('#activity-list'); list.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('div'); empty.className = 'empty-state';
    empty.innerHTML = '<span class="empty-icon"><svg aria-hidden="true"><use href="#i-clock"/></svg></span><strong>ยังไม่มีรายการฝาก–ถอน</strong><p>เมื่อคุณทำรายการสำเร็จ ประวัติจะปรากฏที่นี่<br>เชื่อมต่อกระเป๋าและตั้งค่า Bank เพื่อเริ่มต้น</p>';
    list.append(empty); return;
  }
  const labels = { pending: 'รอยืนยัน', confirmed: 'สำเร็จ', failed: 'ไม่สำเร็จ', cancelled: 'ยกเลิก' };
  for (const record of items.slice(0, 10)) {
    const row = document.createElement('div'); row.className = 'activity-row';
    const icon = document.createElement('span'); icon.className = 'metric-icon' + (record.mode === 'withdraw' ? ' lilac' : '');
    icon.innerHTML = `<svg aria-hidden="true"><use href="#i-${record.mode === 'deposit' ? 'down' : 'up'}"/></svg>`;
    const info = document.createElement('div'); info.className = 'activity-info';
    const title = document.createElement('strong'); title.textContent = record.mode === 'deposit' ? 'ฝาก ETH' : 'ถอน ETH';
    const date = document.createElement('small'); date.textContent = new Intl.DateTimeFormat('th-TH', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }).format(record.time);
    info.append(title, date);
    const money = document.createElement('div'); money.className = 'activity-money';
    const amount = document.createElement('strong'); amount.textContent = record.amount + ' ETH';
    const status = document.createElement('small'); status.className = record.status === 'pending' ? 'pending' : ['failed','cancelled'].includes(record.status) ? 'failed' : '';
    status.textContent = labels[record.status];
    const explorer = NETWORKS[record.chainId]?.explorer;
    if (explorer) { const a = document.createElement('a'); a.href = explorer + '/tx/' + record.hash; a.rel = 'noopener noreferrer'; a.target = '_blank'; a.title = record.hash; a.append(status); money.append(amount, a); }
    else { status.title = record.hash; money.append(amount, status); }
    row.append(icon, info, money); list.append(row);
  }
}
function render() {
  const network = NETWORKS[config.chainId];
  $('#network-name').textContent = network.name;
  $('#form-network').textContent = network.name + (config.chainId === '11155111' ? ' Testnet' : '');
  $('#sidebar-name').textContent = config.studentName || 'ข้อมูลนักศึกษา';
  $('#sidebar-id').textContent = config.studentId || 'เพิ่มชื่อและรหัสนักศึกษา';
  $('#student-footer').textContent = [config.studentId, config.studentName].filter(Boolean).join(' · ') || 'เพิ่มรหัสนักศึกษา / ชื่อ–สกุล ↗';
  $('#contract-address').textContent = config.contractAddress ? shorten(config.contractAddress) + ' ↗' : 'ตั้งค่า Address ↗';
  $('#contract-address').title = config.contractAddress || 'ตั้งค่า Smart Contract';
  $('#wallet-status').replaceChildren();
  const dot = document.createElement('span'); dot.className = 'dot' + (!account ? ' gray' : '');
  $('#wallet-status').append(dot, document.createTextNode(account ? shorten(account) : 'ไม่ได้เชื่อมต่อ'));
  $('#wallet-status').title = account;
  $('#contract-status').textContent = ready ? 'เชื่อมต่อแล้ว' : wrongNetwork ? 'เครือข่ายไม่ตรง' : connectionError && account ? 'ตรวจสอบสัญญาไม่ผ่าน' : 'ยังไม่เชื่อมต่อ';
  $('#bank-balance').textContent = balances ? eth(balances.bank) : '—';
  $('#bank-balance').title = balances ? formatEther(balances.bank) + ' ETH' : '';
  $('#wallet-balance').textContent = walletBalance !== null ? eth(walletBalance) : '—';
  $('#wallet-balance').title = walletBalance !== null ? formatEther(walletBalance) + ' ETH' : '';
  $('#balance-subtitle').textContent = ready ? 'ยอดเงินฝากของบัญชี ' + shorten(account) : account ? 'ตั้งค่าการเชื่อมต่อเพื่ออ่านยอดเงินจากสัญญา' : 'เชื่อมต่อกระเป๋าเพื่อดูยอดเงินของคุณ';
  const available = mode === 'deposit' ? walletBalance : balances?.bank;
  $('#available-balance').textContent = available != null ? eth(available, 8) + ' ETH' : '— ETH';
  $('#amount-hint').textContent = mode === 'deposit' ? 'ยอดในกระเป๋า (ต้องเหลือสำหรับ Gas)' : 'ยอดเงินฝากที่ถอนได้';
  $('#amount-action').textContent = mode === 'deposit' ? 'ฝาก' : 'ถอน';
  const setup = getSetupState({ account, ready, wrongNetwork, connecting, busy, pending:pendingDeployment, error:connectionError });
  $('#submit-label').textContent = busy ? 'กำลังดำเนินการ…' : connecting ? 'กำลังเชื่อมต่อ…' : ready ? (mode === 'deposit' ? 'ยืนยันฝาก ETH' : 'ยืนยันถอน ETH') : account && !wrongNetwork ? 'ตั้งค่า Bank เพื่อเริ่ม' : account ? 'สลับเครือข่ายเพื่อใช้งาน' : 'เชื่อมต่อ MetaMask เพื่อเริ่ม';
  $('#mode-description').textContent = mode === 'deposit' ? 'ย้าย ETH จากกระเป๋า เข้าบัญชี Bank ของคุณ' : 'ย้ายยอดที่ฝากไว้ใน Bank กลับเข้ากระเป๋าของคุณ';
  $('#onboarding-action span').textContent = setup.label;
  $('#onboarding-action').disabled = busy || connecting;
  $('#setup-title').textContent = setup.title;
  $('#setup-text').textContent = setup.message;
  $('#setup-callout').classList.toggle('is-ready', ready);
  for(let index=1;index<=3;index++) {
    const step = $('#setup-step-' + index);
    step.classList.toggle('current', index === setup.step);
    step.classList.toggle('done', index < setup.step);
    if(index === setup.step) step.setAttribute('aria-current','step'); else step.removeAttribute('aria-current');
    const marker = step.querySelector('.step-index');
    if(index < setup.step) marker.innerHTML = '<svg aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">สำเร็จ</span>'; else marker.textContent = index;
  }
  $('#amount').disabled = busy;
  $$('[data-amount]').forEach(button => { button.disabled = busy; });
  $('#submit-button').disabled = busy || connecting;
  $('#refresh-button').disabled = !ready || busy || connecting;
  $('#setup-bank-button').hidden = ready;
  $('#deploy-bank-button').disabled = busy || connecting;
  $('#deploy-bank-button').textContent = busy ? 'กำลังดำเนินการ…' : pendingDeployment ? 'ตรวจสอบการสร้างสัญญา ↗' : 'สร้าง Bank Smart Contract ↗';
  $('#chain-id').disabled = busy;
  $('#contract-input').disabled = busy;
  $('#settings-form button[type="submit"]').disabled = busy || connecting;
  $('#connect-button').disabled = busy || connecting;
  $('#connect-button span').textContent = connecting ? 'กำลังเชื่อมต่อ…' : wrongNetwork && account ? 'สลับเครือข่าย' : account ? shorten(account) : 'เชื่อมต่อ MetaMask';
  $('#connect-button').title = account && !wrongNetwork ? 'คลิกเพื่อคัดลอกที่อยู่กระเป๋า' : 'เชื่อมต่อ MetaMask';

  $$('.tab').forEach(tab => { const active = tab.dataset.mode === mode; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; });
  $('#transaction-panel').setAttribute('aria-labelledby', mode + '-tab');
  renderHistory();
}
function selectMode(next) { if (busy) return; mode = next; $('#amount').value = ''; $$('[data-amount]').forEach(button => button.setAttribute('aria-pressed','false')); showFieldError('amount','amount-error',''); setTransactionStatus(''); render(); }
function findProvider() {
  if (discovered.has('io.metamask')) return discovered.get('io.metamask');
  const providers = window.ethereum?.providers;
  return providers?.find(p => p.isMetaMask) || (window.ethereum?.isMetaMask ? window.ethereum : undefined);
}
let bound;
function bindProvider(provider) {
  if (bound === provider) return;
  if (bound?.removeListener) {
    bound.removeListener('accountsChanged', walletChanged);
    bound.removeListener('chainChanged', walletChanged);
    bound.removeListener('disconnect', walletDisconnected);
  }
  bound = provider;
  provider.on?.('accountsChanged', walletChanged);
  provider.on?.('chainChanged', walletChanged);
  provider.on?.('disconnect', walletDisconnected);
}
function walletDisconnected() {
  revision++; account = ''; client = undefined; ready = false; wrongNetwork = false; balances = null; walletBalance = null; connectionError = ''; render();
  toast('MetaMask ขาดการเชื่อมต่อ กรุณาเชื่อมต่อใหม่', true);
}
function walletChanged() { void connect(false); }
async function reconcile(currentClient, token) {
  let changed = false;
  for (const record of contextRecords().filter(r => r.status === 'pending').slice(0,10)) {
    const receipt = await currentClient.provider.getTransactionReceipt(record.hash);
    if (token !== revision) return;
    if (receipt) { record.status = receipt.status === 1 ? 'confirmed' : 'failed'; changed = true; }
  }
  if (changed) { persistRecords(); renderHistory(); }
}
async function connect(request = true, notify = request) {
  const token = ++revision;
  ready = false; balances = null; walletBalance = null; connectionError = ''; client = undefined; account = ''; connecting = true; wrongNetwork = false; render();
  try {
    injected = findProvider();
    if (!injected) throw new Error('ไม่พบ MetaMask กรุณาติดตั้งส่วนขยาย หรือเปิดเว็บผ่านเบราว์เซอร์ในแอป MetaMask');
    bindProvider(injected);
    const candidate = new BankClient(injected, { ...config }); clients.add(candidate);
    const selected = await candidate.connect(request);
    if (token !== revision) return;
    client = candidate; account = selected;
    const chain = await injected.request({ method: 'eth_chainId' });
    if (token !== revision) return;
    wrongNetwork = BigInt(chain).toString() !== config.chainId;
    if (wrongNetwork) { if (notify) toast('กรุณากดสลับเครือข่ายเพื่อใช้ ' + NETWORKS[config.chainId].name, true); return; }
    const selectedWalletBalance = await candidate.walletBalance();
    if (token !== revision) return;
    walletBalance = selectedWalletBalance;
    if (!config.contractAddress) { if (notify) { toast('เชื่อมต่อกระเป๋าแล้ว กรุณาตั้งค่า Contract Address'); openDialog('settings'); } return; }
    await candidate.openContract();
    const nextBalances = await candidate.balances();
    if (token !== revision) return;
    balances = nextBalances; walletBalance = nextBalances.wallet; ready = true;
    if (notify) toast('เชื่อมต่อ MetaMask และ Smart Contract แล้ว');
    void reconcile(candidate, token).catch(() => {});
  } catch (error) {
    if (token !== revision) return;
    if (!client || !account) account = '';
    connectionError = readableError(error);
    if (notify) toast(connectionError, true);
  } finally {
    if (token === revision) { connecting = false; render(); }
  }
}
async function refresh(showMessage = true) {
  if (!client || !ready) return;
  const token = revision, currentClient = client;
  try {
    $('#refresh-button').classList.add('loading');
    const next = await currentClient.balances();
    if (token !== revision) return;
    balances = next; walletBalance = next.wallet; render();
    if (showMessage) toast('อัปเดตยอดเงินจาก Smart Contract แล้ว');
    await reconcile(currentClient, token);
  } catch (error) {
    if (token === revision) { balances = null; ready = false; connectionError = readableError(error); render(); toast(connectionError, true); }
  } finally { $('#refresh-button').classList.remove('loading'); }
}
async function handleWalletAction() {
  if (account && wrongNetwork && injected) {
    try { await injected.request({ method:'wallet_switchEthereumChain', params:[{ chainId:NETWORKS[config.chainId].hex }] }); await connect(false); }
    catch (error) { toast(error?.code === 4902 ? 'กรุณาเพิ่มหรือเปิดเครือข่ายนี้ใน MetaMask ก่อน' : readableError(error), true); }
  } else if (account && ready) {
    try { await navigator.clipboard.writeText(account); toast('คัดลอกที่อยู่กระเป๋าแล้ว'); } catch { toast(account); }
  } else await connect(true);
}
$('#connect-button').addEventListener('click', handleWalletAction);
function goToBanking() {
  location.hash = 'banking';
  $('#banking').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',block:'start'});
  $('#amount').focus({preventScroll:true});
}
async function nextStep() {
  if (busy || connecting) return;
  if (ready) { goToBanking(); }
  else if (account && !wrongNetwork) openDialog('settings');
  else await handleWalletAction();
}
$('#onboarding-action').addEventListener('click', nextStep);
$('#refresh-button').addEventListener('click', () => refresh());
$$('[data-mode]').forEach(button => button.addEventListener('click', () => selectMode(button.dataset.mode)));
$$('.tab').forEach(tab => tab.addEventListener('keydown', event => { if (['ArrowLeft','ArrowRight'].includes(event.key)) { event.preventDefault(); selectMode(mode === 'deposit' ? 'withdraw' : 'deposit'); $(`#${mode}-tab`).focus(); } }));
function showFieldError(inputId, errorId, message, focus = false) {
  const input = $('#' + inputId), error = $('#' + errorId);
  error.textContent = message; error.hidden = !message;
  if(message) input.setAttribute('aria-invalid','true'); else input.removeAttribute('aria-invalid');
  if(focus) input.focus();
}
function setTransactionStatus(message, error = false) {
  const area = $('#transaction-status'); area.textContent = message; area.hidden = !message; area.classList.toggle('error',error);
}
function validateAmount() {
  const value = parseAmount($('#amount').value.trim());
  if (ready && mode === 'withdraw' && value > balances.bank) throw new Error('ยอดเงินฝากไม่เพียงพอ กรุณาถอนจำนวนไม่เกินยอดที่ฝากไว้ใน Bank');
  if (ready && mode === 'deposit' && walletBalance !== null && value > walletBalance) throw new Error('ยอด ETH ในกระเป๋าไม่เพียงพอ กรุณาลดจำนวนที่ต้องการฝาก');
  return value;
}
$('#amount').addEventListener('blur', () => {
  if(!$('#amount').value.trim()) return;
  try { validateAmount(); showFieldError('amount','amount-error',''); } catch(error) { showFieldError('amount','amount-error',readableError(error)); }
});
$('#amount').addEventListener('input', () => { showFieldError('amount','amount-error',''); setTransactionStatus(''); $$('[data-amount]').forEach(button => button.setAttribute('aria-pressed','false')); });
$$('[data-amount]').forEach(button => button.addEventListener('click', () => { if(!busy) { $('#amount').value = button.dataset.amount; showFieldError('amount','amount-error',''); setTransactionStatus(''); $$('[data-amount]').forEach(item => item.setAttribute('aria-pressed', String(item === button))); $('#amount').focus(); } }));
$('#transaction-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy || connecting) return;
  if(!ready || !client) { await nextStep(); return; }
  let amount;
  try { amount = validateAmount(); showFieldError('amount','amount-error',''); }
  catch(error) { showFieldError('amount','amount-error',readableError(error),true); return; }
  const value = $('#amount').value.trim();
  const currentClient = client, token = revision, currentMode = mode, submittedConfig = { ...config }, submittedAccount = account;
  let record;
  try {
    setTransactionStatus('กรุณาตรวจจำนวน ETH และค่า Gas แล้วยืนยันใน MetaMask');
    busy = true; render(); toast('กรุณาตรวจสอบและยืนยันธุรกรรมใน MetaMask');
    const tx = await currentClient.send(currentMode, value);
    record = { hash:tx.hash, mode:currentMode, amount:formatEther(amount), account:submittedAccount, chainId:submittedConfig.chainId, contract:submittedConfig.contractAddress, time:Date.now(), status:'pending' };
    records.push(record); persistRecords(); renderHistory();
    const explorer = NETWORKS[record.chainId].explorer;
    setTransactionStatus('ส่งรายการแล้ว กำลังรอเครือข่ายยืนยัน ไม่ต้องส่งรายการซ้ำ');
    toast('ส่งธุรกรรมแล้ว กำลังรอการยืนยัน', false, explorer ? explorer + '/tx/' + record.hash : '');
    let receipt;
    try { receipt = await tx.wait(1, 180000); }
    catch (error) {
      if (error.code !== 'TRANSACTION_REPLACED') throw error;
      if (error.replacement?.hash) record.hash = error.replacement.hash;
      if (error.cancelled) { record.status = 'cancelled'; persistRecords(); throw new Error('ธุรกรรมถูกยกเลิกหรือแทนที่จาก MetaMask'); }
      receipt = error.receipt;
    }
    record.status = receipt?.status === 1 ? 'confirmed' : 'failed'; persistRecords();
    if (record.status === 'failed') throw new Error('ธุรกรรมไม่สำเร็จบนเครือข่าย');
    setTransactionStatus(currentMode === 'deposit' ? 'ฝาก ETH สำเร็จแล้ว ยอดเงินได้รับการอัปเดต' : 'ถอน ETH สำเร็จแล้ว ยอดเงินได้รับการอัปเดต');
    toast(currentMode === 'deposit' ? 'ฝาก ETH สำเร็จแล้ว' : 'ถอน ETH สำเร็จแล้ว');
    if (token === revision) { $('#amount').value = ''; await refresh(false); }
  } catch (error) {
    if (record && error.receipt?.status === 0) { record.status = 'failed'; persistRecords(); }
    const message = record?.status === 'pending' ? 'ยังยืนยันผลธุรกรรมไม่ได้ รายการยังรอตรวจสอบ กด Check Balance เพื่อตรวจอีกครั้ง' : readableError(error);
    setTransactionStatus(message, true); toast(message, true);
  } finally { busy = false; render(); }
});
function openDialog(name) {
  if (busy && name === 'settings') { toast('กรุณารอธุรกรรมปัจจุบันก่อนเปลี่ยนการเชื่อมต่อ'); return; }
  if (name === 'settings') { $('#existing-bank').open = Boolean(config.contractAddress && !pendingDeployment); showFieldError('contract-input','contract-error',''); $('#deployment-status').replaceChildren(); $('#chain-id').value = pendingDeployment?.chainId || config.chainId; $('#contract-input').value = config.contractAddress; }
  if (name === 'profile') { $('#student-id').value = config.studentId; $('#student-name').value = config.studentName; }
  const dialog = $(`#${name}-dialog`); if (!dialog.open) dialog.showModal();
}
$$('[data-open]').forEach(button => button.addEventListener('click', () => openDialog(button.dataset.open)));
$$('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$$('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } }));
$('#settings-form').addEventListener('submit', event => {
  event.preventDefault(); if (busy) return;
  try {
    const nextConfig = validateConfig({ ...config, chainId:$('#chain-id').value, contractAddress:$('#contract-input').value.trim() });
    if (account && nextConfig.contractAddress.toLowerCase() === account.toLowerCase()) throw new Error('นี่คือ Address กระเป๋า MetaMask กรุณาใช้ Contract Address ของ Bank หรือกดสร้าง Bank ด้านล่าง');
    config = nextConfig;
    save(SETTINGS_KEY, config); $('#settings-dialog').close(); toast('บันทึกการตั้งค่าแล้ว');
    ready = false; balances = null; revision++; render(); if (account) void connect(false, true);
  } catch (error) { $('#existing-bank').open = true; showFieldError('contract-input','contract-error',readableError(error),true); }
});
$('#contract-input').addEventListener('input', () => showFieldError('contract-input','contract-error',''));
$('#profile-form').addEventListener('submit', event => event.preventDefault());
function showDeployment(message, record = null) {
  const area = $('#deployment-status'); area.replaceChildren(document.createTextNode(message));
  const explorer = record && NETWORKS[record.chainId].explorer;
  if (explorer) { const link = document.createElement('a'); link.href = explorer + '/tx/' + record.hash; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'ดูธุรกรรม ↗'; area.append(document.createTextNode(' '), link); }
}
function finishDeployment(record, receipt) {
  if (receipt.status !== 1) {
    pendingDeployment = null; save(DEPLOYMENT_KEY, null);
    throw new Error('สร้างสัญญาไม่สำเร็จบนเครือข่าย กรุณาตรวจธุรกรรมใน MetaMask');
  }
  config = validateConfig({ ...config, chainId:record.chainId, contractAddress:receipt.contractAddress || record.address });
  save(SETTINGS_KEY, config); pendingDeployment = null; save(DEPLOYMENT_KEY, null);
  $('#contract-input').value = config.contractAddress;
  showDeployment('สร้าง Bank สำเร็จ: ' + config.contractAddress, record);
  toast('สร้าง Bank สำเร็จและบันทึก Contract Address แล้ว');
}
$('#deploy-bank-button').addEventListener('click', async () => {
  if (busy || connecting) return;
  const selectedChain = $('#chain-id').value;
  let deploymentClient, record = pendingDeployment;
  try {
    const provider = findProvider();
    if (!provider) throw new Error('ไม่พบ MetaMask กรุณาเปิดเว็บใน Chrome ที่ติดตั้ง MetaMask');
    if (record && record.chainId !== selectedChain) throw new Error('กรุณาเลือกเครือข่าย ' + NETWORKS[record.chainId].name + ' เพื่อตรวจการสร้างสัญญาที่ค้างอยู่');
    busy = true; render();
    deploymentClient = new BankClient(provider, { ...config, chainId:selectedChain }); clients.add(deploymentClient);
    await deploymentClient.connect(true); await deploymentClient.assertContext();
    if (record) {
      const receipt = await deploymentClient.provider.getTransactionReceipt(record.hash);
      if (!receipt) { showDeployment('ธุรกรรมยังรอยืนยัน กรุณารอสักครู่แล้วกดตรวจสอบอีกครั้ง', record); return; }
      finishDeployment(record, receipt);
    } else {
      showDeployment('กรุณายืนยันการสร้าง Bank และค่า Gas ใน MetaMask');
      const contract = await deploymentClient.deployBank();
      const tx = contract.deploymentTransaction();
      record = { address:await contract.getAddress(), hash:tx.hash, chainId:selectedChain };
      pendingDeployment = record; save(DEPLOYMENT_KEY, record);
      showDeployment('ส่งคำขอสร้าง Bank แล้ว กำลังรอเครือข่ายยืนยัน', record);
      let receipt;
      try { receipt = await tx.wait(1, 180000); }
      catch (error) {
        if (error.code !== 'TRANSACTION_REPLACED') throw error;
        if (error.cancelled) { pendingDeployment = null; save(DEPLOYMENT_KEY, null); throw new Error('คุณยกเลิกหรือแทนที่การสร้างสัญญาใน MetaMask'); }
        record.hash = error.replacement?.hash || record.hash; pendingDeployment = record; save(DEPLOYMENT_KEY, record); receipt = error.receipt;
      }
      finishDeployment(record, receipt);
    }
    await connect(false, true);
  } catch (error) {
    const message = pendingDeployment ? 'ยังยืนยันผลการสร้างสัญญาไม่ได้ กดตรวจสอบการสร้างสัญญาอีกครั้งก่อนสร้างใหม่' : readableError(error);
    showDeployment(message, pendingDeployment); toast(message, true);
  } finally { busy = false; render(); }
});
$$('[data-current-site]').forEach(element => { element.textContent = location.host; });
$('#help-button').addEventListener('click', () => openDialog('help'));
$('#help-setup-button').addEventListener('click', () => { $('#help-dialog').close(); openDialog('settings'); });
$$('[data-help-mode]').forEach(button => button.addEventListener('click', () => {
  if(busy) { toast('กรุณารอธุรกรรมปัจจุบันก่อนเปลี่ยนประเภทรายการ'); return; }
  $('#help-dialog').close(); selectMode(button.dataset.helpMode); goToBanking();
}));
$('#settings-guide').addEventListener('click', () => { $('#settings-dialog').close(); openDialog('help'); });
function updateNavigation() {
  const target = location.hash || '#overview';
  $$('.nav-item[href], .mobile-nav a').forEach(link => { const active = link.getAttribute('href') === target; link.classList.toggle('active',active); if(active) link.setAttribute('aria-current','location'); else link.removeAttribute('aria-current'); });
}
window.addEventListener('hashchange',updateNavigation);
updateNavigation();
window.addEventListener('beforeunload', () => { for (const item of clients) item.destroy(); });
render();
// Restore only previously authorized accounts; never open a wallet prompt on page load.
setTimeout(() => { if (findProvider()) void connect(false); }, 350);


