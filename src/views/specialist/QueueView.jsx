import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { vobsApi } from '../../api/vobs';
import { followSubmitResult } from '../../hooks/useVobForm';
import { QUEUE_LIMIT } from '../../hooks/useRecordFilters';
import { VobDocumentPane } from '../../components/vob/VobDocumentPane';
import { useTranscriptExtraction, TranscriptExtractBody } from '../../components/vob/TranscriptExtractPanel';
import { fieldLabel } from '../../data/clients';
import { readVobDocument, readPastedVob, documentKind, isVobFile } from '../../utils/vobDocumentParser';
import { readTranscriptLocally } from '../../utils/transcriptReader';
import { compareVobWithCall, namesMatch, samePatient, documentCheckFor } from '../../utils/vobCompare';

const RESULT_LABELS = {
  match: '✅ MATCH',
  wrong: '❌ WRONG',
  missing: '⚠️ MISSING',
  not_mentioned: 'Not mentioned'
};

/** Whether a VOB names its patient: a name with letters, not a placeholder. */
const namesPatient = (fields) => /[a-z]/i.test(fields.patientName || '');

/**
 * The VOB records this user can open (`list`, for picking one by hand), and
 * those for the patient a VOB names (`matches`): the same name, and the same
 * date of birth when both have one. The list gives each record's name; the
 * ones that match are opened for their date of birth, and one that won't open
 * is still matched by its name.
 */
async function findPatientRecords(fields) {
  const list = (await vobsApi.getVobs({ limit: QUEUE_LIMIT }))
    .map(v => ({ id: v.id, patientName: v.patientName, dos: v.dos, status: v.status, vobStatus: v.vobStatus, updatedAt: v.updatedAt }))
    .sort((a, b) => String(a.patientName).localeCompare(String(b.patientName)));
  if (!namesPatient(fields)) return { list, matches: [] };
  const named = list.filter(v => namesMatch(v.patientName, fields.patientName));
  const records = await Promise.all(named.map(async (v) => {
    try {
      const full = await vobsApi.getVobById(v.id);
      return { ...v, patientName: full.patientName || v.patientName, dob: full.dob, dos: full.dos || v.dos, status: full.status, vobStatus: full.vobStatus };
    } catch {
      return v;
    }
  }));
  return { list, matches: records.filter(r => samePatient(r, fields)) };
}

/** Where a status sends a VOB, as the tabs name it. */
const ROUTED_TO = { auth_queue: 'Auth Queue', 'auth queue': 'Auth Queue', approved: 'Saved Records', in_progress: 'In Progress queue', assigned: 'Assigned queue' };

/** The record to start on: the latest one still open, else the latest. */
const firstRecordId = (records) => [...records]
  .sort((a, b) => (a.status === 'approved') - (b.status === 'approved') || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0]?.id ?? null;

/**
 * One of the Queue tab's panes. Hidden, it shrinks to a rail that brings it
 * back; its state lives in the screen, so hiding loses nothing.
 */
function QueuePane({ id, icon, title, summary, open, onToggle, className, children }) {
  if (!open) {
    return (
      <aside className={`queue-pane is-hidden ${className}`} id={id}>
        <button type="button" className="queue-pane-rail" onClick={onToggle} title={`Show ${title.toLowerCase()}`}>
          <span aria-hidden="true">{icon}</span>
          <span className="queue-pane-rail-label">{title}</span>
        </button>
      </aside>
    );
  }
  return (
    <aside className={`queue-pane ${className}`} id={id}>
      <div className="queue-pane-head">
        <div>
          <h3 className="queue-pane-title">{icon} {title}</h3>
          {summary && <span className="queue-pane-summary">{summary}</span>}
        </div>
        <button type="button" className="btn btn-sm ghost" onClick={onToggle}>Hide</button>
      </div>
      <div className="queue-pane-body">{children}</div>
    </aside>
  );
}

