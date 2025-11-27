'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type FileUIPart } from 'ai';
import { useState, useRef, useEffect, useMemo } from 'react';
import { Save, Send, MessageSquare, Settings, Check, Image as ImageIcon, X } from 'lucide-react';

export default function Page() {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [input, setInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedPrompt, setSavedPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('grok-4-fast-reasoning');
  const [selectedImages, setSelectedImages] = useState<Array<{ data: string; mimeType: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
            model: selectedModel,
          },
        };
      },
    });
  }, [selectedModel]);
  
  const { messages, sendMessage, status } = useChat({
    transport,
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          // Extract base64 data and mime type
          const base64Data = result.split(',')[1];
          setSelectedImages(prev => [...prev, { data: base64Data, mimeType: file.type }]);
        };
        reader.readAsDataURL(file);
      }
    });
    
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full  flex border border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-[#040404] shadow-sm h-[90vh]">
        <div className="w-1/2 flex flex-col border-r border-gray-800">
          <div className="border-b border-gray-800 px-4 sm:px-6 py-3">
            <h2 className="text-lg sm:text-xl font-medium flex items-center gap-2">
              <Settings className="w-5 h-5" />
              System Prompt
            </h2>
          </div>
          <div className="flex-1 flex flex-col px-4 sm:px-6 py-4">
            {saveSuccess && (
              <div className="mb-3 flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-xs text-black dark:text-white">Saved</span>
              </div>
            )}
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              placeholder="Enter your system prompt here..."
              className="flex-1 w-full px-3 py-2 text-sm bg-white dark:bg-[#040404] border border-gray-800 rounded focus:outline-none focus:ring-1 focus:ring-white transition-colors resize-none"
            />
            <button
              onClick={handleSavePrompt}
              disabled={isSaving}
              className={`mt-3 px-4 py-2 rounded font-medium hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center justify-center gap-2 ${
                hasUnsavedChanges 
                  ? 'bg-yellow-500 text-black' 
                  : 'bg-black text-white'
              }`}
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Prompt'}
            </button>
          </div>
        </div>

        <div className="w-1/2 flex flex-col">
          <div className="border-b border-gray-800 px-4 sm:px-6 py-3 flex items-center justify-between">
            <h1 className="text-lg sm:text-xl font-medium flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Chat
            </h1>
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="px-3 py-1.5 text-sm bg-white dark:bg-[#040404] border border-gray-800 rounded focus:outline-none focus:ring-1 focus:ring-white transition-colors"
            >
              <option value="grok-4-fast-reasoning">grok-4-fast-reasoning</option>
              <option value="grok-4-fast-non-reasoning">grok-4-fast-non-reasoning</option>
              <option value="grok-3-mini">grok-3-mini</option>
              <option value="grok-3">grok-3</option>
            </select>
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
                    <div className="text-sm whitespace-pre-wrap space-y-2">
                      {message.parts.map((part, index) => {
                        if (part.type === 'text') {
                          return <span key={index}>{part.text}</span>;
                        }
                        if (part.type === 'file' && part.mediaType.startsWith('image/')) {
                          return (
                            <div key={index} className="mt-2">
                              <img
                                src={part.url}
                                alt={part.filename || 'Uploaded image'}
                                className="max-w-full h-auto rounded border border-gray-700"
                                style={{ maxHeight: '300px' }}
                              />
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                </div>
              ))
            )}
            {(status === 'streaming' || status === 'submitted') && (
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
            {selectedImages.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {selectedImages.map((image, index) => (
                  <div key={index} className="relative inline-block">
                    <img
                      src={`data:${image.mimeType};base64,${image.data}`}
                      alt={`Preview ${index + 1}`}
                      className="w-16 h-16 object-cover rounded border border-gray-700"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors"
                      aria-label="Remove image"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <form
              onSubmit={e => {
                e.preventDefault();
                if ((input.trim() || selectedImages.length > 0) && status === 'ready') {
                  const parts: Array<{ type: 'text'; text: string } | FileUIPart> = [];
                  
                  // Add text if present
                  if (input.trim()) {
                    parts.push({ type: 'text', text: input });
                  }
                  
                  // Add images as FileUIPart
                  selectedImages.forEach(image => {
                    parts.push({
                      type: 'file',
                      mediaType: image.mimeType,
                      url: `data:${image.mimeType};base64,${image.data}`,
                    });
                  });
                  
                  sendMessage({ parts });
                  setInput('');
                  setSelectedImages([]);
                }
              }}
              className="flex gap-2 sm:gap-3"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageSelect}
                accept="image/*"
                multiple
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="px-3 py-2 bg-white dark:bg-black border border-gray-800 rounded font-medium hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2 cursor-pointer"
                title="Upload images"
              >
                <ImageIcon className="w-4 h-4" />
              </label>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 bg-white dark:bg-black border border-gray-800 rounded focus:outline-none focus:ring-1 focus:ring-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              />
              <button
                type="submit"
                disabled={status !== 'ready' || (!input.trim() && selectedImages.length === 0)}
                className="px-4 sm:px-6 py-2 bg-black border border-gray-800 text-white rounded font-medium hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}