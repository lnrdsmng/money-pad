import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import http from '../api/http';
import { useAuth } from '../auth/AuthProvider';
import { Send, MessageCircle, LoaderCircle, Shield, Heart, Reply, X } from 'lucide-react';
import { useFeedback } from './feedback/feedback';
import { getApiErrorMessage } from '../utils/apiError';

interface ReplyingToState {
  id: string;
  username: string;
  message: string;
}

export const GroupChat = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const targetMessageId = searchParams.get('messageId');
  const lastHandledTargetRef = useRef<string | null>(null);

  const [message, setMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<ReplyingToState | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const feedback = useFeedback();

  const { data: messages, refetch } = useQuery({
    queryKey: ['groupChat'],
    queryFn: async () => {
      const res = await http.get('/chat/messages');
      return res.data;
    },
    enabled: !!user,
    refetchInterval: 3000,
    refetchIntervalInBackground: false, // Stops polling when tab/window is inactive
  });

  const sendMutation = useMutation({
    mutationFn: (payload: { message: string; reply_to_id?: string }) =>
      http.post('/chat/messages', payload),
    onSuccess: () => {
      setMessage('');
      setReplyingTo(null);
      refetch();
    },
    onError: (error) => feedback.error(getApiErrorMessage(error, 'Your message could not be sent.')),
  });

  const reactMutation = useMutation({
    mutationFn: (msgId: string) => http.post(`/chat/messages/${msgId}/react`),
    onSuccess: () => {
      refetch();
    },
    onError: (error) => feedback.error(getApiErrorMessage(error, 'Could not update reaction.')),
  });

  // Handle scrolling to target message from notification or default to bottom
  useEffect(() => {
    if (!messagesContainerRef.current || !messages?.length) return;

    if (targetMessageId && lastHandledTargetRef.current !== targetMessageId) {
      const el = document.getElementById(`chat-msg-${targetMessageId}`);
      if (el) {
        lastHandledTargetRef.current = targetMessageId;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const timer = setTimeout(() => {
          setHighlightedMsgId(targetMessageId);
        }, 0);
        const clearTimer = setTimeout(() => {
          setHighlightedMsgId((curr) => (curr === targetMessageId ? null : curr));
        }, 3000);
        return () => {
          clearTimeout(timer);
          clearTimeout(clearTimer);
        };
      }
    } else if (!targetMessageId) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, targetMessageId]);

  // Dynamic textarea height adjustment
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const nextHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = `${Math.max(nextHeight, 42)}px`;
    }
  }, [message]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!message.trim() || sendMutation.isPending) return;

    sendMutation.mutate({
      message: message.trim(),
      reply_to_id: replyingTo?.id,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleReply = (targetMsg: any) => {
    setReplyingTo({
      id: targetMsg.id,
      username: targetMsg.username,
      message: targetMsg.message,
    });

    const mentionPrefix = `@${targetMsg.username} `;
    setMessage((prev) => {
      if (!prev.includes(mentionPrefix)) {
        return `${mentionPrefix}${prev}`;
      }
      return prev;
    });

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(mentionPrefix.length, mentionPrefix.length);
      }
    }, 50);
  };

  const scrollToMessage = (targetId: string) => {
    const el = document.getElementById(`chat-msg-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(targetId);
      setTimeout(() => {
        setHighlightedMsgId((curr) => (curr === targetId ? null : curr));
      }, 2000);
    } else {
      feedback.info('The original message is earlier in chat history.');
    }
  };

  const renderMessageContent = (text: string, isMe: boolean) => {
    const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span
            key={index}
            className={`font-semibold rounded px-1 py-0.5 select-text ${
              isMe
                ? 'bg-white/25 text-white underline underline-offset-2'
                : 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light'
            }`}
          >
            {part}
          </span>
        );
      }
      return <React.Fragment key={index}>{part}</React.Fragment>;
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-gray-200 dark:border-slate-800 flex flex-col h-[500px] sm:h-[650px] overflow-hidden">
      {/* Chat Header */}
      <div className="border-b border-gray-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 sm:py-4 bg-[#F5E9DA]/30 dark:bg-slate-800/40 flex items-center justify-between shrink-0">
        <div className="flex items-center">
          <MessageCircle className="w-5 h-5 mr-2 text-primary" />
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">Community Chat</h3>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Live
        </span>
      </div>

      {/* Messages Feed */}
      <div
        ref={messagesContainerRef}
        className="flex-1 p-3 sm:p-5 overflow-y-auto bg-[#FAF9F6]/50 dark:bg-slate-950/40 space-y-3 sm:space-y-4"
      >
        {messages?.map((msg: any) => {
          const isMe = msg.userId === user?.id;
          const isHighlighted = highlightedMsgId === msg.id;

          return (
            <div
              key={msg.id}
              id={`chat-msg-${msg.id}`}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'} min-w-0 transition-transform duration-300`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] min-w-0 rounded-2xl px-3.5 sm:px-4 py-2.5 shadow-xs transition-all duration-300 ${
                  isHighlighted ? 'ring-4 ring-primary ring-offset-2 scale-[1.02] shadow-lg animate-pulse' : ''
                } ${
                  msg.is_system
                    ? 'bg-[#F5E9DA] border border-amber-300/70 text-stone-900 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-100'
                    : isMe
                    ? 'bg-primary text-white rounded-br-xs'
                    : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-gray-100 rounded-bl-xs'
                }`}
              >
                {/* Replying To Quoted Snippet */}
                {msg.reply_to && (
                  <div
                    onClick={() => scrollToMessage(msg.reply_to.id)}
                    className={`mb-2 p-2 rounded-lg cursor-pointer transition-all border-l-2 text-left select-none ${
                      isMe
                        ? 'bg-black/15 hover:bg-black/25 border-white/80 text-white/90'
                        : 'bg-gray-100 dark:bg-slate-700/60 hover:bg-gray-200 dark:hover:bg-slate-700 border-primary text-gray-700 dark:text-gray-300'
                    }`}
                    title="Click to view replied message"
                  >
                    <div className={`flex items-center gap-1 text-[11px] font-bold ${isMe ? 'text-white' : 'text-primary'}`}>
                      <Reply className="w-3 h-3 scale-x-[-1]" />
                      <span>@{msg.reply_to.username}</span>
                    </div>
                    <p
                      className={`text-[11px] truncate mt-0.5 opacity-90 line-clamp-1 ${
                        isMe ? 'text-green-100' : 'text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {msg.reply_to.message}
                    </p>
                  </div>
                )}

                {/* Author Name / System Header */}
                {!isMe && (
                  <p
                    className={`text-xs font-bold mb-1 flex items-center gap-1 ${
                      msg.is_system ? 'text-amber-900 dark:text-amber-200' : 'text-primary'
                    }`}
                  >
                    {msg.is_system && <Shield className="w-3.5 h-3.5" />}
                    {msg.is_system ? 'Admin Notice' : `@${msg.username}`}
                  </p>
                )}

                {/* Chat Message Text with Word Wrapping & @Mention Highlighting */}
                <p
                  className={`text-xs sm:text-sm leading-relaxed break-words break-all [overflow-wrap:anywhere] whitespace-pre-wrap min-w-0 ${
                    isMe ? 'text-white' : 'text-gray-800 dark:text-gray-200'
                  }`}
                >
                  {renderMessageContent(msg.message, isMe)}
                </p>

                {/* Footer: Reactions, Reply Action, Timestamp */}
                <div className="flex items-center justify-between gap-2 mt-1.5 pt-1 border-t border-black/5 dark:border-white/5 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {/* Heart Reaction on others' messages */}
                    {!isMe && !msg.is_system && (
                      <button
                        type="button"
                        onClick={() => reactMutation.mutate(msg.id)}
                        disabled={reactMutation.isPending}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition cursor-pointer ${
                          msg.user_has_hearted
                            ? 'text-rose-500 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 font-semibold'
                            : 'text-gray-400 hover:text-rose-500 hover:bg-gray-100 dark:hover:bg-slate-700'
                        }`}
                        title={msg.user_has_hearted ? 'Unlike' : 'Heart react'}
                        aria-label={msg.user_has_hearted ? 'Unlike message' : 'Heart react to message'}
                      >
                        <Heart
                          className={`w-3.5 h-3.5 transition-transform active:scale-125 ${
                            msg.user_has_hearted ? 'fill-rose-500 text-rose-500' : ''
                          }`}
                        />
                        {msg.heart_count > 0 && <span className="text-[11px]">{msg.heart_count}</span>}
                      </button>
                    )}

                    {/* Read-only heart badge on own message */}
                    {isMe && msg.heart_count > 0 && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] text-white/90 bg-white/20">
                        <Heart className="w-3 h-3 fill-rose-200 text-rose-200" />
                        <span>{msg.heart_count}</span>
                      </span>
                    )}

                    {/* Reply Action Button */}
                    {!msg.is_system && (
                      <button
                        type="button"
                        onClick={() => handleReply(msg)}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] transition cursor-pointer ${
                          isMe
                            ? 'text-white/80 hover:text-white hover:bg-white/20'
                            : 'text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-slate-700'
                        }`}
                        title="Reply to message"
                        aria-label={`Reply to @${msg.username}`}
                      >
                        <Reply className="w-3 h-3" />
                        <span className="hidden sm:inline">Reply</span>
                      </button>
                    )}
                  </div>

                  {/* Timestamp */}
                  <span
                    className={`text-[10px] shrink-0 ${
                      isMe ? 'text-green-100' : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-slate-800 p-3 sm:p-4 bg-white dark:bg-slate-900 shrink-0">
        {/* Reply Context Banner */}
        {replyingTo && (
          <div className="flex items-center justify-between bg-primary/10 dark:bg-primary/20 border-l-4 border-primary px-3 py-1.5 rounded-t-xl text-xs mb-2 animate-in fade-in duration-200">
            <div className="flex items-center gap-1.5 overflow-hidden min-w-0">
              <Reply className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-gray-600 dark:text-gray-300 shrink-0">Replying to</span>
              <span className="font-semibold text-primary bg-primary/15 px-1.5 py-0.5 rounded-full shrink-0">
                @{replyingTo.username}
              </span>
              <span className="text-gray-500 dark:text-gray-400 truncate">
                {replyingTo.message}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-2 p-1 cursor-pointer rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition shrink-0"
              title="Cancel reply"
              aria-label="Cancel reply"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Input Form with Auto-growing Textarea */}
        <form onSubmit={handleSubmit} className="flex items-end space-x-2">
          <div className="flex-1 min-w-0 relative">
            <textarea
              ref={textareaRef}
              rows={1}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
              className="w-full resize-none min-h-[42px] max-h-[120px] py-2.5 px-4 text-xs sm:text-sm bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-2xl border border-gray-300 dark:border-slate-700 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary overflow-y-auto leading-normal"
            />
          </div>
          <button
            type="submit"
            disabled={!message.trim() || sendMutation.isPending}
            aria-busy={sendMutation.isPending}
            aria-label={sendMutation.isPending ? 'Sending message' : 'Send message'}
            className="bg-primary hover:bg-primary-hover active:scale-95 text-white p-2.5 rounded-full disabled:cursor-not-allowed disabled:opacity-50 transition shadow-xs cursor-pointer shrink-0 mb-0.5"
          >
            {sendMutation.isPending ? (
              <LoaderCircle className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
