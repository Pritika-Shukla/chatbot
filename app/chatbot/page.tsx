'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type FileUIPart } from 'ai';
import { useState, useRef, useEffect, useMemo } from 'react';
import { Save, Send, MessageSquare, Settings, Check, Image as ImageIcon, X, Copy, RotateCcw, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

export default function Page() {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [input, setInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedPrompt, setSavedPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('grok-4-fast-reasoning');
  const [selectedImages, setSelectedImages] = useState<Array<{ data: string; mimeType: string }>>([]);
  const [responseSliders, setResponseSliders] = useState<Record<string, number>>({});
  const [lastMessageId, setLastMessageId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
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
  
  const { messages, sendMessage, status, error: chatError } = useChat({
    transport,
    onError: (error) => {
      console.error('Chat error:', error);
      setError(error.message || 'An error occurred while processing your request. Please try again.');
    },
  });

  // Clear error when status changes to ready
  useEffect(() => {
    if (status === 'ready' && error) {
      // Don't auto-clear errors, let user dismiss them
    }
  }, [status, error]);

  // Auto-navigate to the latest response when a new one is generated
  useEffect(() => {
    if (messages.length === 0) return;
    
    const lastMessage = messages[messages.length - 1];
    
    // Check if this is a new assistant message or if status changed to ready (streaming finished)
    const isNewAssistantMessage = lastMessage.role === 'assistant' && lastMessage.id !== lastMessageId;
    const isStreamingComplete = status === 'ready' && lastMessage.role === 'assistant';
    
    if (isNewAssistantMessage || isStreamingComplete) {
      if (isNewAssistantMessage) {
        setLastMessageId(lastMessage.id);
      }
      
      // Find which group this belongs to
      for (let i = messages.length - 2; i >= 0; i--) {
        if (messages[i].role === 'user') {
          const groupId = messages[i].id;
          const groups = groupMessages();
          const group = groups.find(g => g.groupId === groupId);
          if (group && group.assistantMessages.length > 0) {
            const totalSlides = group.assistantMessages.length;
            const lastAssistantId = group.assistantMessages[totalSlides - 1]?.id;
            
            // Switch to the latest response in the group
            if (lastAssistantId === lastMessage.id || isStreamingComplete) {
              // Move to the last slide
              setResponseSliders(prev => {
                // Only update if we're not already on the last slide
                const currentSlide = prev[groupId] ?? 0;
                if (currentSlide !== totalSlides - 1) {
                  return {
                    ...prev,
                    [groupId]: totalSlides - 1,
                  };
                }
                return prev;
              });
            }
          }
          break;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, status, lastMessageId]); // Trigger when messages, status, or lastMessageId changes

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const supportedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    const maxFileSize = 10 * 1024 * 1024; // 10MB

    Array.from(files).forEach(file => {
      // Check file type
      if (!file.type.startsWith('image/')) {
        setError(`Unsupported file type: ${file.name}. Please upload an image file (JPEG, PNG, GIF, WebP, or SVG).`);
        return;
      }

      // Check if it's a supported image format
      if (!supportedImageTypes.includes(file.type)) {
        setError(`Unsupported image format: ${file.name}. Supported formats: JPEG, PNG, GIF, WebP, SVG.`);
        return;
      }

      // Check file size
      if (file.size > maxFileSize) {
        setError(`File too large: ${file.name}. Maximum file size is 10MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        // Extract base64 data and mime type
        const base64Data = result.split(',')[1];
        setSelectedImages(prev => [...prev, { data: base64Data, mimeType: file.type }]);
        setError(null); // Clear error on success
      };
      reader.onerror = () => {
        setError(`Failed to read file: ${file.name}. Please try again.`);
      };
      reader.readAsDataURL(file);
    });
    
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleRegenerate = (assistantMessageId: string) => {
    // Find the index of the assistant message
    const assistantIndex = messages.findIndex(msg => msg.id === assistantMessageId);
    if (assistantIndex === -1) return;

    // Find the preceding user message
    const userMessage = messages[assistantIndex - 1];
    if (!userMessage || userMessage.role !== 'user') return;

    // Store the user message parts
    const userMessageParts = userMessage.parts;

    // Clear any previous errors
    setError(null);

    // Resend the user message to generate a new response
    // This will keep all previous messages and add a new assistant response
    sendMessage({ parts: userMessageParts });
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  // Group messages: each user message and its following assistant responses
  const groupMessages = () => {
    const groups: Array<{
      userMessage: typeof messages[0];
      assistantMessages: typeof messages;
      groupId: string;
    }> = [];
    
    const processedIndices = new Set<number>();
    
    const getUserContent = (msg: typeof messages[0]) => {
      return msg.parts.map(part => {
        if (part.type === 'text') return part.text;
        if (part.type === 'file') return part.url || '';
        return '';
      }).join('|');
    };
    
    for (let i = 0; i < messages.length; i++) {
      if (processedIndices.has(i)) continue;
      
      const message = messages[i];
      if (message.role === 'user') {
        const assistantMessages: typeof messages = [];
        const currentUserContent = getUserContent(message);
        let j = i + 1; // Start after the user message
        
        // First, collect assistant messages immediately following this user message
        while (j < messages.length && messages[j].role === 'assistant') {
          assistantMessages.push(messages[j]);
          processedIndices.add(j);
          j++;
        }
        
        // Then check for duplicate user messages (regenerations) and collect their assistant responses
        while (j < messages.length) {
          if (messages[j].role === 'user' && !processedIndices.has(j)) {
            const userContent = getUserContent(messages[j]);
            if (userContent === currentUserContent) {
              // Same user message (regeneration), mark as processed
              processedIndices.add(j);
              j++;
              // Collect assistant messages after this duplicate user message
              while (j < messages.length && messages[j].role === 'assistant') {
                assistantMessages.push(messages[j]);
                processedIndices.add(j);
                j++;
              }
            } else {
              // Different user message, stop
              break;
            }
          } else {
            // Not a user message, stop
            break;
          }
        }
        
        if (assistantMessages.length > 0) {
          groups.push({
            userMessage: message,
            assistantMessages,
            groupId: message.id,
          });
          processedIndices.add(i);
        }
      }
    }
    
    return groups;
  };

  const setSliderIndex = (groupId: string, index: number, maxIndex: number) => {
    setResponseSliders(prev => ({
      ...prev,
      [groupId]: Math.max(0, Math.min(index, maxIndex)),
    }));
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
            {(error || chatError) && (
              <div className="mb-3 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-2 animate-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-500">Error</p>
                  <p className="text-xs text-red-400 mt-1">
                    {error || chatError?.message || 'An error occurred while processing your request. Please try again.'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setError(null);
                  }}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors p-1"
                  title="Dismiss error"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-black dark:text-white">
                <p className="text-sm">Start a conversation</p>
                <p className="text-xs mt-1">Type a message to begin</p>
              </div>
            ) : (
              (() => {
                const groups = groupMessages();
                const renderedMessageIds = new Set<string>();
                
                return groups.map((group) => {
                  const currentSlide = responseSliders[group.groupId] ?? 0;
                  const currentAssistantMessage = group.assistantMessages[currentSlide];
                  const totalSlides = group.assistantMessages.length;
                  
                  // Mark messages as rendered
                  renderedMessageIds.add(group.userMessage.id);
                  group.assistantMessages.forEach(msg => renderedMessageIds.add(msg.id));
                  
                  // Extract text content for copying
                  const textContent = currentAssistantMessage.parts
                    .filter(part => part.type === 'text')
                    .map(part => part.text)
                    .join('');

                  return (
                    <div key={group.groupId} className="space-y-3">
                      {/* User Message */}
                      <div className="flex justify-end">
                        <div className="max-w-[85%] rounded px-3 py-2 bg-black text-white">
                          <div className="text-sm whitespace-pre-wrap space-y-2">
                            {group.userMessage.parts.map((part, partIndex) => {
                              if (part.type === 'text') {
                                return <span key={partIndex}>{part.text}</span>;
                              }
                              if (part.type === 'file' && part.mediaType.startsWith('image/')) {
                                return (
                                  <div key={partIndex} className="mt-2">
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

                      {/* Assistant Response Carousel */}
                      <div className="flex justify-start">
                        <div className="max-w-[85%] flex flex-col gap-2 w-full">
                          {/* Carousel Container */}
                          <div className="relative w-full">
                            {/* Navigation Arrows */}
                            {totalSlides > 1 && (
                              <>
                                <button
                                  onClick={() => setSliderIndex(group.groupId, currentSlide - 1, totalSlides - 1)}
                                  disabled={currentSlide === 0}
                                  className="absolute left-4 top-1/2 -translate-y-1/2 -translate-x-10 bg-gray-700/80 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-full p-1.5 transition-all z-10 shadow-lg"
                                  title="Previous response"
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setSliderIndex(group.groupId, currentSlide + 1, totalSlides - 1)}
                                  disabled={currentSlide === totalSlides - 1}
                                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-10 bg-gray-700/80 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-full p-1.5 transition-all z-10 shadow-lg"
                                  title="Next response"
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            <div className="bg-white dark:bg-black border border-white rounded px-3 py-2 ml-4">
                              {(() => {
                                // Check if we're streaming a new response for this group
                                const isStreamingForThisGroup = 
                                  (status === 'streaming' || status === 'submitted') && 
                                  messages.length > 0 && 
                                  messages[messages.length - 1].role === 'assistant' &&
                                  group.assistantMessages.length > 0 &&
                                  group.assistantMessages[group.assistantMessages.length - 1]?.id === messages[messages.length - 1].id &&
                                  currentSlide === group.assistantMessages.length - 1;
                                
                                const hasContent = currentAssistantMessage.parts.length > 0;
                                
                                if (isStreamingForThisGroup && !hasContent) {
                                  // Show loader only if there's no content yet
                                  return (
                                    <div className="flex space-x-1 py-2">
                                      <div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                      <div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                      <div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                  );
                                }
                                
                                return (
                                  <div className="text-sm whitespace-pre-wrap space-y-2">
                                    {currentAssistantMessage.parts.map((part, partIndex) => {
                                      if (part.type === 'text') {
                                        return <span key={partIndex}>{part.text}</span>;
                                      }
                                      if (part.type === 'file' && part.mediaType.startsWith('image/')) {
                                        return (
                                          <div key={partIndex} className="mt-2">
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
                                    {isStreamingForThisGroup && hasContent && (
                                      <div className="flex space-x-1 mt-2">
                                        <div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Response Counter */}
                          {totalSlides > 1 && (
                            <div className="flex items-center justify-center mt-2">
                              <span className="text-xs text-gray-400">
                                {currentSlide + 1}/{totalSlides}
                              </span>
                            </div>
                          )}

                          {/* Action Buttons */}
                          {textContent && (
                            <div className="flex gap-2 mt-1">
                              <button
                                onClick={() => handleCopy(textContent)}
                                className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-white rounded flex items-center gap-1 transition-colors"
                                title="Copy"
                              >
                                <Copy className="w-3 h-3" />
                                Copy
                              </button>
                              <button
                                onClick={() => handleRegenerate(currentAssistantMessage.id)}
                                disabled={status !== 'ready'}
                                className="px-2 py-1 text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded flex items-center gap-1 transition-colors"
                                title="Regenerate"
                              >
                                <RotateCcw className="w-3 h-3" />
                                Regenerate
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()
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
                  // Clear any previous errors
                  setError(null);
                  
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