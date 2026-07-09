import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';
import { updateFormField, clearForm, setFormData } from '../features/form/formSlice';
import { addInteraction } from '../features/interaction/interactionSlice';
import SuggestionChips from './SuggestionChips';

const API_BASE_URL = 'http://127.0.0.1:8000';

export default function InteractionForm() {
  const dispatch = useDispatch();
  const formState = useSelector((state) => state.form);
  
  const [submitStatus, setSubmitStatus] = useState({ type: '', message: '' });
  const [isValidatingHcp, setIsValidatingHcp] = useState(false);
  const [hcpStatus, setHcpStatus] = useState(null); // { id: number, name: string, specialization: string, hospital: string } or null

  // Destructure formState
  const {
    hcpName,
    interactionType,
    date,
    time,
    attendees,
    topicsDiscussed,
    materialsShared,
    samplesDistributed,
    sentiment,
    outcomes,
    followUpActions,
    hcpId,
    currentInteractionId,
  } = formState;

  // Track field changes and dispatch to Redux
  const handleChange = (field, value) => {
    dispatch(updateFormField({ field, value }));
  };

  // Perform real-time validation / lookup when HCP Name changes (debounced or on blur)
  const lookupHcp = async (name) => {
    if (!name || name.trim().length < 3) {
      setHcpStatus(null);
      return;
    }
    setIsValidatingHcp(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/hcp/${encodeURIComponent(name.trim())}`);
      if (response.data && response.data.id) {
        setHcpStatus(response.data);
        dispatch(updateFormField({ field: 'hcpId', value: response.data.id }));
        setSubmitStatus({ type: '', message: '' });
      }
    } catch (err) {
      // 404 or other errors mean the HCP isn't registered yet
      setHcpStatus(null);
      dispatch(updateFormField({ field: 'hcpId', value: null }));
    } finally {
      setIsValidatingHcp(false);
    }
  };

  // Trigger lookup on blur or when name matches auto-filled value
  useEffect(() => {
    if (hcpName) {
      // Use a timeout to debounce slightly or just trigger it
      const timer = setTimeout(() => {
        lookupHcp(hcpName);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setHcpStatus(null);
      dispatch(updateFormField({ field: 'hcpId', value: null }));
    }
  }, [hcpName]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitStatus({ type: '', message: '' });

    if (!hcpName.trim()) {
      setSubmitStatus({ type: 'error', message: 'HCP Name is required.' });
      return;
    }

    let resolvedHcpId = hcpId;

    // If hcpId is not in Redux state, try to look up one last time
    if (!resolvedHcpId) {
      try {
        setIsValidatingHcp(true);
        const response = await axios.get(`${API_BASE_URL}/hcp/${encodeURIComponent(hcpName.trim())}`);
        if (response.data && response.data.id) {
          resolvedHcpId = response.data.id;
          dispatch(updateFormField({ field: 'hcpId', value: resolvedHcpId }));
        }
      } catch (err) {
        setSubmitStatus({
          type: 'error',
          message: `HCP "${hcpName}" was not found in the database. Please select an existing doctor (e.g. Dr. Sarah Jenkins, Dr. Richard Patel, Dr. Elena Rostova) or use the AI Assistant in the chat to log this interaction, which will automatically create the HCP.`,
        });
        setIsValidatingHcp(false);
        return;
      } finally {
        setIsValidatingHcp(false);
      }
    }

    // Prepare payload
    const payload = {
      hcp_id: resolvedHcpId,
      interaction_type: interactionType || null,
      date: date || null,
      time: time || null,
      attendees: attendees || null,
      topics_discussed: topicsDiscussed || null,
      materials_shared: materialsShared || null,
      samples_distributed: samplesDistributed || null,
      sentiment: sentiment || null,
      outcomes: outcomes || null,
      follow_up_actions: followUpActions || null,
    };

    try {
      let response;
      if (currentInteractionId) {
        // AI already saved → UPDATE existing record
        const updatePayload = {
          interaction_type: interactionType || null,
          date: date || null,
          time: time || null,
          attendees: attendees || null,
          topics_discussed: topicsDiscussed || null,
          materials_shared: materialsShared || null,
          samples_distributed: samplesDistributed || null,
          sentiment: sentiment || null,
          outcomes: outcomes || null,
          follow_up_actions: followUpActions || null,
        };
        response = await axios.put(`${API_BASE_URL}/interactions/${currentInteractionId}`, updatePayload);
        setSubmitStatus({
          type: 'success',
          message: `Successfully updated interaction with ${hcpName}!`,
        });
      } else {
        // Manual fill → CREATE new record
        response = await axios.post(`${API_BASE_URL}/interactions`, payload);
        dispatch(addInteraction(response.data));
        setSubmitStatus({
          type: 'success',
          message: `Successfully logged interaction with ${hcpName}!`,
        });
      }
      // Clear form after success
      dispatch(clearForm());
      setHcpStatus(null);
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail || 'An error occurred while submitting the interaction.';
      setSubmitStatus({
        type: 'error',
        message: typeof detail === 'string' ? detail : JSON.stringify(detail),
      });
    }
  };

  return (
    <div className="form-panel">
      <div className="panel-header">
        <h2>Log Interaction</h2>
        <p className="panel-subtitle">Record details of HCP meetings, calls, and updates</p>
      </div>

      <form onSubmit={handleSubmit} className="interaction-form">
        {/* Submit Status Alerts */}
        {submitStatus.message && (
          <div className={`form-alert alert-${submitStatus.type}`}>
            <span className="alert-icon">
              {submitStatus.type === 'success' ? '✓' : '⚠'}
            </span>
            <span className="alert-text">{submitStatus.message}</span>
          </div>
        )}

        {/* 1. HCP Name */}
        <div className="form-group">
          <label htmlFor="hcpName">HCP Name <span className="required-star">*</span></label>
          <div className="input-with-badge">
            <input
              type="text"
              id="hcpName"
              className="form-input"
              value={hcpName}
              onChange={(e) => handleChange('hcpName', e.target.value)}
              placeholder="e.g. Dr. Sarah Jenkins"
              required
            />
            {isValidatingHcp && <span className="input-spinner" />}
          </div>
          {hcpStatus ? (
            <div className="hcp-info-badge valid-badge">
              <span className="badge-icon">✓</span>
              <span>
                Verified: <strong>{hcpStatus.name}</strong> ({hcpStatus.specialization} at {hcpStatus.hospital})
              </span>
            </div>
          ) : hcpName && hcpName.trim().length >= 3 && !isValidatingHcp ? (
            <div className="hcp-info-badge warning-badge">
              <span className="badge-icon">⚠</span>
              <span>
                New HCP: Must be registered first. Ask the AI Assistant to log this interaction to auto-register!
              </span>
            </div>
          ) : null}
        </div>

        {/* 2. Interaction Type */}
        <div className="form-group">
          <label htmlFor="interactionType">Interaction Type</label>
          <select
            id="interactionType"
            className="form-select"
            value={interactionType}
            onChange={(e) => handleChange('interactionType', e.target.value)}
          >
            <option value="">Select type...</option>
            <option value="Meeting">Meeting</option>
            <option value="Call">Call</option>
            <option value="Email">Email</option>
            <option value="Video Conference">Video Conference</option>
          </select>
        </div>

        {/* 3. Date + Time (Side by side) */}
        <div className="form-row">
          <div className="form-group col-6">
            <label htmlFor="date">Date</label>
            <input
              type="date"
              id="date"
              className="form-input"
              value={date}
              onChange={(e) => handleChange('date', e.target.value)}
            />
          </div>
          <div className="form-group col-6">
            <label htmlFor="time">Time</label>
            <input
              type="time"
              id="time"
              className="form-input"
              value={time}
              onChange={(e) => handleChange('time', e.target.value)}
            />
          </div>
        </div>

        {/* 4. Attendees */}
        <div className="form-group">
          <label htmlFor="attendees">Attendees</label>
          <input
            type="text"
            id="attendees"
            className="form-input"
            value={attendees}
            onChange={(e) => handleChange('attendees', e.target.value)}
            placeholder="Comma-separated (e.g. Dr. Jenkins, John Rep)"
          />
        </div>

        {/* 5. Topics Discussed */}
        <div className="form-group">
          <label htmlFor="topicsDiscussed">Topics Discussed</label>
          <textarea
            id="topicsDiscussed"
            className="form-textarea"
            rows="3"
            value={topicsDiscussed}
            onChange={(e) => handleChange('topicsDiscussed', e.target.value)}
            placeholder="What pharmaceutical topics did you discuss?"
          />
        </div>

        {/* 6. Materials Shared */}
        <div className="form-group">
          <label htmlFor="materialsShared">Materials Shared</label>
          <input
            type="text"
            id="materialsShared"
            className="form-input"
            value={materialsShared}
            onChange={(e) => handleChange('materialsShared', e.target.value)}
            placeholder="e.g. Clinical Study slides, Vaccine efficacy report"
          />
        </div>

        {/* 7. Samples Distributed */}
        <div className="form-group">
          <label htmlFor="samplesDistributed">Samples Distributed</label>
          <input
            type="text"
            id="samplesDistributed"
            className="form-input"
            value={samplesDistributed}
            onChange={(e) => handleChange('samplesDistributed', e.target.value)}
            placeholder="e.g. 5 vials of Vaccine X, 2 packs of Drug Y"
          />
        </div>

        {/* 8. Sentiment (Radio buttons) */}
        <div className="form-group">
          <label>Sentiment</label>
          <div className="sentiment-radio-group">
            <label className={`sentiment-label positive ${sentiment === 'Positive' ? 'active' : ''}`}>
              <input
                type="radio"
                name="sentiment"
                value="Positive"
                checked={sentiment === 'Positive'}
                onChange={(e) => handleChange('sentiment', e.target.value)}
              />
              <span className="sentiment-radio-dot positive-dot" />
              Positive
            </label>

            <label className={`sentiment-label neutral ${sentiment === 'Neutral' ? 'active' : ''}`}>
              <input
                type="radio"
                name="sentiment"
                value="Neutral"
                checked={sentiment === 'Neutral'}
                onChange={(e) => handleChange('sentiment', e.target.value)}
              />
              <span className="sentiment-radio-dot neutral-dot" />
              Neutral
            </label>

            <label className={`sentiment-label negative ${sentiment === 'Negative' ? 'active' : ''}`}>
              <input
                type="radio"
                name="sentiment"
                value="Negative"
                checked={sentiment === 'Negative'}
                onChange={(e) => handleChange('sentiment', e.target.value)}
              />
              <span className="sentiment-radio-dot negative-dot" />
              Negative
            </label>
          </div>
        </div>

        {/* 9. Outcomes */}
        <div className="form-group">
          <label htmlFor="outcomes">Outcomes</label>
          <textarea
            id="outcomes"
            className="form-textarea"
            rows="3"
            value={outcomes}
            onChange={(e) => handleChange('outcomes', e.target.value)}
            placeholder="Summary of outcomes and current agreement..."
          />
        </div>

        {/* 10. Follow-up Actions */}
        <div className="form-group">
          <label htmlFor="followUpActions">Follow-up Actions</label>
          <textarea
            id="followUpActions"
            className="form-textarea"
            rows="3"
            value={followUpActions}
            onChange={(e) => handleChange('followUpActions', e.target.value)}
            placeholder="What are the next actions?"
          />
        </div>

        {/* 11. AI Suggested Follow-ups */}
        <SuggestionChips />

        {/* 12. Submit Button */}
        <button type="submit" className="submit-button" disabled={isValidatingHcp}>
          {isValidatingHcp 
            ? 'Validating HCP...' 
            : currentInteractionId 
              ? 'Update Interaction' 
              : 'Submit Interaction'}
        </button>
      </form>
    </div>
  );
}
