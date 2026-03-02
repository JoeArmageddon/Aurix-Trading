'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, X, MessageCircle, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Generate unique ID to avoid collisions
const generateId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export function AIAssistant() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isPro = user?.plan === 'pro';
  const dailyLimit = 5;
  const usedToday = user?.aiUsageToday || 0;
  const remainingCount = isPro ? Infinity : Math.max(0, dailyLimit - usedToday);
  const remainingDisplay = isPro ? 'Unlimited' : remainingCount.toString();
  const isLimitReached = !isPro && remainingCount === 0;

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Check if asking about a specific asset
      const symbolMatch = input.match(/\b(BTC|ETH|SOL|BNB|XRP|ADA|AVAX|DOGE|LINK|MATIC)\b/i);
      const symbol = symbolMatch?.[0]?.toUpperCase() || 'BTC';

      const response = await api.analyzeAsset(symbol);

      if (response.success && response.data?.analysis) {
        const assistantMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: response.data.analysis,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        throw new Error(response.error || 'Analysis failed');
      }
    } catch (error) {
      const errorMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: error instanceof Error && error.message?.toLowerCase().includes('limit')
          ? "You've reached your daily AI analysis limit. Upgrade to Pro for unlimited access."
          : "I'm having trouble analyzing that right now. Try asking about a specific crypto symbol like BTC or ETH.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, isPro]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <>
      {/* Floating Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-accent rounded-full shadow-lg shadow-accent/30 flex items-center justify-center z-50 hover:bg-accent/90 transition-colors"
        style={{ display: isOpen ? 'none' : 'flex' }}
        aria-label="Open AI Assistant"
      >
        <Brain className="w-6 h-6 text-white" />
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 w-96 z-50"
          >
            <Card className="border-accent/30 shadow-xl shadow-black/50">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="flex items-center text-base">
                  <Brain className="w-5 h-5 mr-2 text-accent" />
                  AI Assistant
                  <span className="ml-2 text-xs text-gray-400">
                    {isPro ? 'Pro' : `${remainingDisplay} left`}
                  </span>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close AI Assistant"
                >
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>

              <CardContent className="p-0">
                {/* Messages */}
                <div className="h-80 overflow-y-auto px-4 py-2 space-y-4">
                  {messages.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">
                        Ask me about any asset like<br />
                        &quot;What&apos;s the outlook for BTC?&quot;
                      </p>
                      {isLimitReached && (
                        <p className="text-amber-500 text-xs mt-2">
                          Daily limit reached. Upgrade to Pro for unlimited access.
                        </p>
                      )}
                    </div>
                  )}

                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          message.role === 'user'
                            ? 'bg-accent text-white'
                            : 'bg-surface-light text-gray-200'
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-surface-light rounded-lg px-3 py-2">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:100ms]" />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:200ms]" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-border">
                  <div className="flex space-x-2">
                    <Input
                      placeholder={isLimitReached ? 'Daily limit reached' : 'Ask about BTC, ETH...'}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyPress}
                      disabled={isLoading || isLimitReached}
                      className="flex-1"
                    />
                    <Button
                      size="icon"
                      onClick={handleSend}
                      disabled={isLoading || !input.trim() || isLimitReached}
                      aria-label="Send message"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
