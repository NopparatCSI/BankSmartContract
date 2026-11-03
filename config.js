// Bank/network defaults can be overridden in Settings. Student identity is fixed here.
export const DEFAULT_CONFIG = {
  contractAddress: '0xe017Fa61A9d8248071192A4C82C745840bfdF6b3',
  chainId: '11155111',
  studentId: '66068773',
  studentName: 'นพรัตน์ สุวรรณะ'
};
export const NETWORKS = {
  '11155111': { name: 'Sepolia', hex: '0xaa36a7', explorer: 'https://sepolia.etherscan.io' },
  '31337': { name: 'Localhost', hex: '0x7a69', explorer: '' },
  '1337': { name: 'Ganache', hex: '0x539', explorer: '' }
};
