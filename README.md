
# Blockchain Crowdfunding DApp

A decentralized crowdfunding application (dApp) built on Ethereum, enabling the creation and management of transparent and secure fundraising campaigns through smart contracts.

## 📌 Table of Contents

- [Introduction](#🧭-introduction)
- [Features](#🚀-features)
- [Technologies](#🛠️-technologies)
- [Installation](#⚙️-installation)
- [Usage](#💻-usage)
- [Project Structure](#📁-project-structure)
- [Smart Contracts](#📜-smart-contracts)
- [Contributing](#🤝-contributing)
- [License](#📄-license)

---

## 🧭 Introduction

This DApp allows users to create and contribute to crowdfunding campaigns on the Ethereum blockchain. With transparent and immutable logic powered by smart contracts, users can securely support or launch new initiatives.

## 🚀 Features

- Create new campaigns with target goals and deadlines
- Users can contribute using an Ethereum wallet
- Automatic refund if the campaign fails
- Track campaign status and contributions
- MetaMask wallet integration

## 🛠️ Technologies

- **Frontend**: React.js, Tailwind CSS
- **Smart Contracts**: Solidity
- **Blockchain**: Ethereum (Sepolia Testnet)
- **Tools**: MetaMask

## ⚙️ Installation

1. Clone the repository:
```bash
git clone https://github.com/nikts27/blockchain-crowdfunding.git
cd blockchain-crowdfunding
```

2. Install dependencies:
```bash
npm install
```

3. Start the local development server:
```bash
npm start
```

4. Ensure MetaMask is installed and connected to the Sepolia Testnet.

## 💻 Usage

- Open the app in your browser.
- Connect your MetaMask wallet.
- Create a new campaign or support an existing one.
- Track progress and contributions in real time.

## 📁 Project Structure

```
blockchain-crowdfunding/
├── contract/          # Smart contract written in Solidity
├── frontend/           # React application
├── scripts/            # Deployment scripts
├── test/               # Unit tests
├── hardhat.config.js   # Hardhat configuration
└── README.md           # Project documentation
```

## 📜 Smart Contracts

- **Crowdfunding.sol**: Contains logic for funding, withdrawals, and contributor approvals.

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request with improvements, bug fixes, or suggestions.

## 📄 License

This project is licensed under the [MIT License].

---

For questions or feedback, please open an issue or reach out.
