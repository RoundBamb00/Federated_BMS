import { useEffect, useRef, useState } from 'react';
import { COMMANDS, FrameParser, PackResolver, parseFrame, summarize } from './protocol.js';
import { SerialConnection } from './serial.js';
import { languages } from './i18n.js';

const value = (v, digits = 0) => v == null ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
const time = stamp => new Date(stamp).toLocaleTimeString('en-GB', { hour12: false });
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
    <div className="soc-track" role="progressbar" aria-label={`PACK ${index} SOC`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pack ? Math.max(0, Math.min(100, pack.soc)) : undefined} aria-valuetext={pack ? `${pack.soc}%` : t.waiting}><span style={{ width: `${Math.max(0, Math.min(100, pack?.soc ?? 0))}%` }} /></div>
    <div className="cell-heading"><h3>{t.cells}</h3><span>mV</span></div>
    <div className="cell-grid">{cells.map((cell, i) => <div className="cell" key={i}><span>C{String((index - 1) * 12 + i + 1).padStart(2, '0')}</span><strong>{value(cell)}</strong></div>)}</div>
    <dl className="pack-details">
      <Measure label={t.current} number={pack?.currentA} unit="A" digits={2} />
      <Measure label={t.temp1} number={pack?.temp1} unit="°C" /><Measure label={t.temp2} number={pack?.temp2} unit="°C" />
      <Measure label={t.max} number={maximum} unit="mV" /><Measure label={t.min} number={minimum} unit="mV" />
      <Measure label={t.delta} number={valid.length ? Math.max(...valid) - Math.min(...valid) : null} unit="mV" />
    </dl>
    <div className="mos-row">{[['discharge', 'dsgOn'], ['charge', 'chgOn']].map(([label, key]) => <span key={key}>{t[label]} <b className={pack?.[key] ? 'mos-on' : ''}>{pack ? t[pack[key] ? 'on' : 'off'] : '—'}</b></span>)}</div>
    <footer className="pack-footer"><span>{t.last} {pack ? time(pack.receivedAt) : '—'}</span><span>{pack ? `${pack.rawLen} ${t.bytes}` : '—'}</span></footer>
  </section>;
}

