import { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { vobsApi } from '../api/vobs';
import { CANONICAL_FIELDS, CANONICAL_FIELDS_BY_KEY } from '../data/clients';
import { formKeyFor } from '../utils/vobAdapter';

/** The form's Authorization & Referral section: all an Auth Queue VOB can still change. */
const AUTH_FIELD_KEYS = CANONICAL_FIELDS.filter(f => f.group === 'auth').map(f => f.key);

/**
 * The VOB fill screen's state and actions: the open VOB, its form values and
 * provenance, failing rules, the layout, and save / submit with conflict
 * handling. New Verification and New VOB Verification both run on this, so the
 * two behave the same.
 */
export function useVobForm() {
  const { activeVobId, setActiveVobId, showToast, setActiveTab, currentUser } = useWorkspace();
  const [vob, setVob] = useState(null);
  const [formData, setFormData] = useState({});
  const [provenance, setProvenance] = useState({});
  const [hasTranscript, setHasTranscript] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failingRules, setFailingRules] = useState([]);
  const [myVobsList, setMyVobsList] = useState([]);
  const [layoutMode, setLayoutMode] = useState('split'); // 'split' | 'form' | 'preview'

  useEffect(() => {
    let isCurrent = true;
    vobsApi.getVobs({ userEmail: currentUser.email }).then(list => {
      if (!isCurrent) return;
      setMyVobsList(list);
      if (!activeVobId && list.length > 0) {
        setActiveVobId(list[0].id);
      } else if (!activeVobId) {
        // Nothing to open: show the empty state, not an endless "Loading…".
        setLoading(false);
      }
    }).catch(err => {
      console.error(err);
      if (isCurrent && !activeVobId) setLoading(false);
    });
    return () => { isCurrent = false; };
  }, [currentUser.email]);

  useEffect(() => {
    if (activeVobId) {
      let isCurrent = true;
      setLoading(true);
      setFailingRules([]);
      vobsApi.getVobById(activeVobId).then(data => {
        if (!isCurrent) return;
        setVob(data);
        setFormData(data);
        setProvenance(data.provenance || {});
        setHasTranscript(Boolean(data.transcriptText || (data.provenance && Object.values(data.provenance).some(p => p.source === 'ai'))));
        if (data.failingRules) {
          setFailingRules(data.failingRules);
        }
        setLoading(false);
      }).catch(err => {
        console.error(err);
        if (isCurrent) setLoading(false);
      });
      return () => { isCurrent = false; };
    }
  }, [activeVobId]);

  const handleFieldChange = useCallback((key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    // Update provenance to manual for edited fields
    setProvenance(prev => ({
      ...prev,
      [key]: { source: 'manual' }
    }));
    // Clear failing error if field is updated (mapping backend field name if present)
    setFailingRules(prev => prev.filter(r => (formKeyFor(r.field) || r.field) !== key && r.field !== key));
  }, []);

  const handleSelectField = useCallback((fieldKey) => {
    // If preview-only mode is active, switch to split to show the form
    setLayoutMode(mode => (mode === 'preview' ? 'split' : mode));
    setTimeout(() => {
      const el = document.getElementById(fieldKey);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        el.classList.add('field-highlight-pulse');
        setTimeout(() => el.classList.remove('field-highlight-pulse'), 1800);
      }
    }, 50);
  }, []);

  const handleApplyAiFields = useCallback((extracted) => {
    setFormData(prevForm => {
      const nextFormData = { ...prevForm };
      for (const [k, val] of Object.entries(extracted)) {
        if (!nextFormData[k] || nextFormData[k] === '') {
          nextFormData[k] = val;
        }
      }
      return nextFormData;
    });

    // Counted here, not in the updater above: React may run an updater while
    // rendering, and the toast sets the workspace's state.
    const count = Object.keys(extracted).filter(k => !formData[k] || formData[k] === '').length;
    showToast(`AI auto-filled ${count} empty fields with [AI Transcript] tags!`, "success");

    setProvenance(prevProv => {
      const nextProv = { ...prevProv };
      for (const [k] of Object.entries(extracted)) {
        if (!formData[k] || formData[k] === '') {
          nextProv[k] = { source: 'ai' };
        }
      }
      return nextProv;
    });

    setHasTranscript(true);
  }, [formData, showToast]);

  const reloadAfterConflict = useCallback((err) => {
    showToast(
      err?.data?.error?.code === 'invalid_transition'
        ? "This VOB's status changed and it can't be edited here. Reloading."
        : "Conflict 409: Record was updated by someone else. Reloading.",
      "error"
    );
    if (activeVobId) {
      vobsApi.getVobById(activeVobId).then(data => {
        setVob(data);
        setFormData(data);
      });
    }
  }, [activeVobId, showToast]);

  const saveForm = useCallback(() => {
    if (!vob) return Promise.resolve(null);
    return vobsApi.patchVob(
      activeVobId,
      { ...formData, provenance },
      vob.version,
      currentUser.email,
      vob.status === 'auth_queue' ? { only: AUTH_FIELD_KEYS } : {}
    );
  }, [activeVobId, formData, provenance, vob, currentUser.email]);

  const handleSaveDraft = useCallback(async () => {
    try {
      const patchRes = await saveForm();
      if (patchRes?.version) {
        setVob(prev => ({ ...prev, version: patchRes.version }));
      }
      showToast("Draft changes saved successfully.", "info");
    } catch (err) {
      if (err.status === 409) {
        reloadAfterConflict(err);
      } else {
        showToast("Error saving draft", "error");
      }
    }
  }, [saveForm, reloadAfterConflict, showToast]);

  const handleSubmit = useCallback(async () => {
    if (!vob) return;
    setIsSubmitting(true);
    try {
      const patchRes = await saveForm();
      const currentVersion = patchRes?.version || (vob.version ? vob.version + 1 : 1);
      setVob(prev => ({ ...prev, version: currentVersion }));

      const result = await vobsApi.submitVob(activeVobId, currentVersion, currentUser.email);
      const status = (result.status || '').toLowerCase();
      if (status === 'error') {
        setFailingRules(result.failingRules || []);
        showToast("Validation failed. Incomplete fields moved to Error Queue.", "error");
        setActiveTab('error_queue');
      } else if (status === 'auth_queue' || status === 'auth queue') {
        const pending = (result.awaiting || []).map(field => {
          const key = formKeyFor(field) || field;
          return CANONICAL_FIELDS_BY_KEY.get(key)?.label || field;
        });
        const shown = pending.slice(0, 3).join(', ') + (pending.length > 3 ? ` +${pending.length - 3} more` : '');
        showToast(
          pending.length > 0
            ? `Authorization section incomplete (${shown}). VOB moved to Auth Queue.`
            : "VOB moved to Auth Queue.",
          "info"
        );
        setActiveTab('auth_queue');
      } else {
        showToast("VOB validated and approved! Saved to Approved Records.", "success");
        setActiveTab('saved_records');
      }
    } catch (err) {
      console.error(err);
      if (err.status === 409) {
        reloadAfterConflict(err);
      } else {
        showToast(err?.message || "Submission error", "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [vob, activeVobId, currentUser.email, saveForm, reloadAfterConflict, showToast, setActiveTab]);

  return {
    vob,
    formData,
    provenance,
    hasTranscript,
    loading,
    isSubmitting,
    failingRules,
    myVobsList,
    layoutMode,
    setLayoutMode,
    handleFieldChange,
    handleSelectField,
    handleApplyAiFields,
    handleSaveDraft,
    handleSubmit
  };
}
