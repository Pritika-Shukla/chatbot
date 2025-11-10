'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect, useMemo } from 'react';

export default function Page() {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [input, setInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedPrompt, setSavedPrompt] = useState('');
  const systemPromptRef = useRef(systemPrompt);
  
  const hasUnsavedChanges = systemPrompt !== savedPrompt;
  
  useEffect(() => {
    const loadPrompt = async () => {
      try {
        const response = await fetch('/api/prompt');
        if (response.ok) {
          const data = await response.json();
          const prompt = data.prompt || '';
          setSystemPrompt(prompt);
          setSavedPrompt(prompt);
          systemPromptRef.current = prompt;
        } else {
          const fallback = 'You are a helpful assistant.';
          setSystemPrompt(fallback);
          setSavedPrompt(fallback);
          systemPromptRef.current = fallback;
        }
      } catch (error) {
        console.error('Error loading prompt:', error);
        const fallback = 'You are a helpful assistant.';
        setSystemPrompt(fallback);
        setSavedPrompt(fallback);
        systemPromptRef.current = fallback;
      }
    };
    
    loadPrompt();
  }, []);
  
  useEffect(() => {
    systemPromptRef.current = systemPrompt;
  }, [systemPrompt]);
  
  const handleSavePrompt = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    
    try {
      const response = await fetch('/api/prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: systemPrompt }),
      });
      
      if (response.ok) {
        setSavedPrompt(systemPrompt);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        console.error('Failed to save prompt');
      }
    } catch (error) {
      console.error('Error saving prompt:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  const transport = useMemo(() => {
    const getSystemPrompt = () => systemPromptRef.current;
    
    return new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest: ({ body, messages, headers, ...rest }) => {
        return {
          ...rest,
          headers: {
            ...headers,
          },
          body: {
            ...body,
            messages,
            system: getSystemPrompt(),
          },
        };
      },
    });
  }, []);
  
  const { messages, sendMessage, status } = useChat({
    transport,
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full  flex border border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-black shadow-sm h-[90vh]">
        <div className="w-1/2 flex flex-col border-r border-gray-800">
          <div className="border-b border-gray-800 px-4 sm:px-6 py-3">
            <h2 className="text-lg sm:text-xl font-medium">System Prompt</h2>
          </div>
          <div className="flex-1 flex flex-col px-4 sm:px-6 py-4">
            {saveSuccess && (
              <div className="mb-3">
                <span className="text-xs text-black dark:text-white">Saved</span>
              </div>
            )}
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              placeholder="Enter your system prompt here..."
              className="flex-1 w-full px-3 py-2 text-sm bg-white dark:bg-black border border-gray-800 rounded focus:outline-none focus:ring-1 focus:ring-white transition-colors resize-none"
            />
            <button
              onClick={handleSavePrompt}
              disabled={isSaving}
              className={`mt-3 px-4 py-2 rounded font-medium hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm ${
                hasUnsavedChanges 
                  ? 'bg-yellow-500 text-black' 
                  : 'bg-black text-white'
              }`}
            >
              {isSaving ? 'Saving...' : 'Save Prompt'}
            </button>
          </div>
        </div>

        <div className="w-1/2 flex flex-col">
          <div className="border-b border-gray-800 px-4 sm:px-6 py-3">
            <h1 className="text-lg sm:text-xl font-medium">Chat</h1>
          </div>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-black dark:text-white">
                <p className="text-sm">Start a conversation</p>
                <p className="text-xs mt-1">Type a message to begin</p>
              </div>
            ) : (
              messages.map(message => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded px-3 py-2 ${
                      message.role === 'user'
                        ? 'bg-black text-white'
                        : 'bg-white dark:bg-black border border-white text-black dark:text-white'
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap">
                      {message.parts.map((part, index) =>
                        part.type === 'text' ? <span key={index}>{part.text}</span> : null,
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            {status === 'streaming' && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-black border border-white rounded px-3 py-2">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

        <div className="border-t border-gray-800 px-4 sm:px-6 py-3">
            <form
              onSubmit={e => {
                e.preventDefault();
                if (input.trim() && status === 'ready') {
                  sendMessage({ text: input });
                  setInput('');
                }
              }}
              className="flex gap-2 sm:gap-3"
            >
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 bg-white dark:bg-black border border-gray-800 rounded focus:outline-none focus:ring-1 focus:ring-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              />
              <button
                type="submit"
                disabled={status !== 'ready' || !input.trim()}
                className="px-4 sm:px-6 py-2 bg-black text-white rounded font-medium hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}