export default function App() {
  const [language, setLanguage] = useState('zh');
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
  const summary = summarize(packs);
  const summaryState = !packs[1] || !packs[2] ? 'partial' : !connected ? 'historical' : [1, 2].some(i => freshness(packs[i], connected, now) === 'stale') ? 'stale' : 'fresh';
  const addLog = (key, detail = '') => setLogs(old => [{ at: Date.now(), key, detail }, ...old].slice(0, 300));

  useEffect(() => { document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'; }, [language]);
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(interval); void connection.current?.disconnect(); };
  }, []);

  async function connect() {
    if (connection.current && connection.current.state !== 'closed') return;
    setError(''); setPacks({}); setCount(0);
    const parser = new FrameParser(length), resolver = new PackResolver(alternate);
    const serial = new SerialConnection(navigator.serial, {
      onState: next => { setState(next); if (next === 'open' || next === 'closed') addLog(next); },
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

  async function send(command) {
    setSending(true); setError('');
    try { await connection.current.send(command); addLog('sent', `${command} · ${hex(COMMANDS[command])}`); }
    catch (err) { setError(err.message); addLog('failure', err.message); }
    finally { setSending(false); }
  }

  return <div className="app-shell">
    <a className="skip-link" href="#monitor">{t.skip}</a>
    <aside className="sidebar">
      <a className="brand" href="#monitor">Federated<span>BMS</span></a>
      <nav aria-label={language === 'zh' ? '主导航' : 'Main navigation'}>
        <a href="#monitor" className="nav-main">{t.monitor}<span>24S</span></a>
        <a href="#settings">{t.settings}</a><a href="#logs">{t.logs}</a>
      </nav>
      <div className="sidebar-note"><span className="connection-mark" />{t.noCloud}<small>{t.private}</small></div>
    </aside>
    <main id="monitor">
      <header className="topbar"><span>{t.local}</span><label className="language-select"><span className="sr-only">{t.language}</span><select value={language} onChange={e => setLanguage(e.target.value)}><option value="zh">中文</option><option value="en">English</option></select></label></header>
      <div className="page-heading"><div><h1>{t.subtitle}</h1><p>{t.description}</p></div><div className="connection-actions"><span role="status" className={`status ${connected ? 'fresh' : ''}`}><i />{t[state]}</span><button className="primary" disabled={!supported || busy || sending} onClick={connected ? () => void connection.current.disconnect() : connect}>{busy ? t[state] : connected ? t.disconnect : t.connect}</button></div></div>
      {!supported ? <p className="notice" role="status">{t.unsupported}</p> : !connected && <p className="connect-hint">{t.connectHint}</p>}
      {window.self !== window.top && <p className="notice">{t.iframe}</p>}
      {error && <div className="notice error" role="alert"><strong>{t.failure}</strong><p>{error}</p><p>{t.retryHint}</p></div>}
      <section className="summary panel" aria-labelledby="summary-title">
        <div className="summary-heading"><h2 id="summary-title">{t.summary}</h2><span className={`status ${summaryState}`}><i />{t[summaryState]}</span></div>
        <dl className="summary-values"><Measure label={t.total} number={summary.totalMv} unit="mV" testId="total-voltage" /><Measure label={t.avgSoc} number={summary.soc} unit="%" /><Measure label={t.max} number={summary.maxMv} unit="mV" /><Measure label={t.min} number={summary.minMv} unit="mV" /><Measure label={t.delta} number={summary.deltaMv} unit="mV" /></dl>
      </section>
      <div className="packs">{[1, 2].map(index => <PackPanel key={index} {...{ index, t, connected, now }} pack={packs[index]} />)}</div>
      <section className="controls panel" aria-labelledby="controls-title"><div className="section-title"><div><h2 id="controls-title">{t.controls}</h2><p>{t.commandHint}</p></div><button className="quiet" onClick={() => { setPacks({}); addLog('cleared'); }}>{t.clear}</button></div>
        <div className="control-buttons">{[['start', 'stop'], ['openDsg', 'closeDsg'], ['openChg', 'closeChg']].map(group => <div className="button-pair" key={group[0]}>{group.map((command, i) => <button key={command} className={i === 0 ? 'positive' : ''} disabled={!connected || sending} onClick={() => send(command)}>{t[command]}</button>)}</div>)}</div>
      </section>
      <div className="bottom-grid">
        <section id="settings" className="panel settings" aria-labelledby="settings-title"><h2 id="settings-title">{t.settings}</h2><p>{t.formatHint}</p>
          <div className="settings-fields"><label>{t.baud}<select value={baud} disabled={state !== 'closed'} onChange={e => setBaud(Number(e.target.value))}>{[9600, 19200, 38400, 57600, 115200].map(rate => <option key={rate} value={rate}>{rate}</option>)}</select></label>
          <label>{t.format}<select value={length} disabled={state !== 'closed'} onChange={e => setLength(Number(e.target.value))}><option value={40}>{t.short}</option><option value={46}>{t.legacy}</option></select></label></div>
          <label className="checkbox"><input type="checkbox" checked={alternate} disabled={state !== 'closed'} onChange={e => setAlternate(e.target.checked)} />{t.alternate}</label><p className="field-hint">{t.alternateHint}</p>
           <div className="driver-downloads" aria-labelledby="drivers-title"><h3 id="drivers-title">{t.drivers}</h3><p>{t.driverHint}</p><ul>
             <li><a href="https://github.com/WCHSoftGroup/ch34xser_macos/raw/refs/heads/main/CH34xVCPDriver.dmg" target="_blank" rel="noopener noreferrer">{t.driverMac}</a></li>
             <li><a href="https://www.wch.cn/downloads/CH341SER_EXE.html" target="_blank" rel="noopener noreferrer">{t.driverWindows}</a></li>
             <li><a href="https://github.com/WCHSoftGroup/ch34xser_macos/blob/main/CH34X_DRV_INSTAL_INSTRUCTIONS.pdf" target="_blank" rel="noopener noreferrer">{t.driverInstructions}</a></li>
           </ul></div>
          <div className="protocol-note"><h3>{t.protocol}</h3><p>{t.protocolHint}</p><p>{t.sourceHint}</p></div>
        </section>
        <section id="logs" className="panel log-panel" aria-labelledby="logs-title"><div className="section-title"><div><h2 id="logs-title">{t.logs}</h2><p>{t.frameCount}: <b>{count}</b></p></div><button className="quiet" onClick={() => setLogs([])}>{t.clearLog}</button></div><div className="log-output" tabIndex={0} aria-label={t.logs}>{logs.length ? <ol>{logs.map((log, i) => <li key={`${log.at}-${i}`}><time>{time(log.at)}</time><span>{t[log.key]}{log.detail ? ` · ${log.detail}` : ''}</span></li>)}</ol> : <p className="empty-log">{t.emptyLog}</p>}</div></section>
      </div>
      <footer className="page-footer"><span>Federated BMS</span><span>24S / 2 × 12S</span><span>{t.private}</span></footer>
    </main>
  </div>;
}
