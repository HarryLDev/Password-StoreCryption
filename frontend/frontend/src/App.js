import React, { useEffect, useState } from "react";

function api(path, method = "GET", body) {
  const headers = {};
  if (localStorage.token) headers["x-auth-token"] = localStorage.token;
  return fetch("/api/" + path, {
    method,
    headers: Object.assign({ "Content-Type": "application/json" }, headers),
    body: body ? JSON.stringify(body) : undefined,
  }).then((res) => res.json());
}

function generatePassword(length = 16, useSymbols = true) {
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const nums = "0123456789";
  const syms = "!@#$%^&*()-_=+[]{};:,<.>/?";
  let chars = lower + upper + nums + (useSymbols ? syms : "");
  let pwd = "";
  const cryptoObj = window.crypto || window.msCrypto;
  const array = new Uint32Array(length);
  cryptoObj.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    pwd += chars[array[i] % chars.length];
  }
  return pwd;
}

function escapeHtml(s = "") {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ])
  );
}

export default function App() {
  const [view, setView] = useState("loading"); // loading | setup | login | vault
  const [msg, setMsg] = useState("");
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // setup/login form states
  const [masterPW, setMasterPW] = useState("");
  const [loginPW, setLoginPW] = useState("");

  // add entry form
  const [site, setSite] = useState("");
  const [username, setUsername] = useState("");
  const [pwd, setPwd] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const status = await api("has-master");
        if (!status.hasMaster) {
          setView("setup");
        } else if (!localStorage.token) {
          setView("login");
        } else {
          setView("vault");
        }
      } catch (e) {
        setMsg("Network error");
        setView("login");
      }
    })();
  }, []);

  //Setup
  async function handleSetup() {
    setMsg("");
    if (!masterPW || masterPW.length < 8)
      return setMsg("Password must be at least 8 characters");
    try {
      const r = await api("setup-master", "POST", { password: masterPW });
      if (r.ok) {
        alert("Master password set. Please log in.");
        setMasterPW("");
        setView("login");
      } else {
        setMsg(r.error || "Error");
      }
    } catch {
      setMsg("Network error");
    }
  }

  // ---- Login ----
  async function handleLogin() {
    setMsg("");
    if (!loginPW) return setMsg("Enter password");
    try {
      const r = await api("login", "POST", { password: loginPW });
      if (r.token) {
        localStorage.token = r.token;
        setLoginPW("");
        setView("vault");
        await loadEntries();
      } else setMsg(r.error || "Login failed");
    } catch {
      setMsg("Network error");
    }
  }

  //Vault operations
  async function loadEntries() {
    setLoadingEntries(true);
    setMsg("");
    try {
      const r = await api("entries");
      if (r.error) {
        setMsg(r.error);
        if (r.error.toLowerCase().includes("unauthorized")) {
          localStorage.removeItem("token");
          setView("login");
        }
      } else {
        const mapped = (r.entries || []).map((e) => ({
          ...e,
          revealed: false,
        }));
        setEntries(mapped);
      }
    } catch {
      setMsg("Network error");
    } finally {
      setLoadingEntries(false);
    }
  }

  async function handleAddEntry() {
    setMsg("");
    if (!site || !username || !pwd) return setMsg("Missing fields");
    try {
      const r = await api("entry", "POST", { site, username, password: pwd });
      if (r.ok) {
        setSite("");
        setUsername("");
        setPwd("");
        await loadEntries();
      } else setMsg(r.error || "Error");
    } catch {
      setMsg("Network error");
    }
  }

  function toggleReveal(id) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, revealed: !e.revealed } : e))
    );
  }

  async function copyPassword(plaintext) {
    try {
      await navigator.clipboard.writeText(plaintext);
      alert("Password copied to clipboard");
    } catch {
      // fallback
      prompt("Copy this password", plaintext);
    }
  }

  async function handleLogout() {
    try {
      await api("logout", "POST");
    } catch {}
    localStorage.removeItem("token");
    setEntries([]);
    setView("login");
  }

  // Render sections
  if (view === "loading")
    return (
      <div style={styles.container}>
        <h1>Password StoreCryption</h1>
        <div>Loading…</div>
      </div>
    );

  return (
    <div style={styles.container}>
      <h1 style={{ marginBottom: 12 }}>Password StoreCryption</h1>

      {view === "setup" && (
        <div style={styles.card}>
          <h2>Set up master password</h2>
          <input
            type="password"
            placeholder="Create master password (min 8 chars)"
            value={masterPW}
            onChange={(e) => setMasterPW(e.target.value)}
            style={styles.input}
          />
          <button onClick={handleSetup} style={styles.button}>
            Create
          </button>
          <p style={{ color: "red" }}>{msg}</p>
        </div>
      )}

      {view === "login" && (
        <div style={styles.card}>
          <h2>Login</h2>
          <input
            type="password"
            placeholder="Master password"
            value={loginPW}
            onChange={(e) => setLoginPW(e.target.value)}
            style={styles.input}
          />
          <button onClick={handleLogin} style={styles.button}>
            Login
          </button>
          <p style={{ color: "red" }}>{msg}</p>
        </div>
      )}

      {view === "vault" && (
        <div style={styles.card}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h2>Your Vault</h2>
            <div>
              <button
                onClick={handleLogout}
                style={{ ...styles.button, background: "#e55353" }}
              >
                Logout
              </button>
              <button
                onClick={loadEntries}
                style={{
                  ...styles.button,
                  marginLeft: 8,
                  background: "#ddd",
                  color: "#000",
                }}
              >
                Refresh
              </button>
            </div>
          </div>

          {loadingEntries ? (
            <div>Loading…</div>
          ) : (
            <>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Site</th>
                    <th style={styles.th}>Username</th>
                    <th style={styles.th}>Password</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => {
                    const masked = "•".repeat(
                      e.password ? e.password.length : 8
                    );
                    return (
                      <tr key={e.id}>
                        <td style={styles.td}>{escapeHtml(e.site)}</td>
                        <td style={styles.td}>{escapeHtml(e.username)}</td>
                        <td style={styles.td}>
                          <div style={styles.passwordCell}>
                            {e.revealed ? (
                              <span style={styles.passwordRevealed}>
                                {e.password}
                              </span>
                            ) : (
                              <span style={styles.passwordHidden}>
                                ••••••••••
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={styles.td}>
                          <button
                            onClick={() => toggleReveal(e.id)}
                            style={styles.smallButton}
                          >
                            {e.revealed ? "Hide" : "Reveal"}
                          </button>
                          <button
                            onClick={() => copyPassword(e.password)}
                            style={{ ...styles.smallButton, marginLeft: 8 }}
                          >
                            Copy
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <h3 style={{ marginTop: 18 }}>Add Entry</h3>
              <input
                placeholder="site (example.com)"
                value={site}
                onChange={(e) => setSite(e.target.value)}
                style={styles.input}
              />
              <input
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={styles.input}
              />
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input
                  placeholder="password"
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  style={{ ...styles.input, flex: 1 }}
                />
                <button
                  onClick={() => setPwd(generatePassword(16, true))}
                  style={{ ...styles.button, padding: "8px 12px", width: 120 }}
                >
                  Generate
                </button>
              </div>
              <div>
                <button onClick={handleAddEntry} style={styles.button}>
                  Add Entry
                </button>
                <span style={{ color: "red", marginLeft: 12 }}>{msg}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// simple inline styles to avoid extra files
const styles = {
  container: {
    fontFamily: "Arial, sans-serif",
    maxWidth: 800,
    margin: "40px auto",
    padding: "0 10px",
  },
  card: {
    background: "#fff",
    padding: 12,
    borderRadius: 6,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  input: {
    padding: 8,
    margin: "6px 0",
    width: "100%",
    boxSizing: "border-box",
  },
  button: {
    padding: "8px 12px",
    margin: "6px 0",
    background: "#2b7cff",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
  },
  table: { width: "100%", borderCollapse: "collapse", marginTop: 12 },
  th: {
    borderBottom: "1px solid #ddd",
    textAlign: "left",
    padding: 8,
    color: "#555",
  },
  td: { borderBottom: "1px solid #eee", padding: 8, verticalAlign: "top" },
  passwordCell: {
    display: "inline-block",
    width: 150,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    fontFamily: "monospace",
  },
  passwordHidden: {
    letterSpacing: "3px",
    fontSize: "18px",
    color: "#555",
  },
  passwordRevealed: {
    fontFamily: "monospace",
  },
  smallButton: {
    padding: "6px 8px",
    borderRadius: 4,
    border: "none",
    background: "#4c6ef5",
    color: "#fff",
    cursor: "pointer",
  },
};
