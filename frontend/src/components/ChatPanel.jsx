import React, { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';
import {
  addMessage,
  setMessages,
  setLoading,
  setError,
  clearChat,
  resetThreadId,
} from '../features/chat/chatSlice';
import { setFormData, updateFormField, clearForm } from '../features/form/formSlice';

const API_BASE_URL = 'http://127.0.0.1:8000';

export default function ChatPanel() {
  const dispatch = useDispatch();
  const { messages, isLoading, threadId, error } = useSelector((state) => state.chat);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  // Auto-scroll to the bottom of the chat when new messages arrive or loading starts
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessageText = input.trim();
    setInput('');
    dispatch(setError(null));

    // 1. Instantly append User message to local UI
    dispatch(addMessage({ role: 'user', content: userMessageText }));
    dispatch(setLoading(true));

    try {
      // 2. Post to /chat
      const response = await axios.post(`${API_BASE_URL}/chat`, {
        message: userMessageText,
        thread_id: threadId,
      });

      // 3. Sync full message list with the backend to capture tool invocations
      if (response.data && response.data.messages) {
        dispatch(setMessages(response.data.messages));

        // 4. Parse AI response messages array for tool result JSON
        response.data.messages.forEach((msg) => {
          if (msg.role === 'tool' && (msg.name === 'log_interaction' || msg.name === 'edit_interaction')) {
            try {
              const toolData = JSON.parse(msg.content);
              
              // Build dynamic updates based on existing fields in the tool message
              const updates = {};
              if (toolData.hcp_name !== undefined) updates.hcpName = toolData.hcp_name;
              if (toolData.hcp_id !== undefined) updates.hcpId = toolData.hcp_id;
              if (toolData.id !== undefined) updates.currentInteractionId = toolData.id;
              if (toolData.interaction_type !== undefined) updates.interactionType = toolData.interaction_type;
              if (toolData.date !== undefined) updates.date = toolData.date;
              
              if (toolData.time !== undefined) {
                let formattedTime = toolData.time || '';
                if (formattedTime && formattedTime.split(':').length > 2) {
                  formattedTime = formattedTime.split(':').slice(0, 2).join(':');
                }
                updates.time = formattedTime;
              }
              
              if (toolData.attendees !== undefined) updates.attendees = toolData.attendees;
              if (toolData.topics_discussed !== undefined) updates.topicsDiscussed = toolData.topics_discussed;
              if (toolData.materials_shared !== undefined) updates.materialsShared = toolData.materials_shared;
              if (toolData.samples_distributed !== undefined) updates.samplesDistributed = toolData.samples_distributed;
              if (toolData.sentiment !== undefined) updates.sentiment = toolData.sentiment;
              if (toolData.outcomes !== undefined) updates.outcomes = toolData.outcomes;
              
              if (toolData.follow_up_actions !== undefined) {
                updates.followUpActions = toolData.follow_up_actions;
                const parsedSuggestions = toolData.follow_up_actions
                  ? toolData.follow_up_actions
                      .split(',')
                      .map((s) => s.trim())
                      .filter((s) => s.length > 0)
                  : [];
                updates.suggestions = parsedSuggestions.slice(0, 3);
              }

              // Dispatch form state auto-fill and updates dynamically!
              dispatch(setFormData(updates));
            } catch (parseError) {
              console.error(`Error parsing tool content for ${msg.name}:`, parseError);
            }
          }
        });

        // Also check if suggest_followup tool was called directly
        const suggestToolMsg = response.data.messages.find(
          (m) => m.role === 'tool' && m.name === 'suggest_followup'
        );

        if (suggestToolMsg) {
          try {
            const suggestData = JSON.parse(suggestToolMsg.content);
            if (suggestData && Array.isArray(suggestData.suggestions)) {
              dispatch(
                updateFormField({
                  field: 'suggestions',
                  value: suggestData.suggestions.slice(0, 3),
                })
              );
            }
          } catch (parseError) {
            console.error('Error parsing suggest_followup content:', parseError);
          }
        }
      } else {
        // Fallback: just append assistant response text if no full message array
        dispatch(
          addMessage({
            role: 'assistant',
            content: response.data.response || 'I have processed your request.',
          })
        );
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.detail || 'Failed to communicate with AI Assistant.';
      dispatch(setError(errMsg));
      dispatch(
        addMessage({
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please make sure the backend is running at http://127.0.0.1:8000.',
        })
      );
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleReset = () => {
    dispatch(resetThreadId());
    dispatch(clearChat());
    dispatch(clearForm());
  };

  return (
    <div className="chat-panel">
      {/* Panel Header */}
      <div className="chat-header">
        <div className="chat-header-title">
          {/* Blue Robot Icon */}
          <div className="robot-icon-container">
            <svg
              className="robot-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <circle cx="12" y="5" r="2" />
              <path d="M12 7v4M8 15h.01M16 15h.01" />
            </svg>
          </div>
          <div>
            <h3>AI Assistant</h3>
            <p className="chat-header-status">Online • Ready to log</p>
          </div>
        </div>
        <button
          onClick={handleReset}
          className="clear-chat-button"
          title="Clear Chat History"
          type="button"
        >
          Reset
        </button>
      </div>

      {/* Messages History */}
      <div className="chat-messages-container">
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <div className="empty-bubble">💬</div>
            <p className="empty-title">Welcome to RepSync AI!</p>
            <p className="empty-desc">
              Type or paste your meeting notes below, and click <strong>Log</strong>. 
              The AI will extract details, auto-fill the form, and suggest follow-up actions.
            </p>
            <div className="prompt-examples">
              <p className="example-header">Try saying:</p>
              <button
                type="button"
                className="example-btn"
                onClick={() => setInput("Just finished a meeting with Dr. Sarah Jenkins. It went really well, positive sentiment. We discussed lipid-lowering trials. Shared clinical study slides. Gave 5 samples of drug X. Outcomes are she's interested in prescribing. Suggested scheduling a follow-up in 2 weeks.")}
              >
                "Just finished a meeting with Dr. Sarah Jenkins..."
              </button>
            </div>
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((msg, index) => {
              // We only render user and assistant bubbles in the primary flow
              if (msg.role === 'user') {
                return (
                  <div key={index} className="message-row user-row">
                    <div className="message-bubble user-bubble">
                      <p className="message-text">{msg.content}</p>
                    </div>
                  </div>
                );
              }

              if (msg.role === 'assistant' && msg.content) {
                return (
                  <div key={index} className="message-row assistant-row">
                    <div className="message-bubble assistant-bubble">
                      <p className="message-text">{msg.content}</p>
                    </div>
                  </div>
                );
              }

              // Display tool run events as subtle system indicators
              if (msg.role === 'tool') {
                let label = 'AI processed info';
                if (msg.name === 'log_interaction') label = 'Auto-filled Form Fields';
                if (msg.name === 'suggest_followup') label = 'Generated Follow-ups';
                if (msg.name === 'get_hcp_profile') label = 'Searched Doctor Profile';
                if (msg.name === 'analyze_sentiment') label = 'Analyzed Sentiment';
                
                return (
                  <div key={index} className="message-row tool-row">
                    <span className="tool-tag">
                      <span className="tool-dot">●</span>
                      {label}
                    </span>
                  </div>
                );
              }

              return null;
            })}

            {/* Chat Error state */}
            {error && (
              <div className="chat-error-message">
                <span className="err-icon">⚠</span>
                <span className="err-text">{error}</span>
              </div>
            )}

            {/* Chat Loading Spinner */}
            {isLoading && (
              <div className="message-row assistant-row">
                <div className="message-bubble assistant-bubble loading-bubble">
                  <div className="chat-spinner">
                    <div className="double-bounce1"></div>
                    <div className="double-bounce2"></div>
                  </div>
                  <span className="loading-text">RepSync AI is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSendMessage} className="chat-input-container">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Paste interaction notes or talk to AI... (Press Enter to log)"
          rows="2"
          disabled={isLoading}
          required
        />
        <button
          type="submit"
          className="chat-log-button"
          disabled={isLoading || !input.trim()}
        >
          Log
        </button>
      </form>
    </div>
  );
}
