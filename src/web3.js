import Web3 from 'web3';

const web3 = (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') 
  ? new Web3(window.ethereum) 
  : new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:7545')); // Ganache URL

export default web3;
