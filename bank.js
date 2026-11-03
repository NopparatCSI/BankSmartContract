import { BrowserProvider, Contract, ContractFactory, parseEther, formatEther, getAddress, isAddress, ZeroAddress } from './assets/ethers.min.js';
import { NETWORKS } from './config.js';
export const ABI = [
  'function deposit() payable',
  'function withdraw(uint256 amount)',
  'function checkBalance() view returns (uint256)',
  'event Deposit(address indexed owner, uint256 amount)',
  'event Withdraw(address indexed owner, uint256 amount)'
];
export { formatEther };
export function parseAmount(value) {
  const text = String(value).trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(text)) throw new Error('กรอกจำนวน ETH เป็นตัวเลขทศนิยมไม่เกิน 18 ตำแหน่ง');
  const amount = parseEther(text);
  if (amount <= 0n) throw new Error('จำนวน ETH ต้องมากกว่า 0');
  return amount;
}
export function validateConfig(config) {
  if (!NETWORKS[config.chainId]) throw new Error('กรุณาเลือกเครือข่ายที่รองรับ');
  if (!isAddress(config.contractAddress) || config.contractAddress === ZeroAddress) throw new Error('กรุณากรอก Contract Address ที่ถูกต้อง');
  return { ...config, contractAddress: getAddress(config.contractAddress) };
}
export function readableError(error) {
  const text = error?.reason || error?.shortMessage || error?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
  if (error?.code === 4001 || error?.code === 'ACTION_REJECTED') return 'คุณยกเลิกคำขอใน MetaMask แล้ว';
  if (error?.code === -32002) return 'มีคำขอค้างอยู่ กรุณาเปิด MetaMask เพื่อดำเนินการ';
  if (/Insufficient balance/.test(text)) return 'ยอดเงินฝากไม่เพียงพอสำหรับการถอน';
  if (error?.code === 'INSUFFICIENT_FUNDS' || /insufficient funds/i.test(text)) return 'ETH ในกระเป๋าไม่เพียงพอสำหรับจำนวนเงินและค่าธรรมเนียม';
  if (error?.code === 'CALL_EXCEPTION' && /missing revert data/i.test(text)) return 'เรียกสัญญาไม่สำเร็จ กรุณาตรวจ Contract Address ของ Bank และเครือข่ายที่ Deploy';
  if (/user rejected|user denied/i.test(text)) return 'คุณยกเลิกคำขอใน MetaMask แล้ว';
  return text.length > 200 ? text.slice(0, 200) + '…' : text;
}
export class BankClient {
  constructor(injected, config) {
    this.injected = injected;
    this.config = config;
    this.provider = new BrowserProvider(injected, 'any', { cacheTimeout: -1 });
  }
  async connect(request = true) {
    const accounts = await this.injected.request({ method: request ? 'eth_requestAccounts' : 'eth_accounts' });
    if (!accounts.length) throw new Error('กรุณาเชื่อมต่อบัญชี MetaMask');
    this.account = getAddress(accounts[0]);
    this.signer = await this.provider.getSigner(this.account);
    return this.account;
  }
  async assertContext() {
    const [chain, accounts] = await Promise.all([
      this.injected.request({ method: 'eth_chainId' }),
      this.injected.request({ method: 'eth_accounts' })
    ]);
    if (BigInt(chain).toString() !== this.config.chainId) throw new Error('เครือข่ายไม่ตรง กรุณาสลับไปที่ ' + NETWORKS[this.config.chainId].name);
    if (!accounts.length || getAddress(accounts[0]) !== this.account) throw new Error('บัญชีเปลี่ยนแล้ว กรุณาเชื่อมต่อใหม่');
  }
  async openContract() {
    this.config = validateConfig(this.config);
    await this.assertContext();
    this.contract = undefined;
    if (this.config.contractAddress === this.account) throw new Error('Address นี้เป็นกระเป๋า MetaMask ของคุณ กรุณาใช้ Contract Address ของ Bank หรือกดสร้าง Bank Smart Contract');
    const code = await this.provider.getCode(this.config.contractAddress);
    if (code === '0x') throw new Error('ไม่พบ Smart Contract ที่ Address นี้ กรุณาใช้ Address ของ Bank ที่ Deploy บนเครือข่ายนี้แล้ว');
    if (/^0xef0100[0-9a-f]{40}$/i.test(code)) throw new Error('Address นี้เป็นบัญชีกระเป๋าที่มอบหมายโค้ด ไม่ใช่ Bank กรุณาใช้ Contract Address ของ Bank');
    const candidate = new Contract(this.config.contractAddress, ABI, this.signer);
    try { await candidate.checkBalance(); }
    catch (error) {
      if (['CALL_EXCEPTION','BAD_DATA'].includes(error.code)) throw new Error('สัญญาที่ Address นี้เรียก checkBalance() ของ Bank ไม่ได้ กรุณาตรวจว่า Deploy Bank.sol และเลือกเครือข่ายถูกต้อง', { cause:error });
      throw error;
    }
    this.contract = candidate;
    return this.contract;
  }
  async walletBalance() {
    await this.assertContext();
    return BigInt(await this.provider.send('eth_getBalance', [this.account, 'latest']));
  }
  async deployBank() {
    await this.assertContext();
    const { BANK_ARTIFACT } = await import('./assets/bank-contract.js');
    await this.assertContext();
    return new ContractFactory(BANK_ARTIFACT.abi, BANK_ARTIFACT.bytecode, this.signer).deploy();
  }
  async balances() {
    await this.assertContext();
    const [bank, wallet] = await Promise.all([
      this.contract.checkBalance(),
      this.provider.send('eth_getBalance', [this.account, 'latest']).then(BigInt)
    ]);
    return { bank, wallet };
  }
  async send(mode, value) {
    const amount = parseAmount(value);
    await this.assertContext();
    if (!this.contract) throw new Error('กรุณาเชื่อมต่อ Smart Contract ก่อน');
    if (mode === 'withdraw') {
      if (amount > await this.contract.checkBalance()) throw new Error('Insufficient balance');
      return this.contract.withdraw(amount);
    }
    if (mode !== 'deposit') throw new Error('รายการไม่ถูกต้อง');
    return this.contract.deposit({ value: amount });
  }
  destroy() { this.provider.destroy(); }
}

