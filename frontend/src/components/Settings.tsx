import { useState } from 'react'
import { useApp } from '../context/AppContext'

export function Settings() {
  const { backendUrl, saveBackendUrl, setSettingsOpen, darkMode, toggleDarkMode } = useApp()
  const [url, setUrl] = useState(backendUrl)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null)

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(4000) })
      setTestResult(res.ok ? 'ok' : 'fail')
    } catch {
      setTestResult('fail')
    } finally {
      setTesting(false)
    }
  }

  const save = () => {
    saveBackendUrl(url.trim())
    setSettingsOpen(false)
  }

  return (
    <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={() => setSettingsOpen(false)}>✕</button>
        </div>

        <div className="modal-body">
          <section className="settings-section">
            <h3>Backend URL</h3>
            <p className="settings-hint">
              Enter your laptop's local IP so your iPad can reach the backend over WiFi.<br />
              Example: <code>http://192.168.1.42:8000</code>
            </p>
            <div className="input-row">
              <input
                className="text-input"
                value={url}
                onChange={e => { setUrl(e.target.value); setTestResult(null) }}
                placeholder="http://192.168.1.x:8000"
                spellCheck={false}
              />
              <button className="btn-secondary" onClick={testConnection} disabled={testing}>
                {testing ? 'Testing…' : 'Test'}
              </button>
            </div>
            {testResult === 'ok' && <p className="status-ok">✓ Connected</p>}
            {testResult === 'fail' && <p className="status-err">✗ Could not reach backend</p>}
          </section>

          <section className="settings-section">
            <h3>Appearance</h3>
            <div className="toggle-row">
              <span>Dark mode</span>
              <button
                className={`toggle ${darkMode ? 'on' : 'off'}`}
                onClick={toggleDarkMode}
                aria-pressed={darkMode}
              >
                <span className="toggle-thumb" />
              </button>
            </div>
          </section>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => setSettingsOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}