/** The values read from the call, each with the words it came from. */
function CallValuesList({ result }) {
  const entries = Object.entries(result.callValues);
  return (
    <div className="queue-call-values">
      <div className="queue-call-values-head">
        <span className="ai-chip">✨ Read {entries.length} value{entries.length === 1 ? '' : 's'} from the call</span>
        <span className="extracted-note">{result.readLocally ? 'Read in the browser' : `Read by ${result.provider}`}</span>
      </div>
      {result.readLocally && (
        <div className="queue-results-note">
          Read by the built-in reader, which knows how calls usually give each value. Check each value against the words beside it.
        </div>
      )}
      {result.quality?.warning && <div className="queue-results-note">⚠️ {result.quality.warning}</div>}
      {entries.length === 0 ? (
        <p className="extracted-note">The transcript didn’t clearly give any VOB value.</p>
      ) : (
        <ul className="queue-call-values-list">
          {entries.map(([key, v]) => (
            <li key={key}>
              <span className="queue-call-value-row">
                <span className="extracted-k">{fieldLabel(key)}</span>
                <span className="extracted-v">{String(v.value)}</span>
              </span>
              {v.evidence && <span className="queue-call-evidence">“{v.evidence}”</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The Queue tab: any VOB checked against its call transcript, for verifying
 * and auditing. The VOB, pasted or uploaded on the right, gives the answers
 * being checked; the transcript, on the left, gives the call's values; the
 * results and the specialist's remark are below.
 *
 * The tab opens no record of its own. The VOB's record is found from the
 * patient it names, among the VOBs this user can open, and the result goes to
 * it on submit. The transcript is read by the AI on that record (the API reads
 * a transcript for a record) or, before a record is found or when there is
 * none, by the browser's own reader, so any transcript can be read. The
 * record's saved values play no part in the check, and nothing on this tab
 * changes them. Submitting sends a VOB with any wrong or missing field to the
 * Error Queue, each with its remark and the specialist's; any other goes on as
 * from New Verification.
 */
export function QueueView() {
  const { currentUser, showToast, setActiveTab } = useWorkspace();
  const [transcriptOpen, setTranscriptOpen] = useState(true);
  const [documentOpen, setDocumentOpen] = useState(true);
  const [remark, setRemark] = useState('');
  const [showNotMentioned, setShowNotMentioned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- The VOB: a file read in the browser (never uploaded), or pasted text.
  const [doc, setDoc] = useState(null);
  const latestRead = useRef(null);

  const loadDocument = useCallback(async (file) => {
    let kind;
    try {
      kind = documentKind(file);
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }
    const read = {};
    latestRead.current = read;
    setDocumentOpen(true);
    setDoc({ file, name: file.name, kind, url: kind === 'pdf' ? URL.createObjectURL(file) : null, status: 'reading' });
    try {
      const found = await readVobDocument(file);
      if (latestRead.current === read) setDoc(d => ({ ...d, ...found, status: 'ready' }));
    } catch (err) {
      if (latestRead.current === read) setDoc(d => ({ ...d, status: 'failed', error: err.message }));
    }
  }, [showToast]);

  const loadText = useCallback((text) => {
    latestRead.current = null;
    setDoc({ name: 'Pasted VOB text', text, ...readPastedVob(text), status: 'ready' });
  }, []);

  // A PDF opens from an object URL, let go of when the VOB is replaced or the tab closes.
  const docUrl = doc?.url;
  useEffect(() => () => { if (docUrl) URL.revokeObjectURL(docUrl); }, [docUrl]);

  // A VOB file pasted anywhere on the tab is taken as the VOB. Anything else
  // (text, or a picture Word puts on the clipboard) pastes as usual.
  useEffect(() => {
    const onPaste = (e) => {
      const file = [...(e.clipboardData?.files || [])].find(isVobFile);
      if (!file) return;
      e.preventDefault();
      loadDocument(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [loadDocument]);

  // --- The VOB's record, found from the patient it names.
  const readable = doc?.status === 'ready' && doc.readable;
  const [lookup, setLookup] = useState({ status: 'idle' });
  const [records, setRecords] = useState([]);
  const [recordId, setRecordId] = useState(null);
  // With no record found from the patient, one picked by hand, which the
  // specialist confirms is this VOB's patient before submitting to it.
  const [allRecords, setAllRecords] = useState([]);
  const [manualRecord, setManualRecord] = useState(null);
  const [manualConfirmed, setManualConfirmed] = useState(false);
  // A submit the server routed without applying the check: { record, routedTo }.
  const [ignoredCheck, setIgnoredCheck] = useState(null);
  // Bumped by Retry, to look the record up again after the lookup failed.
  const [lookupRun, setLookupRun] = useState(0);

  useEffect(() => {
    setRecords([]);
    setRecordId(null);
    setAllRecords([]);
    setManualRecord(null);
    setManualConfirmed(false);
    setIgnoredCheck(null);
    if (!readable) {
      setLookup({ status: 'idle' });
      return undefined;
    }
    let current = true;
    setLookup({ status: 'finding' });
    findPatientRecords(doc.fields)
      .then(({ list, matches }) => {
        if (!current) return;
        setAllRecords(list);
        setRecords(matches);
        setRecordId(firstRecordId(matches));
        setLookup({ status: 'done', namesPatient: namesPatient(doc.fields) });
      })
      .catch((err) => {
        if (current) setLookup({ status: 'failed', error: `Couldn’t look up the patient’s VOB record: ${err?.message || 'no answer from the server'}.` });
      });
    return () => { current = false; };
  }, [readable, doc, lookupRun]);

  const pickRecord = (picked) => {
    setManualRecord(picked);
    setManualConfirmed(false);
    setIgnoredCheck(null);
  };

  const record = manualRecord || records.find(r => r.id === recordId) || null;

  // --- The transcript, read for the call's values; nothing is written to any record.
  // The AI reads it on the VOB's record; without one, the browser's reader does.
  const extraction = useTranscriptExtraction(record?.id ?? null);
  const [localReading, setLocalReading] = useState(null);
  const result = extraction.result || localReading;

  const extract = () => {
    if (record) {
      extraction.extract();
    } else {
      setLocalReading(readTranscriptLocally(extraction.transcript));
    }
  };
  const readInBrowser = () => setLocalReading(readTranscriptLocally(extraction.transcript));
  const newTranscript = () => {
    extraction.clear();
    setLocalReading(null);
  };

  // --- The check: the VOB's answers against the call's values. It needs no
  // record; sending the result to the Error Queue does.
  const check = useMemo(
    () => (readable && result ? compareVobWithCall(doc.fields, result.callValues) : null),
    [readable, result, doc]
  );

  const shownResults = check
    ? check.results.filter(r => r.status !== 'not_mentioned' || (showNotMentioned && r.vobValue))
    : [];
  const notMentionedCount = check ? check.results.filter(r => r.status === 'not_mentioned' && r.vobValue).length : 0;

  const transcriptSummary = result
    ? `Read ${Object.keys(result.callValues).length} values from the call`
    : 'Paste the test call transcript, then Extract';

  const documentSummary = !doc
    ? 'Paste or upload any VOB to check'
    : doc.status === 'reading'
      ? 'Reading…'
      : check
        ? (check.errors ? `${check.errors} to fix` : 'No wrong or missing fields')
        : readable
          ? 'Waiting for the transcript'
          : 'Can’t be read';

  // Why there are no results yet.
  const notCheckedReason = !doc
    ? 'Paste or upload the VOB to check'
    : doc.status === 'reading'
      ? 'Reading the VOB…'
      : !readable
        ? 'This VOB can’t be read; see the VOB pane'
        : !result
          ? 'Paste the transcript and press Extract'
          : null;

  // Why the result can't be submitted yet.
  const blockedReason = notCheckedReason
    || (lookup.status === 'finding' ? 'Finding the patient’s VOB record…' : null)
    || (!record ? 'This VOB has no record in your queues yet: pick its record by hand in the VOB pane' : null)
    || (manualRecord && !manualConfirmed ? `Confirm ${manualRecord.id} is this VOB’s patient, in the VOB pane` : null)
    || (ignoredCheck ? `${ignoredCheck.record} was already submitted` : null);

  // The steps before Submit, listed beside it so a grey button says why.
  const goTo = (id) => () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const steps = [
    {
      done: readable,
      label: readable ? 'VOB read'
        : !doc ? 'Paste or upload the VOB'
          : doc.status === 'reading' ? 'Reading the VOB…'
            : 'The VOB can’t be read: see the VOB pane',
      target: 'queue-document'
    },
    {
      done: Boolean(result),
      label: result ? `Transcript read (${Object.keys(result.callValues).length} values)`
        : extraction.isProcessing ? 'Reading the transcript…'
          : extraction.error ? 'Reading the transcript failed: see the transcript pane'
            : 'Paste the transcript and press Extract',
      target: 'queue-transcript'
    },
    {
      done: Boolean(record),
      label: record ? `Record ${record.id}`
        : lookup.status === 'finding' ? 'Finding the VOB’s record…'
          : lookup.status === 'failed' ? 'Looking up the record failed: Retry in the VOB pane'
            : readable ? 'Pick the VOB’s record in the VOB pane'
              : 'The VOB’s record (found once the VOB is read)',
      target: 'queue-document'
    },
    ...(manualRecord ? [{
      done: manualConfirmed,
      label: manualConfirmed ? `${manualRecord.id} confirmed` : `Tick the box to confirm ${manualRecord.id} is this patient’s record`,
      target: 'queue-document'
    }] : [])
  ];

  const showResults = () => document.getElementById('queue-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const submit = async () => {
    if (!check || !record) return;
    setIsSubmitting(true);
    try {
      // The record as it is now: its version may have moved on since it was found.
      const { version } = await vobsApi.getVobById(record.id);
      const res = await vobsApi.submitVob(record.id, version, currentUser.email, {
        documentCheck: documentCheckFor(doc, check, remark)
      });
      const status = (res.status || '').toLowerCase();
      const remarksRecorded = (res.failingRules || []).some(f => f.code === 'document_mismatch');
      if (check.errors > 0 && status !== 'error') {
        // The server went on as if nothing were wrong: it didn't apply the check.
        // Stay here, so the specialist sees where the VOB went and why.
        const routedTo = ROUTED_TO[status] || status || 'next step';
        setIgnoredCheck({ record: record.id, routedTo });
        showToast(`${record.id} went to the ${routedTo}, not the Error Queue: the server didn’t apply the transcript check.`, 'error');
      } else if (check.errors > 0 && !remarksRecorded) {
        showToast(`${record.id} is in the Error Queue, but without the transcript remarks: the server didn’t apply the transcript check.`, 'error');
        setActiveTab('error_queue');
      } else {
        followSubmitResult(res, showToast, setActiveTab);
      }
    } catch (err) {
      console.error(err);
      showToast(
        err?.status === 409
          ? (err.data?.error?.code === 'invalid_transition'
            ? `${record.id} can’t be submitted from its status (${record.vobStatus}).`
            : `${record.id} was just changed by someone else. Submit again.`)
          : err?.message || 'Submission error',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const extractBlocked = extraction.isProcessing || !extraction.transcript.trim() || extraction.tooLong;
  // A browser reading can be read again by the AI once the VOB's record is found.
  const canAskAi = Boolean(record && localReading && !extraction.result && !extraction.isProcessing);
  const layoutClass = `queue-layout${transcriptOpen ? '' : ' transcript-hidden'}${documentOpen ? '' : ' document-hidden'}`;

  return (
    <div className="queue-view">
      <div className={layoutClass}>
        <QueuePane
          id="queue-transcript"
          className="queue-pane-transcript"
          icon="📝"
          title="Test transcript"
          summary={transcriptSummary}
          open={transcriptOpen}
          onToggle={() => setTranscriptOpen(o => !o)}
        >
          <TranscriptExtractBody
            extraction={extraction}
            showResult={false}
            description="Paste the test call transcript and press Extract. The values the call gives are read out, and each is checked against the VOB on the right. Nothing on any record changes."
          />
          {result && <CallValuesList result={result} />}
          {extraction.error && !localReading && (
            <div className="queue-pane-actions">
              <button type="button" className="btn btn-sm ghost" onClick={readInBrowser}>Read it in the browser instead</button>
            </div>
          )}
          <div className="queue-pane-actions">
            {result && (
              <button type="button" className="btn btn-sm ghost" onClick={newTranscript}>New transcript</button>
            )}
            {canAskAi && (
              <button
                type="button"
                className="btn btn-sm ghost"
                onClick={extraction.extract}
                title={`The AI reads the transcript on ${record.id}, the VOB’s record`}
              >
                Read with AI
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm"
              onClick={extract}
              disabled={extractBlocked}
              title={record ? `The AI reads the transcript on ${record.id}, the VOB’s record` : 'Read in the browser: no VOB record found yet for the AI to read it on'}
            >
              {extraction.isProcessing ? 'Reading with AI…' : result ? 'Extract again' : extraction.error ? 'Try again' : 'Extract'}
            </button>
          </div>
        </QueuePane>

        <QueuePane
          id="queue-document"
          className="queue-pane-document"
          icon="🧾"
          title="VOB to check"
          summary={documentSummary}
          open={documentOpen}
          onToggle={() => setDocumentOpen(o => !o)}
        >
          <VobDocumentPane
            doc={doc}
            lookup={lookup}
            records={records}
            recordId={recordId}
            check={check}
            transcriptRead={Boolean(result)}
            onFile={loadDocument}
            onText={loadText}
            onRemove={() => { latestRead.current = null; setDoc(null); }}
            onRecordChange={(id) => { setRecordId(id); setIgnoredCheck(null); }}
            allRecords={allRecords}
            manualRecord={manualRecord}
            manualConfirmed={manualConfirmed}
            onManualPick={pickRecord}
            onManualConfirm={setManualConfirmed}
            onRetryLookup={() => setLookupRun(n => n + 1)}
            onShowResults={showResults}
          />
        </QueuePane>
      </div>

      <section className="panel-card queue-results" id="queue-results">
        <div className="panel-header">
          <div>
            <h3>Validation results</h3>
            <span className="panel-sub">The VOB’s answers checked against the transcript. Fields the call doesn’t mention stay neutral.</span>
          </div>
          {check && (
            <div className="queue-check-summary">
              <span className="check-chip match">✅ {check.counts.match} match</span>
              <span className="check-chip wrong">❌ {check.counts.wrong} wrong</span>
              <span className="check-chip missing">⚠️ {check.counts.missing} missing</span>
            </div>
          )}
        </div>

        {!check ? (
          <p className="queue-doc-note">{notCheckedReason}.</p>
        ) : (
          <>
            {!result.callValuesComplete && (
              <div className="queue-results-note">
                This server lists only the call’s values that are new to the VOB’s record, so a field where the call gives the same value the record already holds shows as not mentioned. Your API team’s update (<code>extracted</code>) closes this gap.
              </div>
            )}
            {notMentionedCount > 0 && (
              <label className="queue-check-filter">
                <input type="checkbox" checked={showNotMentioned} onChange={(e) => setShowNotMentioned(e.target.checked)} />
                Show VOB fields the call didn’t mention ({notMentionedCount})
              </label>
            )}
            <div className="table-responsive">
              <table className="data-table queue-results-table">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>VOB Value</th>
                    <th>Transcript Value</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {shownResults.length === 0 ? (
                    <tr><td colSpan="4" className="table-empty">The call doesn’t give any of the VOB’s values.</td></tr>
                  ) : (
                    shownResults.map(r => (
                      <tr key={r.key} className={`result-${r.status}`} title={r.remark || undefined}>
                        <td className="bold">{r.label}</td>
                        <td>{r.vobValue || <span className="queue-blank">{r.status === 'missing' ? 'Not in the VOB' : '—'}</span>}</td>
                        <td>
                          {r.callValue || <span className="queue-blank">Not mentioned</span>}
                          {r.evidence && <div className="queue-call-evidence">“{r.evidence}”</div>}
                        </td>
                        <td><span className={`check-chip ${r.status}`}>{RESULT_LABELS[r.status]}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="panel-card queue-remark">
        <label htmlFor="queue-remark" className="queue-remark-label">Remark</label>
        <textarea
          id="queue-remark"
          className="transcript-textarea"
          rows={3}
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="Add any explanation or note about this validation…"
        />
        {ignoredCheck && (
          <div className="queue-doc-alert" role="alert">
            ⚠️ The server sent {ignoredCheck.record} to the {ignoredCheck.routedTo}, not the Error Queue, although {check?.errors} field{check?.errors === 1 ? ' is' : 's are'} wrong or missing.
            It didn’t apply the transcript check: your API needs the <code>document_check</code> update.
            Open {ignoredCheck.record} from the {ignoredCheck.routedTo} to correct it.
          </div>
        )}
        {blockedReason && !ignoredCheck && (
          <ol className="queue-submit-steps" aria-label="Before you can submit">
            {steps.map((step) => (
              <li key={step.label} className={step.done ? 'done' : ''}>
                <span aria-hidden="true">{step.done ? '✓' : '○'}</span>
                {step.done
                  ? <span>{step.label}</span>
                  : <button type="button" className="btn-action-link" onClick={goTo(step.target)}>{step.label}</button>}
              </li>
            ))}
          </ol>
        )}
        <div className="queue-remark-actions">
          {check && !ignoredCheck && (
            <span className={`queue-submit-hint ${check.errors ? 'has-errors' : ''}`}>
              {!record
                ? `${check.errors ? `❌ ${check.errors} field${check.errors === 1 ? '' : 's'} wrong or missing. ` : '✅ No wrong or missing fields. '}Pick this VOB’s record to submit it.`
                : check.errors
                  ? `❌ ${check.errors} field${check.errors === 1 ? '' : 's'} wrong or missing: ${record.id} goes to the Error Queue with remarks`
                  : `✅ No wrong or missing fields: ${record.id} goes on as usual`}
            </span>
          )}
          <button
            type="button"
            className="btn btn-submit-vob"
            onClick={submit}
            disabled={isSubmitting || Boolean(blockedReason)}
            title={blockedReason || 'Submit; wrong or missing fields go to the Error Queue with remarks'}
          >
            {isSubmitting ? 'Submitting…' : 'Submit →'}
          </button>
        </div>
      </section>
    </div>
  );
}
