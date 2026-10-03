import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Check,
  Copy,
  MapPin,
  Maximize2,
  Minimize2,
  PlusCircle,
  Send,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { apiClient } from '../api/client';
import type { ChatMessage } from '../api/types';

interface ChatbotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestPinDrop?: () => void;
  onOpenReportModal?: () => void;
}

const INITIAL_SUGGESTIONS = [
  'Explain Priority Scoring formula',
  'Hazardous waste handling guidelines',
  'How does VRP route optimization work?',
  'What are the municipal SLA windows?',
  'Give me an operational backlog summary',
];

export const ChatbotModal: React.FC<ChatbotModalProps> = ({
  isOpen,
  onClose,
  onRequestPinDrop,
  onOpenReportModal,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      content:
        '👋 Hello! I am **EcoBot**, your intelligent municipal AI assistant powered by **Google Gemini**.\n\n' +
        'I can help you analyze waste requests, calculate priority scores, provide hazardous containment protocols, ' +
        'and explain our vehicle dispatching algorithms.\n\n' +
        'How may I assist you with municipal operations today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      model: 'gemini-3.1-flash',
    },
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(INITIAL_SUGGESTIONS);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Build conversation history for context
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const res = await apiClient.sendChatMessage(text, history);

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: res.model || 'gemini-3.1-flash',
      };

      setMessages((prev) => [...prev, botMsg]);
      if (res.suggestions && res.suggestions.length > 0) {
        setSuggestions(res.suggestions);
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content:
          '⚠️ I encountered a temporary connection issue reaching the Gemini AI service. ' +
          'Please ensure the backend is running or try your query again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: 'ecobot-offline',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    if (confirm('Clear entire chat conversation history?')) {
      setMessages([
        {
          id: 'welcome',
          role: 'model',
          content:
            'Conversation reset. I am **EcoBot**, powered by **Google Gemini**. How can I help you now?',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          model: 'gemini-3.1-flash',
        },
      ]);
      setSuggestions(INITIAL_SUGGESTIONS);
    }
  };

  // Helper to render simple markdown formatting
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, index) => {
      // Headers
      if (line.startsWith('### ')) {
        return (
          <h4 key={index} style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0.5rem 0 0.25rem', color: '#1E293B' }}>
            {line.replace('### ', '')}
          </h4>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <h3 key={index} style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0.6rem 0 0.3rem', color: '#1E293B' }}>
            {line.replace('## ', '')}
          </h3>
        );
      }
      // Bullet points
      if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
        const text = line.trim().substring(2);
        return (
          <li key={index} style={{ marginLeft: '1.2rem', marginBottom: '0.2rem', listStyleType: 'disc' }}>
            {renderInlineMarkdown(text)}
          </li>
        );
      }
      // Numbered lists
      if (/^\d+\.\s/.test(line.trim())) {
        const match = line.trim().match(/^(\d+\.)\s(.*)/);
        if (match) {
          return (
            <div key={index} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.2rem' }}>
              <span style={{ fontWeight: 700, color: '#4F46E5', minWidth: '18px' }}>{match[1]}</span>
              <span>{renderInlineMarkdown(match[2])}</span>
            </div>
          );
        }
      }
      // Empty lines
      if (!line.trim()) {
        return <div key={index} style={{ height: '0.4rem' }} />;
      }
      // Regular paragraphs
      return (
        <p key={index} style={{ margin: '0.2rem 0' }}>
          {renderInlineMarkdown(line)}
        </p>
      );
    });
  };

  // Helper for inline bold, code, and highlight
  const renderInlineMarkdown = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} style={{ color: '#0F172A', fontWeight: 700 }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={i}
            style={{
              background: '#F1F5F9',
              padding: '0.1rem 0.35rem',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '0.82rem',
              color: '#4F46E5',
              border: '1px solid #E2E8F0',
            }}
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: isExpanded ? '540px' : '420px',
        height: isExpanded ? '740px' : '580px',
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100vh - 48px)',
        zIndex: 9999,
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.22), 0 0 1px 1px rgba(0, 0, 0, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #E2E8F0',
        transition: 'all 0.25s ease-in-out',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '0.85rem 1.1rem',
          background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              position: 'relative',
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
            }}
          >
            <Bot size={22} color="white" />
            <span
              style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#10B981',
                border: '2px solid #1E1B4B',
              }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', letterSpacing: '-0.01em' }}>
                EcoBot Assistant
              </span>
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <Sparkles size={9} style={{ color: '#FCD34D' }} /> Gemini AI
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#CBD5E1', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
              Municipal Operations & Dispatch
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <button
            type="button"
            onClick={handleClearHistory}
            title="Clear Chat History"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.7)',
              cursor: 'pointer',
              padding: '5px',
              borderRadius: '6px',
              display: 'flex',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'white')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)')}
          >
            <Trash2 size={16} />
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Restore size' : 'Expand window'}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.7)',
              cursor: 'pointer',
              padding: '5px',
              borderRadius: '6px',
              display: 'flex',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'white')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)')}
          >
            {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          <button
            type="button"
            onClick={onClose}
            title="Close Assistant"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.7)',
              cursor: 'pointer',
              padding: '5px',
              borderRadius: '6px',
              display: 'flex',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'white')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)')}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Messages Stream */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          background: '#F8FAFC',
        }}
      >
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '100%',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.45rem',
                  flexDirection: isUser ? 'row-reverse' : 'row',
                  maxWidth: '92%',
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: isUser ? '#4F46E5' : '#0F172A',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                    fontSize: '0.75rem',
                  }}
                >
                  {isUser ? <User size={15} /> : <Bot size={15} />}
                </div>

                {/* Bubble Container */}
                <div
                  style={{
                    background: isUser
                      ? 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)'
                      : 'white',
                    color: isUser ? 'white' : '#1E293B',
                    padding: '0.75rem 0.95rem',
                    borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                    boxShadow: isUser
                      ? '0 3px 8px rgba(79, 70, 229, 0.25)'
                      : '0 2px 8px rgba(0, 0, 0, 0.04)',
                    border: isUser ? 'none' : '1px solid #E2E8F0',
                    fontSize: '0.85rem',
                    lineHeight: '1.45',
                    wordBreak: 'break-word',
                  }}
                >
                  {isUser ? msg.content : renderFormattedContent(msg.content)}
                </div>
              </div>

              {/* Message Footer / Metadata */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginTop: '0.25rem',
                  fontSize: '0.68rem',
                  color: '#94A3B8',
                  padding: isUser ? '0 0.5rem 0 0' : '0 0 0 2.2rem',
                }}
              >
                <span>{msg.timestamp}</span>
                {msg.model && (
                  <>
                    <span>•</span>
                    <span style={{ color: '#6366F1' }}>{msg.model}</span>
                  </>
                )}
                {!isUser && (
                  <button
                    type="button"
                    onClick={() => handleCopyMessage(msg.id || '', msg.content)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      color: copiedId === msg.id ? '#10B981' : '#94A3B8',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                      marginLeft: '4px',
                    }}
                    title="Copy response"
                  >
                    {copiedId === msg.id ? <Check size={11} /> : <Copy size={11} />}
                    <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Thinking Indicator */}
        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: '#0F172A',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Bot size={15} />
            </div>
            <div
              style={{
                background: 'white',
                padding: '0.65rem 0.95rem',
                borderRadius: '14px 14px 14px 2px',
                border: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
              }}
            >
              <span style={{ fontSize: '0.78rem', color: '#64748B' }}>EcoBot is analyzing...</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <span className="typing-dot" style={{ animationDelay: '0ms' }} />
                <span className="typing-dot" style={{ animationDelay: '150ms' }} />
                <span className="typing-dot" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Municipal Actions */}
      <div
        style={{
          padding: '0.35rem 0.8rem',
          background: '#F8FAFC',
          borderTop: '1px solid #E2E8F0',
          display: 'flex',
          gap: '0.4rem',
        }}
      >
        {onRequestPinDrop && (
          <button
            type="button"
            onClick={onRequestPinDrop}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: '#EEF2FF',
              color: '#4F46E5',
              border: '1px solid #C7D2FE',
              borderRadius: '6px',
              padding: '0.2rem 0.5rem',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <MapPin size={12} /> Drop Map Pin
          </button>
        )}
        {onOpenReportModal && (
          <button
            type="button"
            onClick={onOpenReportModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: '#ECFDF5',
              color: '#059669',
              border: '1px solid #A7F3D0',
              borderRadius: '6px',
              padding: '0.2rem 0.5rem',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <PlusCircle size={12} /> Report Waste
          </button>
        )}
      </div>

      {/* Suggestion Chips */}
      {suggestions.length > 0 && !isLoading && (
        <div
          style={{
            padding: '0.5rem 0.8rem',
            background: '#F1F5F9',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
            <Sparkles size={11} style={{ color: '#4F46E5' }} /> Prompts:
          </span>
          {suggestions.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(chip)}
              style={{
                background: 'white',
                border: '1px solid #CBD5E1',
                borderRadius: '20px',
                padding: '0.2rem 0.65rem',
                fontSize: '0.73rem',
                color: '#334155',
                cursor: 'pointer',
                fontWeight: 500,
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#4F46E5';
                e.currentTarget.style.color = '#4F46E5';
                e.currentTarget.style.background = '#EEF2FF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#CBD5E1';
                e.currentTarget.style.color = '#334155';
                e.currentTarget.style.background = 'white';
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Input Form */}
      <div
        style={{
          padding: '0.75rem 0.9rem',
          background: 'white',
          borderTop: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'flex-end',
          gap: '0.5rem',
        }}
      >
        <textarea
          ref={inputRef}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask EcoBot anything (e.g. explain priority score, report hazard)..."
          rows={1}
          style={{
            flex: 1,
            border: '1.5px solid #CBD5E1',
            borderRadius: '10px',
            padding: '0.55rem 0.75rem',
            fontSize: '0.84rem',
            resize: 'none',
            outline: 'none',
            maxHeight: '90px',
            fontFamily: 'inherit',
            lineHeight: '1.3',
          }}
          onFocus={(e) => (e.target.style.borderColor = '#4F46E5')}
          onBlur={(e) => (e.target.style.borderColor = '#CBD5E1')}
        />

        <button
          type="button"
          onClick={() => handleSendMessage()}
          disabled={!inputMessage.trim() || isLoading}
          style={{
            background: !inputMessage.trim() || isLoading ? '#94A3B8' : '#4F46E5',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            padding: '0.55rem 0.75rem',
            cursor: !inputMessage.trim() || isLoading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '38px',
            transition: 'background 0.2s',
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};
