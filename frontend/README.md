# 📋 Stellar Todo — Decentralized Task Manager

A fully on-chain Todo dApp built on the **Stellar blockchain** using **Soroban smart contracts** and **React + Vite** frontend. Tasks are stored permanently on the Stellar Testnet — no backend, no database, just the blockchain.

---

## 🌐 Live Demo

🔗 **Live App:** [https://stellar-internship-level-3.vercel.app](https://stellar-internship-level-3.vercel.app)

📦 **GitHub:** [https://github.com/vaiii05-hub/Stellar-Internship-Level-3](https://github.com/vaiii05-hub/Stellar-Internship-Level-3)

🔑 **Contract ID:** CDPRB4H7NMOA6JGLPAHTLUMBWAYGYZ3563URVPDBAIZIXJCHY34IV6SP

🌍 **Network:** Stellar Testnet

---

## ✨ Features

- ✅ Add tasks — stored permanently on-chain
- ✅ Complete tasks — mark as done on the blockchain
- ✅ Delete tasks — remove from on-chain storage
- ✅ Freighter wallet integration — sign transactions in-browser
- ✅ Real-time polling — auto-refreshes every 10 seconds
- ✅ No backend — 100% decentralized

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Blockchain | Stellar Testnet (Soroban) |
| Smart Contract | Rust + Soroban SDK |
| Frontend | React 18 + Vite |
| Wallet | Freighter Browser Extension |
| Stellar SDK | @stellar/stellar-sdk v14.5.0 |
| Deployment | Vercel |

---

## 📁 Project Structure

```
stellar-todo/
├── contracts/
│   └── todo/
│       ├── src/
│       │   └── lib.rs                          # Rust smart contract
│       ├── test_snapshots/
│       │   └── test/
│       │       ├── test_add_todo.1.json        # Test snapshot
│       │       ├── test_complete_todo.1.json   # Test snapshot
│       │       ├── test_delete_todo.1.json     # Test snapshot
│       │       ├── test_get_todos_empty.1.json # Test snapshot
│       │       └── test_multiple_todos.1.json  # Test snapshot
│       ├── .gitignore
│       └── Cargo.toml
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   │   └── react.svg
│   │   ├── App.css                             # Styles
│   │   ├── App.jsx                             # Main React component
│   │   ├── index.css
│   │   └── main.jsx                            # Entry point
│   ├── public/
│   │   └── vite.svg
│   ├── Level 3 SS/                             # Project Screenshots
│   │   ├── UI.png
│   │   ├── Wallet Connection.png
│   │   ├── Saved Task.png
│   │   ├── Task Saved.png
│   │   ├── Completed Task.png
│   │   ├── Transaction Confirmation.png
│   │   └── Passed test.png
│   ├── .env                                    # Contract ID config
│   ├── .gitignore
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
├── Cargo.toml
├── Cargo.lock
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Rust](https://www.rust-lang.org/tools/install)
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/stellar-cli)
- [Freighter Wallet](https://freighter.app/) browser extension

---

### 1. Clone the Repository

```bash
git clone https://github.com/vaiii05-hub/Stellar-Internship-Level-3.git
cd Stellar-Internship-Level-3
```

---

### 2. Deploy the Smart Contract

```bash
# Build the contract
stellar contract build

# Deploy to Testnet
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/todo.wasm \
  --source YOUR_ACCOUNT \
  --network testnet
```

Copy the returned **Contract ID**.

---

### 3. Configure the Frontend

```bash
cd frontend
```

Create a `.env` file:

```env
VITE_CONTRACT_ID=YOUR_CONTRACT_ID_HERE
```

---

### 4. Install Dependencies and Run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

### 5. Get Testnet XLM (for gas fees)

```
https://friendbot.stellar.org/?addr=YOUR_WALLET_ADDRESS
```

---

## 🧪 Running Tests

```bash
# From the project root
cargo test
```

Expected output:

```
test test_add_todo ... ok
test test_complete_todo ... ok
test test_delete_todo ... ok
test test_get_todos_empty ... ok
test test_multiple_todos ... ok

test result: ok. 5 passed; 0 failed
```

### Test Coverage

| Test | Description |
|------|-------------|
| `test_add_todo` | Adds a task and verifies it appears in the list |
| `test_complete_todo` | Marks a task complete and checks status |
| `test_delete_todo` | Deletes a task and confirms removal |
| `test_get_todos_empty` | Verifies empty list on fresh contract |
| `test_multiple_todos` | Adds multiple tasks and validates all stored |

---

## 📖 Smart Contract Functions

| Function | Arguments | Description |
|----------|-----------|-------------|
| `add_todo` | `text: String` | Adds a new task on-chain |
| `complete_todo` | `id: u32` | Marks a task as completed |
| `delete_todo` | `id: u32` | Permanently deletes a task |
| `get_todos` | none | Returns all tasks |

---

## 🔄 How It Works

```
User types task
      ↓
React calls invokeContract("add_todo")
      ↓
Build Transaction → Simulate → Inject Soroban Data
      ↓
Freighter signs the XDR
      ↓
Submit to Stellar Testnet RPC
      ↓
Poll until SUCCESS
      ↓
Fetch updated todos from chain
```

---

## 🦊 Wallet Setup

1. Install [Freighter](https://freighter.app/) from Chrome Web Store
2. Create or import a Stellar wallet
3. Switch network to **Testnet** in Freighter settings
4. Fund your wallet using [Friendbot](https://friendbot.stellar.org/)
5. Click **Connect Freighter Wallet** in the app

---

## 📸 Screenshots

### UI
![UI](Level%203%20SS/UI.png.png)

### Wallet Connection
![Wallet](Level%203%20SS/Wallet%20Connection.png.png)

### Task Saved
![Task Saved](Level%203%20SS/Task%20Saved.png.png)

### Completed Task
![Completed](Level%203%20SS/Completed%20Task.png.png)

### Tests Passing
![Tests](Level%203%20SS/Passed%20test.png.png)

---



## 📝 Commit History

```
✅ Add complete README with setup and deployment instructions
✅ Add gitignore for contracts
✅ Add Soroban todo smart contract with add, complete, delete, get_todos functions
```

---

## 🧑‍💻 Author

**vaiii05-hub**
Built for the Stellar Soroban Mini-dApp Internship — Level 3

---

## 📄 License

MIT
