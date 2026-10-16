import { useEffect, useRef, useState } from 'react';
import { COMMANDS, FrameParser, PackResolver, parseFrame, summarize } from './protocol.js';
import { SerialConnection } from './serial.js';
import { languages } from './i18n.js';

const value = (v, digits = 0) => v == null ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
const time = stamp => new Date(stamp).toLocaleTimeString('en-GB', { hour12: false });
const currentView = () => ['monitor', 'settings', 'logs'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'monitor';
const freshness = (pack, connected, now) => !pack ? 'waiting' : !connected ? 'historical' : now - pack.receivedAt > 5000 ? 'stale' : 'fresh';

function Measure({ label, number, unit, digits = 0, testId }) {
  return <div className="measure"><dt>{label}</dt><dd><span data-testid={testId}>{value(number, digits)}</span>{unit && <small>{unit}</small>}</dd></div>;
}

function PackPanel({ index, pack, t, connected, now }) {
  const state = freshness(pack, connected, now);
  const cells = pack?.cellsMv ?? Array(12).fill(null);
  const valid = cells.filter(v => v != null);
  const maximum = pack?.maxMv ?? (valid.length ? Math.max(...valid) : null);
  const minimum = pack?.minMv ?? (valid.length ? Math.min(...valid) : null);
  const total = pack?.totalMv ?? (valid.length ? valid.reduce((a, b) => a + b, 0) : null);
  return <section className={`pack panel ${state}`} data-testid={`pack-${index}`} aria-labelledby={`pack-title-${index}`}>
    <header className="panel-heading">
      <div className="pack-title"><span className="pack-number">{String(index).padStart(2, '0')}</span><div><h2 id={`pack-title-${index}`}>PACK {index}</h2><p>{t.board}</p></div></div>
      <span className={`status ${state}`}><i />{t[state]}</span>
    </header>
    <dl className="pack-primary"><Measure label={t.total} number={total} unit="mV" /><Measure label="SOC" number={pack?.soc} unit="%" /></dl>
    <div className="soc-track" role="progressbar" aria-label={`PACK ${index} SOC`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pack?.soc != null ? Math.max(0, Math.min(100, pack.soc)) : undefined} aria-valuetext={pack?.soc != null ? `${pack.soc}%` : t.waiting}><span style={{ width: `${Math.max(0, Math.min(100, pack?.soc ?? 0))}%` }} /></div>
    <div className="cell-heading"><h3>{t.cells}</h3><span>mV</span></div>
    <div className="cell-grid">{cells.map((cell, i) => <div className="cell" key={i}><span>C{String((index - 1) * 12 + i + 1).padStart(2, '0')}</span><strong>{value(cell)}</strong></div>)}</div>
    <dl className="pack-details">
      <Measure label={t.current} number={pack?.currentA} unit="A" digits={2} />
      <Measure label={t.temp1} number={pack?.temp1} unit="°C" /><Measure label={t.temp2} number={pack?.temp2} unit="°C" />
      <Measure label={t.max} number={maximum} unit="mV" /><Measure label={t.min} number={minimum} unit="mV" />
      <Measure label={t.delta} number={valid.length ? Math.max(...valid) - Math.min(...valid) : null} unit="mV" />
    </dl>
    <div className="mos-row">{[['discharge', 'dsgOn'], ['charge', 'chgOn']].map(([label, key]) => <span key={key}>{t[label]} <b className={pack?.[key] ? 'mos-on' : ''}>{pack?.[key] != null ? t[pack[key] ? 'on' : 'off'] : '—'}</b></span>)}</div>
    <footer className="pack-footer"><span>{t.last} {pack ? time(pack.receivedAt) : '—'}</span><span>{pack ? `${pack.rawLen} ${t.bytes}` : '—'}</span></footer>
  </section>;
}

export default function App() {
  const [language, setLanguage] = useState('en');
  const [view, setView] = useState(currentView);
  const [mode, setMode] = useState(24);
  const [requests, setRequests] = useState({});
  const [pending, setPending] = useState({});
  const [state, setState] = useState('closed');
  const [packs, setPacks] = useState({});
  const [logs, setLogs] = useState([]);
  const [count, setCount] = useState(0);
  const [baud, setBaud] = useState(115200);
  const [length, setLength] = useState(46);
  const [alternate, setAlternate] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const connection = useRef(null);
  const t = languages[language];
  const supported = Boolean(navigator.serial && window.isSecureContext);
  const connected = state === 'open';
  const busy = state !== 'closed' && !connected;
  const indices = mode === 36 ? [1, 2, 3] : [1, 2];
  const summary = summarize(packs, indices.length);
  const summaryState = indices.some(i => !packs[i]) ? 'partial' : !connected ? 'historical' : indices.some(i => freshness(packs[i], connected, now) === 'stale') ? 'stale' : 'fresh';
  const addLog = (key, detail = '') => setLogs(old => [{ at: Date.now(), key, detail }, ...old].slice(0, 300));

  useEffect(() => {
    const update = () => setView(currentView());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  useEffect(() => { document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'; }, [language]);
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(interval); void connection.current?.disconnect(); };
  }, []);

  useEffect(() => {
    setPending(old => {
      const next = { ...old };
      for (const [key, request] of Object.entries(old)) {
        const field = key === 'discharge' ? 'dsgOn' : 'chgOn';
        if ([1, 2].every(i => packs[i]?.receivedAt > request.at && packs[i]?.[field] === request.target)) delete next[key];
      }
      return Object.keys(next).length === Object.keys(old).length ? old : next;
    });
  }, [packs]);

  async function connect() {
    if (connection.current && connection.current.state !== 'closed') return;
    setError(''); setPacks({}); setCount(0); setRequests({}); setPending({});
    const parser = new FrameParser(mode === 36 ? 50 : length), resolver = new PackResolver(alternate, indices.length);
    const serial = new SerialConnection(navigator.serial, {
      onState: next => { setState(next); if (next === 'closed') { setRequests({}); setPending({}); } if (next === 'open' || next === 'closed') addLog(next); },
      onError: err => { setError(err.message); addLog('failure', err.message); },
      onData: bytes => {
        addLog('received', `${bytes.length} B · ${hex(bytes.slice(0, 256))}${bytes.length > 256 ? ' …' : ''}`);
        for (const raw of parser.feed(bytes)) {
          const pack = parseFrame(raw, resolver.resolve(raw[1]));
          pack.receivedAt = Date.now();
          setPacks(old => ({ ...old, [pack.packIndex]: pack }));
          setCount(n => n + 1);
        }
      },
    });
    connection.current = serial;
    try { await serial.connect(baud); }
    catch (err) {
      if (err.name === 'NotFoundError') addLog('cancelled');
      else { setError(err.message); addLog('failure', err.message); }
    }
  }

  async function send(command, key, target) {
    if (sending || !connected) return;
    setSending(true); setError('');
    try { await connection.current.send(command); addLog('sent', `${command} · ${hex(COMMANDS[command])}`); setRequests(old => ({ ...old, [key]: target }));
      if (mode === 24 && key !== 'acquisition') setPending(old => ({ ...old, [key]: { at: Date.now(), target } })); }
    catch (err) { setError(err.message); addLog('failure', err.message); }
    finally { setSending(false); }
  }

  function control(key, label, openCommand, closeCommand) {
    const requestOnly = key === 'acquisition' || mode === 36;
    const field = key === 'discharge' ? 'dsgOn' : 'chgOn';
    const fresh = indices.every(i => freshness(packs[i], connected, now) === 'fresh');
    const coherent = fresh && indices.every(i => packs[i][field] === packs[1][field] && packs[i][field] != null);
    const on = requestOnly ? requests[key] === true : coherent ? packs[1][field] : null;
    const action = on ? closeCommand : openCommand;
    const wait = pending[key];
    const confirmed = wait && coherent && indices.every(i => packs[i].receivedAt > wait.at && packs[i][field] === wait.target);
    const waiting = wait && !confirmed && now - wait.at < 5000;
    const status = requestOnly ? (requests[key] == null ? t.noRequest : `${t.requested}: ${t[requests[key] ? openCommand : closeCommand]}`)
      : waiting ? t.pending : wait && !confirmed ? t.unconfirmed : coherent ? t[on ? 'on' : 'off'] : fresh ? t.mixed : t.waitingTelemetry;
    return <section className="control-card" key={key} aria-label={label}>
      <h3>{label}</h3><p role="status">{status}</p>
      <button className="positive" disabled={!connected || sending || (!requestOnly && (!coherent || waiting))} onClick={() => send(action, key, !on)}>{!requestOnly && !coherent ? t.unavailable : t[action]}</button>
      <small>{requestOnly ? t.requestHint : t.telemetryHint}</small>
    </section>;
  }

  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content').focus(); }}>{t.skip}</a>
    <aside className="sidebar">
      <a className="brand" href="#monitor">Federated<span>BMS</span></a>
      <nav aria-label={language === 'zh' ? '主导航' : 'Main navigation'}>
        {['monitor', 'settings', 'logs'].map(item => <a key={item} href={`#${item}`} aria-current={view === item ? 'page' : undefined}>{t[item]}{item === 'monitor' && <span>{mode}S</span>}</a>)}
      </nav>
      <div className="sidebar-note"><span className="connection-mark" />{t.noCloud}<small>{t.private}</small></div>
    </aside>
    <main id="main-content" tabIndex={-1}>
      <header className="topbar"><span>{t.local}</span><label className="language-select"><span className="sr-only">{t.language}</span><select value={language} onChange={e => setLanguage(e.target.value)}><option value="zh">中文</option><option value="en">English</option></select></label></header>
      <div className="page-heading"><div><h1>{view === 'monitor' ? `${mode}S ${t.subtitle}` : t[view]}</h1><p>{mode}S / {indices.length} × 12S · {t.description}</p></div><div className="connection-actions"><span role="status" className={`status ${connected ? 'fresh' : ''}`}><i />{t[state]}</span><button className="primary" disabled={!supported || busy || sending} onClick={connected ? () => void connection.current.disconnect() : connect}>{busy ? t[state] : connected ? t.disconnect : t.connect}</button></div></div>
      {!supported ? <p className="notice" role="status">{t.unsupported}</p> : !connected && <p className="connect-hint">{t.connectHint}</p>}
      {window.self !== window.top && <p className="notice">{t.iframe}</p>}
      {error && <div className="notice error" role="alert"><strong>{t.failure}</strong><p>{error}</p><p>{t.retryHint}</p></div>}
      {view === 'monitor' && <>
      <section className="summary panel" aria-labelledby="summary-title">
        <div className="summary-heading"><h2 id="summary-title">{mode}S {t.summary}</h2><span className={`status ${summaryState}`}><i />{t[summaryState]}</span></div>
        <dl className="summary-values"><Measure label={t.total} number={summary.totalMv} unit="mV" testId="total-voltage" /><Measure label={t.avgSoc} number={summary.soc} unit="%" /><Measure label={t.max} number={summary.maxMv} unit="mV" /><Measure label={t.min} number={summary.minMv} unit="mV" /><Measure label={t.delta} number={summary.deltaMv} unit="mV" /></dl>
      </section>
      <div className="packs">{indices.map(index => <PackPanel key={index} {...{ index, t, connected, now }} pack={packs[index]} />)}</div>
      <section className="controls panel" aria-labelledby="controls-title"><div className="section-title"><div><h2 id="controls-title">{t.controls}</h2><p>{t.commandHint}</p></div><button className="quiet" onClick={() => { setPacks({}); addLog('cleared'); }}>{t.clear}</button></div>
        <div className="control-buttons">{control('acquisition', t.acquisition, 'start', 'stop')}{control('discharge', t.discharge, 'openDsg', 'closeDsg')}{control('charge', t.charge, 'openChg', 'closeChg')}</div>
        {mode === 36 && <p className="field-hint">{t.mos36Hint}</p>}
      </section>
      </>}
      <div className="view-content">
        {view === 'settings' && <section id="settings" className="panel settings" aria-labelledby="settings-title"><h2 id="settings-title">{t.settings}</h2><p>{t.formatHint}</p>
          <div className="settings-fields"><label>{t.mode}<select value={mode} disabled={state !== 'closed'} onChange={e => { setMode(Number(e.target.value)); setPacks({}); setCount(0); setRequests({}); setPending({}); setLogs([]); setError(''); }}><option value={24}>24S / 2 × 12S</option><option value={36}>36S / 3 × 12S</option></select></label><label>{t.baud}<select value={baud} disabled={state !== 'closed'} onChange={e => setBaud(Number(e.target.value))}>{[9600, 19200, 38400, 57600, 115200].map(rate => <option key={rate} value={rate}>{rate}</option>)}</select></label>
          <label>{t.format}<select value={mode === 36 ? 50 : length} disabled={state !== 'closed' || mode === 36} onChange={e => setLength(Number(e.target.value))}>{mode === 36 ? <option value={50}>36S · 50 {t.bytes}</option> : <><option value={40}>{t.short}</option><option value={46}>{t.legacy}</option></>}</select></label></div>
          {mode === 24 && <><label className="checkbox"><input type="checkbox" checked={alternate} disabled={state !== 'closed'} onChange={e => setAlternate(e.target.checked)} />{t.alternate}</label><p className="field-hint">{t.alternateHint}</p></>}
           <div className="driver-downloads" aria-labelledby="drivers-title"><h3 id="drivers-title">{t.drivers}</h3><p>{t.driverHint}</p><ul>
             <li><a href="https://github.com/WCHSoftGroup/ch34xser_macos/raw/refs/heads/main/CH34xVCPDriver.dmg" target="_blank" rel="noopener noreferrer">{t.driverMac}</a></li>
             <li><a href="https://www.wch.cn/downloads/CH341SER_EXE.html" target="_blank" rel="noopener noreferrer">{t.driverWindows}</a></li>
             <li><a href="https://github.com/WCHSoftGroup/ch34xser_macos/blob/main/CH34X_DRV_INSTAL_INSTRUCTIONS.pdf" target="_blank" rel="noopener noreferrer">{t.driverInstructions}</a></li>
           </ul></div>
          <div className="protocol-note"><h3>{t.protocol}</h3><p>{t.protocolHint}</p><p>{t.sourceHint}</p></div>
        </section>}
        {view === 'logs' && <section id="logs" className="panel log-panel" aria-labelledby="logs-title"><div className="section-title"><div><h2 id="logs-title">{t.logs}</h2><p>{t.frameCount}: <b>{count}</b></p></div><button className="quiet" onClick={() => setLogs([])}>{t.clearLog}</button></div><div className="log-output" tabIndex={0} aria-label={t.logs}>{logs.length ? <ol>{logs.map((log, i) => <li key={`${log.at}-${i}`}><time>{time(log.at)}</time><span>{t[log.key]}{log.detail ? ` · ${log.detail}` : ''}</span></li>)}</ol> : <p className="empty-log">{t.emptyLog}</p>}</div></section>}
      </div>
      <footer className="page-footer"><span>Federated BMS</span><span>{mode}S / {indices.length} × 12S</span><span>{t.private}</span></footer>
    </main>
  </div>;
}
