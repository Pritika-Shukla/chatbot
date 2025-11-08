'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect, useMemo } from 'react';

const SECRET_KEY_STORAGE = 'chatbot_secret_key';

export default function Page() {
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [loginKey, setLoginKey] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful assistant.');
  const [input, setInput] = useState('');
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedPrompt, setSavedPrompt] = useState('You are a helpful assistant.');
  const systemPromptRef = useRef(systemPrompt);
  
  // Load secret key from localStorage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem(SECRET_KEY_STORAGE);
    if (storedKey) {
      setSecretKey(storedKey);
    }
  }, []);
  
  // Check if prompt has unsaved changes
  const hasUnsavedChanges = systemPrompt !== savedPrompt;
  
  // Load system prompt from MongoDB on mount
  useEffect(() => {
    const loadPrompt = async () => {
      try {
        const response = await fetch('/api/prompt');
        if (response.ok) {
          const data = await response.json();
          const prompt = data.prompt || 'You are a helpful assistant.';
          setSystemPrompt(prompt);
          setSavedPrompt(prompt);
          systemPromptRef.current = prompt;
        }
      } catch (error) {
        console.error('Error loading prompt:', error);
      } finally {
        setIsLoadingPrompt(false);
      }
    };
    
    loadPrompt();
  }, []);
  
  // Update ref when systemPrompt changes (for chat to use current prompt)
  useEffect(() => {
    systemPromptRef.current = systemPrompt;
  }, [systemPrompt]);
  
  // Save prompt to MongoDB
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
        setTimeout(() => setSaveSuccess(false), 2000); // Hide success message after 2 seconds
      } else {
        console.error('Failed to save prompt');
      }
    } catch (error) {
      console.error('Error saving prompt:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setLoginError('');

    // Store the key temporarily
    const testKey = loginKey.trim();
    
    if (!testKey) {
      setLoginError('Please enter a secret key');
      setIsAuthenticating(false);
      return;
    }

    // Test the key by making a test request
    try {
      const testResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testKey}`,
        },
        body: JSON.stringify({
          messages: [],
          system: 'Test',
          secretKey: testKey,
        }),
      });

      if (testResponse.status === 401) {
        setLoginError('Invalid secret key. Please try again.');
        setIsAuthenticating(false);
        return;
      }

      // If we get here, the key is valid (or server error, but we'll assume valid)
      localStorage.setItem(SECRET_KEY_STORAGE, testKey);
      setSecretKey(testKey);
      setLoginKey('');
    } catch {
      // If it's a network error or other issue, we'll still store it and let the actual chat handle validation
      localStorage.setItem(SECRET_KEY_STORAGE, testKey);
      setSecretKey(testKey);
      setLoginKey('');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem(SECRET_KEY_STORAGE);
    setSecretKey(null);
    setLoginKey('');
  };

  const transport = useMemo(() => {
    // This function is called later when sending messages, not during render
    // The ref access happens inside prepareSendMessagesRequest callback, not during render
    const getSystemPrompt = () => systemPromptRef.current;
    const getSecretKey = () => secretKey;
    
    return new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest: ({ body, messages, headers, ...rest }) => {
        // Include messages, system, and secret key in the body
        return {
          ...rest,
          headers: {
            ...headers,
            'Authorization': `Bearer ${getSecretKey()}`,
          },
          body: {
            ...body,
            messages,
            system: getSystemPrompt(),
            secretKey: getSecretKey(),
          },
        };
      },
    });
  }, [secretKey]);
  
  const { messages, sendMessage, status } = useChat({
    transport,
  });

  // Show login screen if not authenticated
  if (!secretKey) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="w-full max-w-md border border-white rounded-lg overflow-hidden bg-white dark:bg-black shadow-sm p-6">
          <h1 className="text-2xl font-bold mb-4 text-center">Chatbot Access</h1>
          <p className="text-sm text-center mb-6 text-black dark:text-white opacity-70">
            Please enter your secret key to access the chatbot
          </p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                value={loginKey}
                onChange={e => {
                  setLoginKey(e.target.value);
                  setLoginError('');
                }}
                placeholder="Enter secret key"
                disabled={isAuthenticating}
                className="w-full px-3 py-2 bg-white dark:bg-black border border-white rounded focus:outline-none focus:ring-1 focus:ring-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                autoFocus
              />
              {loginError && (
                <p className="text-red-500 text-xs mt-2">{loginError}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={isAuthenticating || !loginKey.trim()}
              className="w-full px-4 py-2 bg-black text-white rounded font-medium hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isAuthenticating ? 'Authenticating...' : 'Access Chatbot'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full  flex border border-white rounded-lg overflow-hidden bg-white dark:bg-black shadow-sm h-[90vh]">
        {/* Left Side: System Prompt Section (50%) */}
        <div className="w-1/2 flex flex-col border-r border-white">
          <div className="border-b border-white px-4 sm:px-6 py-3">
            <h2 className="text-lg sm:text-xl font-medium">System Prompt</h2>
          </div>
          <div className="flex-1 flex flex-col px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              {isLoadingPrompt && (
                <span className="text-xs text-black dark:text-white">Loading...</span>
              )}
              {saveSuccess && (
                <span className="text-xs text-black dark:text-white">Saved</span>
              )}
            </div>
            <textarea
              id="system-prompt"
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              disabled={isLoadingPrompt}
              placeholder={isLoadingPrompt ? "Loading prompt..." : "Enter your system prompt here..."}
              className="flex-1 w-full px-3 py-2 text-sm bg-white dark:bg-black border border-white rounded focus:outline-none focus:ring-1 focus:ring-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed resize-none"
            />
            <button
              onClick={handleSavePrompt}
              disabled={isLoadingPrompt || isSaving}
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

        {/* Right Side: Chat Section (50%) */}
        <div className="w-1/2 flex flex-col">
          <div className="border-b border-white px-4 sm:px-6 py-3 flex items-center justify-between">
            <h1 className="text-lg sm:text-xl font-medium">Chat</h1>
            <button
              onClick={handleLogout}
              className="text-xs px-3 py-1 bg-gray-200 dark:bg-gray-800 text-black dark:text-white rounded hover:opacity-80 transition-colors"
              title="Logout"
            >
              Logout
            </button>
          </div>

          {/* Messages Area */}
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

          {/* Input Area */}
          <div className="border-t border-white px-4 sm:px-6 py-3">
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
                disabled={status !== 'ready'}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 bg-white dark:bg-black border border-white rounded focus:outline-none focus:ring-1 focus:ring-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
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