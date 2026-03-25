import './App.css';
import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080';
const STORAGE_KEY = 'expense_reimbursement_auth';

const CATEGORY_OPTIONS = ['FOOD', 'TRAVEL', 'OFFICE'];

function readStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function App() {
  const [authMode, setAuthMode] = useState('login');
  const [activeUser, setActiveUser] = useState(() => readStoredUser());
  const [isBusy, setIsBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'EMPLOYEE',
  });

  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    category: 'TRAVEL',
    remarks: '',
  });

  const [myExpenses, setMyExpenses] = useState([]);
  const [adminExpenses, setAdminExpenses] = useState([]);
  const [decisionRemarks, setDecisionRemarks] = useState({});

  const isAdmin = useMemo(() => activeUser?.role === 'ADMIN', [activeUser]);

  function persistUser(user) {
    setActiveUser(user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setActiveUser(null);
    setMyExpenses([]);
    setAdminExpenses([]);
    setFeedback('Signed out successfully.');
    setError('');
  }

  async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      method: options.method || 'GET',
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message =
        (typeof payload === 'object' && payload?.message) ||
        (typeof payload === 'string' && payload) ||
        'Something went wrong while contacting the API.';
      throw new Error(message);
    }

    return payload;
  }

  async function handleLogin(event) {
    event.preventDefault();
    setError('');
    setFeedback('');
    setIsBusy(true);

    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: loginForm,
      });

      persistUser(data);
      setFeedback(`Welcome back, ${data.name || data.email}.`);
      setLoginForm({ email: '', password: '' });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSignup(event) {
    event.preventDefault();
    setError('');
    setFeedback('');
    setIsBusy(true);

    try {
      const data = await apiRequest('/api/auth/signup', {
        method: 'POST',
        body: signupForm,
      });

      persistUser(data);
      setFeedback(`Account created for ${data.name || data.email}.`);
      setSignupForm({ name: '', email: '', password: '', role: 'EMPLOYEE' });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsBusy(false);
    }
  }

  const loadMyExpenses = useCallback(async (token = activeUser?.token) => {
    if (!token) {
      return;
    }

    setError('');
    setIsBusy(true);
    try {
      const data = await apiRequest('/api/expenses', { token });
      setMyExpenses(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsBusy(false);
    }
  }, [activeUser?.token]);

  const loadAdminExpenses = useCallback(async (token = activeUser?.token) => {
    if (!token) {
      return;
    }

    setError('');
    setIsBusy(true);
    try {
      const data = await apiRequest('/api/admin/expenses', { token });
      setAdminExpenses(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsBusy(false);
    }
  }, [activeUser?.token]);

  useEffect(() => {
    if (!activeUser?.token) {
      return;
    }

    if (isAdmin) {
      void loadAdminExpenses(activeUser.token);
      return;
    }

    void loadMyExpenses(activeUser.token);
  }, [activeUser?.token, isAdmin, loadAdminExpenses, loadMyExpenses]);

  async function handleExpenseSubmit(event) {
    event.preventDefault();
    if (!activeUser?.token) {
      return;
    }

    setError('');
    setFeedback('');
    setIsBusy(true);

    try {
      await apiRequest('/api/expenses', {
        method: 'POST',
        token: activeUser.token,
        body: {
          amount: Number(expenseForm.amount),
          category: expenseForm.category,
          remarks: expenseForm.remarks,
        },
      });

      setExpenseForm({ amount: '', category: 'TRAVEL', remarks: '' });
      setFeedback('Expense submitted successfully.');
      await loadMyExpenses(activeUser.token);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDecision(expenseId, action) {
    if (!activeUser?.token) {
      return;
    }

    setError('');
    setFeedback('');
    setIsBusy(true);

    try {
      await apiRequest(`/api/admin/expenses/${expenseId}/${action}`, {
        method: 'PATCH',
        token: activeUser.token,
        body: {
          remarks: decisionRemarks[expenseId] || '',
        },
      });

      setFeedback(`Expense #${expenseId} ${action}d.`);
      await loadAdminExpenses(activeUser.token);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="page-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Expense Reimbursement</p>
          <h1>Reimbursements Hub</h1>
        </div>
        {activeUser ? (
          <div className="user-summary">
            <div>
              <strong>{activeUser.name || activeUser.email}</strong>
              <p>{activeUser.role}</p>
            </div>
            <button className="ghost-button" onClick={logout} type="button">
              Logout
            </button>
          </div>
        ) : null}
      </header>

      {feedback ? <p className="notice success">{feedback}</p> : null}
      {error ? <p className="notice error">{error}</p> : null}

      {!activeUser ? (
        <section className="panel auth-panel">
          <div className="tab-row" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              className={authMode === 'login' ? 'tab active' : 'tab'}
              onClick={() => setAuthMode('login')}
            >
              Login
            </button>
            <button
              type="button"
              className={authMode === 'signup' ? 'tab active' : 'tab'}
              onClick={() => setAuthMode('signup')}
            >
              Signup
            </button>
          </div>

          {authMode === 'login' ? (
            <form className="form-grid" onSubmit={handleLogin}>
              <label>
                Email
                <input
                  required
                  type="email"
                  value={loginForm.email}
                  onChange={(event) =>
                    setLoginForm((current) => ({ ...current, email: event.target.value }))
                  }
                />
              </label>
              <label>
                Password
                <input
                  required
                  type="password"
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm((current) => ({ ...current, password: event.target.value }))
                  }
                />
              </label>
              <button className="primary-button" type="submit" disabled={isBusy}>
                {isBusy ? 'Please wait...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form className="form-grid" onSubmit={handleSignup}>
              <label>
                Name
                <input
                  required
                  type="text"
                  minLength={1}
                  value={signupForm.name}
                  onChange={(event) =>
                    setSignupForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </label>
              <label>
                Email
                <input
                  required
                  type="email"
                  value={signupForm.email}
                  onChange={(event) =>
                    setSignupForm((current) => ({ ...current, email: event.target.value }))
                  }
                />
              </label>
              <label>
                Password
                <input
                  required
                  type="password"
                  minLength={6}
                  value={signupForm.password}
                  onChange={(event) =>
                    setSignupForm((current) => ({ ...current, password: event.target.value }))
                  }
                />
              </label>
              <label>
                Role
                <select
                  value={signupForm.role}
                  onChange={(event) =>
                    setSignupForm((current) => ({ ...current, role: event.target.value }))
                  }
                >
                  <option value="EMPLOYEE">EMPLOYEE</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </label>
              <button className="primary-button" type="submit" disabled={isBusy}>
                {isBusy ? 'Please wait...' : 'Create Account'}
              </button>
            </form>
          )}
        </section>
      ) : (
        <main className="dashboard-grid">
          {!isAdmin ? (
            <>
              <section className="panel">
                <h2>Submit Expense</h2>
                <form className="form-grid" onSubmit={handleExpenseSubmit}>
                  <label>
                    Amount
                    <input
                      required
                      min={0}
                      step="0.01"
                      type="number"
                      value={expenseForm.amount}
                      onChange={(event) =>
                        setExpenseForm((current) => ({ ...current, amount: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Category
                    <select
                      value={expenseForm.category}
                      onChange={(event) =>
                        setExpenseForm((current) => ({ ...current, category: event.target.value }))
                      }
                    >
                      {CATEGORY_OPTIONS.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Remarks
                    <textarea
                      maxLength={500}
                      rows={3}
                      value={expenseForm.remarks}
                      onChange={(event) =>
                        setExpenseForm((current) => ({ ...current, remarks: event.target.value }))
                      }
                    />
                  </label>
                  <button className="primary-button" type="submit" disabled={isBusy}>
                    {isBusy ? 'Submitting...' : 'Submit Expense'}
                  </button>
                </form>
              </section>

              <section className="panel">
                <div className="panel-title-row">
                  <h2>My Expenses</h2>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => loadMyExpenses(activeUser.token)}
                    disabled={isBusy}
                  >
                    Refresh
                  </button>
                </div>
                <ExpenseTable expenses={myExpenses} />
              </section>
            </>
          ) : (
            <section className="panel full-width">
              <div className="panel-title-row">
                <h2>Admin Review Queue</h2>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => loadAdminExpenses(activeUser.token)}
                  disabled={isBusy}
                >
                  Refresh
                </button>
              </div>
              <AdminExpenseTable
                decisionRemarks={decisionRemarks}
                expenses={adminExpenses}
                isBusy={isBusy}
                onApprove={(expenseId) => handleDecision(expenseId, 'approve')}
                onReject={(expenseId) => handleDecision(expenseId, 'reject')}
                onRemarksChange={(expenseId, value) =>
                  setDecisionRemarks((current) => ({ ...current, [expenseId]: value }))
                }
              />
            </section>
          )}
        </main>
      )}
    </div>
  );
}

function ExpenseTable({ expenses }) {
  if (!expenses.length) {
    return <p className="empty-state">No expenses found yet.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Amount</th>
            <th>Category</th>
            <th>Status</th>
            <th>Remarks</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => (
            <tr key={expense.id}>
              <td>#{expense.id}</td>
              <td>{formatAmount(expense.amount)}</td>
              <td>{expense.category}</td>
              <td>
                <span className={`status-pill ${expense.status?.toLowerCase()}`}>
                  {expense.status}
                </span>
              </td>
              <td>{expense.remarks || '-'}</td>
              <td>{formatDate(expense.updatedAt || expense.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminExpenseTable({
  expenses,
  decisionRemarks,
  onRemarksChange,
  onApprove,
  onReject,
  isBusy,
}) {
  if (!expenses.length) {
    return <p className="empty-state">No submitted expenses are waiting right now.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Employee</th>
            <th>Amount</th>
            <th>Category</th>
            <th>Status</th>
            <th>Decision Remarks</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => {
            const isPending = expense.status === 'PENDING';
            return (
              <tr key={expense.id}>
                <td>#{expense.id}</td>
                <td>{expense.submittedBy}</td>
                <td>{formatAmount(expense.amount)}</td>
                <td>{expense.category}</td>
                <td>
                  <span className={`status-pill ${expense.status?.toLowerCase()}`}>
                    {expense.status}
                  </span>
                </td>
                <td>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={decisionRemarks[expense.id] || ''}
                    onChange={(event) => onRemarksChange(expense.id, event.target.value)}
                    placeholder={expense.remarks || 'Optional decision note'}
                  />
                </td>
                <td>
                  <div className="action-row">
                    <button
                      className="approve-button"
                      disabled={isBusy || !isPending}
                      type="button"
                      onClick={() => onApprove(expense.id)}
                    >
                      Approve
                    </button>
                    <button
                      className="reject-button"
                      disabled={isBusy || !isPending}
                      type="button"
                      onClick={() => onReject(expense.id)}
                    >
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatAmount(value) {
  if (typeof value !== 'number') {
    return '-';
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateString) {
  if (!dateString) {
    return '-';
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return date.toLocaleString();
}

export default App;
