import { useState, useEffect, useCallback } from "react";
import * as freighter from "@stellar/freighter-api";
import {
  Contract,
  TransactionBuilder,
  BASE_FEE,
  Networks,
  scValToNative,
  nativeToScVal,
  Keypair,
  Account,
} from "@stellar/stellar-sdk";
import { Server, Api } from "@stellar/stellar-sdk/rpc";
import "./App.css";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const CONTRACT_ID        = import.meta.env.VITE_CONTRACT_ID;
const NETWORK_PASSPHRASE = Networks.TESTNET;
const server             = new Server("https://soroban-testnet.stellar.org");

// ─────────────────────────────────────────────────────────────────────────────
// CACHE
// ─────────────────────────────────────────────────────────────────────────────
const cache = { todos: null, ts: null };
const TTL   = 5000;

const getCached    = ()        => cache.todos && Date.now() - cache.ts < TTL ? cache.todos : null;
const setCached    = (list)    => { cache.todos = list; cache.ts = Date.now(); };
const clearCached  = ()        => { cache.todos = null; cache.ts = null; };

// Fresh random account — avoids stale sequence-number errors on simulation
const makeSimAccount = () => new Account(Keypair.random().publicKey(), "0");

// ─────────────────────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [walletAddress, setWalletAddress] = useState(null);
  const [todos,         setTodos        ] = useState([]);
  const [newTodo,       setNewTodo      ] = useState("");
  const [loading,       setLoading      ] = useState(false);
  const [txLoading,     setTxLoading    ] = useState(false);
  const [txStatus,      setTxStatus     ] = useState("");
  const [error,         setError        ] = useState(null);
  const [success,       setSuccess      ] = useState(null);

  const flash = (setter, msg, ms = 4000) => {
    setter(msg);
    setTimeout(() => setter(null), ms);
  };
  const showError   = (msg) => flash(setError,   msg);
  const showSuccess = (msg) => flash(setSuccess,  msg, 3500);

  // ── CONNECT WALLET ─────────────────────────────────────────────────────────
  const connectWallet = async () => {
    try {
      setLoading(true);

      const conn       = await freighter.isConnected();
      const installed  = typeof conn === "object" ? conn?.isConnected : conn;
      if (!installed) {
        showError("Freighter not found — install it from freighter.app");
        return;
      }

      await freighter.requestAccess();

      const res  = await freighter.getAddress();
      const addr = typeof res === "string" ? res : res?.address;
      if (!addr) { showError("Could not read wallet address. Unlock Freighter and retry."); return; }

      setWalletAddress(addr);
      showSuccess("Wallet connected! 🎉");
    } catch (e) {
      showError(e?.message ?? "Connection failed.");
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = () => { setWalletAddress(null); setTxStatus(""); };

  // ── FETCH TODOS (read-only) ────────────────────────────────────────────────
  const fetchTodos = useCallback(async () => {
    const hit = getCached();
    if (hit) { setTodos(hit); return; }

    try {
      const tx = new TransactionBuilder(makeSimAccount(), {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(new Contract(CONTRACT_ID).call("get_todos"))
        .setTimeout(30)
        .build();

      const sim = await server.simulateTransaction(tx);

      if (Api.isSimulationSuccess(sim) && sim.result?.retval) {
        let val;
        try { val = scValToNative(sim.result.retval); } catch { val = []; }
        const list = Array.isArray(val) ? val : [];
        setCached(list);
        setTodos(list);
      } else {
        setCached([]);
        setTodos([]);
      }
    } catch (e) {
      console.error("fetchTodos:", e?.message ?? e);
      setTodos([]);
    }
  }, []);

  useEffect(() => {
    fetchTodos();
    const iv = setInterval(fetchTodos, 10_000);
    return () => clearInterval(iv);
  }, [fetchTodos]);

  // ── INVOKE CONTRACT (write) ────────────────────────────────────────────────
  //
  //  ROOT CAUSE OF "expected a Transaction, got [object Object]":
  //  ─────────────────────────────────────────────────────────────
  //  Both assembleTransaction() and server.prepareTransaction() return
  //  a TransactionBuilder (not a Transaction) in v14.x when called from
  //  a Vite/ESM context.  The SDK's internal XDR type-check then fails.
  //
  //  SOLUTION:
  //  ─────────
  //  1. Simulate manually            → get sorobanData + auth + minResourceFee
  //  2. Rebuild the transaction from scratch using the REAL source account,
  //     injecting sorobanData and auth directly via setSorobanData()
  //  3. The rebuilt tx is a genuine Transaction instance — no type errors.
  //
  const invokeContract = async (method, args = []) => {
    if (!walletAddress) { showError("Connect your wallet first!"); return null; }

    setTxLoading(true);
    clearCached();

    try {
      // ── 1. Fetch source account ─────────────────────────────────────────
      setTxStatus("Fetching account...");
      const sourceAccount = await server.getAccount(walletAddress);
      const contract      = new Contract(CONTRACT_ID);

      // ── 2. Build raw tx ─────────────────────────────────────────────────
      setTxStatus("Building transaction...");
      const rawTx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call(method, ...args))
        .setTimeout(30)
        .build();

      // ── 3. Simulate ─────────────────────────────────────────────────────
      setTxStatus("Simulating...");
      const sim = await server.simulateTransaction(rawTx);

      if (Api.isSimulationError(sim)) {
        throw new Error(`Simulation error: ${sim.error}`);
      }
      if (!Api.isSimulationSuccess(sim)) {
        throw new Error("Simulation returned unexpected result.");
      }

      // ── 4. Rebuild with soroban data injected ───────────────────────────
      //  Re-fetch account to get a fresh sequence number for the final tx
      setTxStatus("Preparing transaction...");
      const freshAccount = await server.getAccount(walletAddress);

      // Calculate total fee: base + soroban resource fee from simulation
      const resourceFee  = parseInt(sim.minResourceFee ?? "0", 10);
      const totalFee     = (parseInt(BASE_FEE, 10) + resourceFee).toString();

      // Build the final transaction with soroban data + auth injected
      const txBuilder = new TransactionBuilder(freshAccount, {
        fee: totalFee,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call(method, ...args))
        .setTimeout(30);

      // setSorobanData injects resource limits + footprint from simulation
      if (sim.transactionData) {
        txBuilder.setSorobanData(sim.transactionData.build());
      }

      const preparedTx = txBuilder.build();

      // Inject auth entries from simulation into the operation
      if (sim.result?.auth && preparedTx.operations[0]) {
        preparedTx.operations[0].auth = sim.result.auth;
      }

      // ── 5. Sign with Freighter ──────────────────────────────────────────
      setTxStatus("Waiting for Freighter approval...");
      const signResult = await freighter.signTransaction(preparedTx.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
        network: "TESTNET",
      });

      // Handle all Freighter API response shapes
      const signedXdr =
        typeof signResult === "string"
          ? signResult
          : signResult?.signedTxXdr
          ?? signResult?.result?.signedTxXdr;

      if (!signedXdr) throw new Error("Signing cancelled or failed.");

      const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

      // ── 6. Submit ───────────────────────────────────────────────────────
      setTxStatus("Submitting to network...");
      const submitResult = await server.sendTransaction(signedTx);

      if (submitResult.status === "ERROR") {
        const detail = submitResult.errorResult?.result()?.toString() ?? "Unknown error";
        throw new Error(`Submission failed: ${detail}`);
      }

      // ── 7. Poll for confirmation ────────────────────────────────────────
      setTxStatus("Confirming on blockchain...");
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const poll = await server.getTransaction(submitResult.hash);

        if (poll.status === "SUCCESS") {
          await fetchTodos();
          setTxStatus("");
          return poll;
        }
        if (poll.status === "FAILED") {
          throw new Error("Transaction rejected on-chain.");
        }
        // NOT_FOUND = still pending, keep polling
      }

      throw new Error("Timeout — check your tx on Stellar Expert.");

    } catch (e) {
      console.error("invokeContract error:", e?.message ?? e);
      showError(e?.message ?? "Transaction failed.");
      setTxStatus("");
      return null;
    } finally {
      setTxLoading(false);
    }
  };

  // ── ACTIONS ────────────────────────────────────────────────────────────────
  const addTodo = async () => {
    const text = newTodo.trim();
    if (!text) { showError("Please enter a task!"); return; }
    setNewTodo("");
    const res = await invokeContract("add_todo", [nativeToScVal(text, { type: "string" })]);
    if (res) showSuccess("Task saved to blockchain! ✅");
  };

  const completeTodo = async (id) => {
    const res = await invokeContract("complete_todo", [nativeToScVal(id, { type: "u32" })]);
    if (res) showSuccess("Task completed! 🎉");
  };

  const deleteTodo = async (id) => {
    const res = await invokeContract("delete_todo", [nativeToScVal(id, { type: "u32" })]);
    if (res) showSuccess("Task deleted! 🗑️");
  };

  const short = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      {error   && <div className="toast toast-error">⚠ {error}</div>}
      {success && <div className="toast toast-success">✓ {success}</div>}

      <div className="card">

        {/* ── Header ── */}
        <div className="card-header">
          <div className="card-logo">📋 Stellar Todo</div>
          <p className="card-tagline">Decentralized Tasks on Blockchain</p>
        </div>

        {/* ── Wallet ── */}
        {!walletAddress ? (
          <button className="btn btn-connect" onClick={connectWallet} disabled={loading}>
            {loading ? "Connecting..." : "🔗 Connect Freighter Wallet"}
          </button>
        ) : (
          <div className="wallet-bar">
            <span className="wallet-dot" />
            <span className="wallet-addr">{short(walletAddress)}</span>
            <button className="btn btn-disconnect" onClick={disconnectWallet}>Disconnect</button>
          </div>
        )}

        {/* ── Add task ── */}
        <div className="add-row">
          <input
            id="todo-input"
            name="todo"
            type="text"
            autoComplete="off"
            className="input"
            placeholder="Add a new task..."
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !txLoading && addTodo()}
            disabled={txLoading}
          />
          <button
            className="btn btn-add"
            onClick={addTodo}
            disabled={txLoading || !walletAddress}
          >
            {txLoading ? "..." : "Add"}
          </button>
        </div>

        {/* ── Progress ── */}
        {txLoading && (
          <div className="progress-wrap">
            <div className="progress-bar" />
            <p className="progress-text">{txStatus || "Processing..."}</p>
          </div>
        )}

        {/* ── List ── */}
        <div className="todo-list">
          {todos.length === 0 ? (
            <div className="empty">No tasks yet! Add your first task above ☝️</div>
          ) : (
            todos.map((todo, idx) => (
              <div
                key={todo.id ?? idx}
                className={`todo-item ${todo.completed ? "completed" : ""}`}
              >
                <span className="todo-text">{String(todo.text)}</span>
                <div className="todo-actions">
                  {!todo.completed && (
                    <button
                      className="btn btn-complete"
                      onClick={() => completeTodo(todo.id)}
                      disabled={txLoading}
                    >✓</button>
                  )}
                  <button
                    className="btn btn-delete"
                    onClick={() => deleteTodo(todo.id)}
                    disabled={txLoading}
                  >🗑</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Stats ── */}
        {todos.length > 0 && (
          <div className="stats">
            <span>Total   <strong>{todos.length}</strong></span>
            <span>Done    <strong>{todos.filter((t) => t.completed).length}</strong></span>
            <span>Pending <strong>{todos.filter((t) => !t.completed).length}</strong></span>
          </div>
        )}

        <p className="footer">Built with Soroban + React · Stellar Testnet</p>
      </div>
    </div>
  );
}
