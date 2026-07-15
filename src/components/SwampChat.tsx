/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, ChatMessage } from '../types';
import { Send, Hash, Flame, Users, Sparkles, MessageSquare, ToggleLeft, ToggleRight, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, limit, onSnapshot, setDoc, doc, serverTimestamp } from 'firebase/firestore';


interface SwampChatProps {
  profile: UserProfile;
}

const CHAT_ROOMS = [
  { id: 'nola', name: 'NOLA Hub 🎷', desc: 'Jazz clubs, Frenchmen street talks, parade plans, and beignet recipes.', category: 'South LA' },
  { id: 'cajun-country', name: 'Acadiana / Cajun Country 🍲', desc: 'Crawfish boils, boudin critiques, Zydeco events, and French heritage.', category: 'Cajun Culture' },
  { id: 'capital-corridor', name: 'Capital City (BR) 🐯', desc: 'LSU sports, Baton Rouge news, local politics, and college hangouts.', category: 'Central LA' },
  { id: 'shreveport-redriver', name: 'Red River Basin (Shreveport) 🎰', desc: 'Casino reviews, North LA events, Ark-La-Tex culture, and sports chat.', category: 'North LA' },
  { id: 'deep-bayou', name: 'Deep Bayou & Swamp Whispers 🐊', desc: 'Gator sightings, delta fishing hotspots, swamp tour secrets, and local legends.', category: 'Wild Wetlands' }
];

export default function SwampChat({ profile }: SwampChatProps) {
  const [activeRoomId, setActiveRoomId] = useState(CHAT_ROOMS[0].id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isAnonMode, setIsAnonMode] = useState(false);
  const [presenceUsers, setPresenceUsers] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Derive WebSocket URL from window location and sync message subscription to Firestore
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [activeRoomId]);

  useEffect(() => {
    const q = query(
      collection(db, 'messages'),
      where('roomId', '==', activeRoomId),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        msgs.push({
          id: docSnapshot.id,
          roomId: data.roomId,
          userId: data.userId,
          username: data.username,
          parish: data.parish,
          userType: data.userType,
          avatarColor: data.avatarColor,
          content: data.content,
          timestamp: data.timestamp?.toMillis ? data.timestamp.toMillis() : (data.timestamp || Date.now()),
          isAnonymous: data.isAnonymous,
          anonTotem: data.anonTotem,
          mediaUrl: data.mediaUrl
        });
      });
      setMessages(msgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });

    return () => unsubscribe();
  }, [activeRoomId]);

  const connectWebSocket = () => {
    setConnectionStatus('connecting');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    console.log('Connecting to WebSocket at:', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      // Join room immediately on connect
      ws.send(JSON.stringify({
        type: 'join',
        payload: {
          roomId: activeRoomId,
          userId: profile.id,
          username: profile.username,
          parish: profile.parish,
          anonTotem: profile.anonTotem
        }
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'presence-update': {
            setPresenceUsers(data.payload);
            break;
          }
          case 'typing': {
            const { username, isTyping, userId } = data.payload;
            if (userId === profile.id) return; // Ignore self
            setTypingUsers((prev) => ({
              ...prev,
              [username]: isTyping
            }));
            break;
          }
        }
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
      // Attempt reconnection after 3 seconds
      setTimeout(() => {
        if (wsRef.current === ws) {
          connectWebSocket();
        }
      }, 3000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      ws.close();
    };
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Handle typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Send typing status
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        payload: {
          roomId: activeRoomId,
          username: isAnonMode ? profile.anonTotem : profile.username,
          isTyping: true
        }
      }));

      // Debounce clearance
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'typing',
            payload: {
              roomId: activeRoomId,
              username: isAnonMode ? profile.anonTotem : profile.username,
              isTyping: false
            }
          }));
        }
      }, 2000);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const msgContent = inputText.trim();
    setInputText('');

    try {
      const msgId = 'msg_' + Math.random().toString(36).substring(2, 9);
      await setDoc(doc(db, 'messages', msgId), {
        id: msgId,
        roomId: activeRoomId,
        userId: profile.id,
        username: profile.username,
        parish: profile.parish,
        userType: profile.userType,
        avatarColor: profile.avatarColor,
        content: msgContent,
        timestamp: serverTimestamp(),
        isAnonymous: isAnonMode,
        anonTotem: profile.anonTotem
      });

      // Send non-typing immediately to WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        wsRef.current.send(JSON.stringify({
          type: 'typing',
          payload: {
            roomId: activeRoomId,
            username: isAnonMode ? profile.anonTotem : profile.username,
            isTyping: false
          }
        }));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'messages/' + activeRoomId);
    }
  };

  const activeRoom = CHAT_ROOMS.find((r) => r.id === activeRoomId) || CHAT_ROOMS[0];
  const typingList = Object.entries(typingUsers)
    .filter(([_, isTyping]) => isTyping)
    .map(([username]) => username);

  return (
    <div id="swamp-chat-layout" className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-12rem)] min-h-[500px]">
      
      {/* Side panels (Rooms & Active Users) */}
      <div className="lg:col-span-1 space-y-4 flex flex-col h-full overflow-hidden">
        {/* Room List */}
        <div className="bg-[#3B1270]/90 border border-white/10 rounded-xl p-4 flex flex-col flex-1 overflow-hidden shadow-xl">
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3 flex items-center gap-1">
            <Radio className="h-4 w-4 text-yellow-400 animate-pulse" />
            Regional Channels
          </h3>
          <div className="space-y-1.5 overflow-y-auto flex-1 pr-1">
            {CHAT_ROOMS.map((room) => {
              const isActive = activeRoomId === room.id;
              return (
                <button
                  key={room.id}
                  onClick={() => setActiveRoomId(room.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all flex flex-col gap-1 ${
                    isActive
                      ? 'bg-yellow-400 border-yellow-400 text-purple-950 shadow-md'
                      : 'bg-white/5 border-white/5 text-white/60 hover:border-white/10 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold text-xs flex items-center gap-1.5">
                      <Hash className={`h-3.5 w-3.5 ${isActive ? 'opacity-90' : 'opacity-60'}`} />
                      {room.name}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                      isActive 
                        ? 'text-yellow-400 bg-purple-950 border-purple-900' 
                        : 'text-white/50 bg-white/5 border-white/10'
                    }`}>
                      {room.category}
                    </span>
                  </div>
                  <p className={`text-[10px] leading-relaxed line-clamp-2 ${isActive ? 'text-purple-950/80' : 'opacity-80'}`}>
                    {room.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Presence / Active Users */}
        <div className="bg-[#3B1270]/90 border border-white/10 rounded-xl p-4 h-48 flex flex-col overflow-hidden shadow-xl">
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-yellow-400" />
              In This Stream
            </span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 font-bold">
              {presenceUsers.length} active
            </span>
          </h3>
          <div className="space-y-2 overflow-y-auto flex-1 pr-1 text-xs">
            {presenceUsers.length === 0 ? (
              <div className="text-white/40 italic py-4 text-center text-[11px]">
                No locals connected yet...
              </div>
            ) : (
              presenceUsers.map((user, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white/5 border border-white/5 px-2.5 py-1.5 rounded-lg">
                  <span className="font-mono text-white truncate max-w-[120px] font-medium">
                    🐊 {user.username}
                  </span>
                  <span className="text-[10px] text-white/50">
                    {user.parish} Parish
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Primary Chat Box */}
      <div className="lg:col-span-3 bg-[#5B21B6]/90 border border-white/10 rounded-xl flex flex-col h-full overflow-hidden shadow-2xl">
        {/* Chat Header */}
        <div className="bg-white/5 border-b border-white/10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-400/10 p-2 rounded-lg border border-yellow-400/20">
              <MessageSquare className="h-5 w-5 text-yellow-400 animate-pulse" />
            </div>
            <div>
              <h2 className="font-display font-bold text-sm text-white flex items-center gap-1.5">
                {activeRoom.name}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`h-2 w-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-emerald-400 animate-ping' : 
                  connectionStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-500'
                }`} />
                <span className="text-[10px] text-white/50 font-mono tracking-wide">
                  {connectionStatus === 'connected' ? 'STREAM ESTABLISHED' :
                   connectionStatus === 'connecting' ? 'TUNING Bayou FREQUENCY...' : 'STREAM SEVERED - RECONNECTING'}
                </span>
              </div>
            </div>
          </div>

          {/* Toggle Anonymous */}
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
            <span className={`text-[10px] font-bold font-mono ${isAnonMode ? 'text-yellow-400' : 'text-white/40'}`}>
              🎭 GHOST MODE
            </span>
            <button
              onClick={() => setIsAnonMode(!isAnonMode)}
              className="focus:outline-none transition-transform active:scale-95"
            >
              {isAnonMode ? (
                <ToggleRight className="h-6 w-6 text-yellow-400" />
              ) : (
                <ToggleLeft className="h-6 w-6 text-white/20" />
              )}
            </button>
          </div>
        </div>

        {/* Message Panel */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/10">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 mb-2 text-xs text-white/70 leading-relaxed max-w-xl mx-auto text-center">
            <span className="font-bold text-yellow-400">💡 Local Notice:</span> {activeRoom.desc} You are sending messages as{' '}
            <span className="font-bold font-mono text-purple-900 bg-yellow-400 px-2 py-0.5 rounded">
              {isAnonMode ? `🎭 ${profile.anonTotem}` : `🐊 ${profile.username}`}
            </span>.
          </div>

          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isSelf = msg.userId === profile.id;
              
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isSelf ? 'justify-end' : 'justify-start'} items-end gap-2.5`}
                >
                  {/* Sender Avatar (Only if not self) */}
                  {!isSelf && (
                    <div
                      style={{ backgroundColor: msg.isAnonymous ? '#059669' : msg.avatarColor }}
                      className="h-8 w-8 rounded-full flex items-center justify-center text-slate-950 font-bold text-xs shadow border border-white/10"
                    >
                      {msg.isAnonymous ? '🎭' : (msg.username ? msg.username[0].toUpperCase() : '🐊')}
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div className={`max-w-[70%] px-4 py-2.5 text-xs ${
                    isSelf 
                      ? 'bg-yellow-400 text-purple-950 chat-bubble-self shadow-lg shadow-yellow-400/10 rounded-br-none font-medium'
                      : msg.isAnonymous
                        ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-500/30 chat-bubble-other rounded-bl-none'
                        : 'bg-white/10 text-white border border-white/10 chat-bubble-other rounded-bl-none'
                  }`}>
                    {/* Username/Meta */}
                    {!isSelf && (
                      <div className="flex items-center gap-1.5 mb-1 text-[10px] opacity-80 font-semibold">
                        <span className={msg.isAnonymous ? 'text-emerald-300 font-mono' : 'text-yellow-400'}>
                          {msg.isAnonymous ? msg.anonTotem : msg.username}
                        </span>
                        <span className="text-white/40 font-normal">
                          ({msg.parish} Parish)
                        </span>
                        {!msg.isAnonymous && (
                          <span className="bg-white/10 text-white/70 px-1 rounded text-[9px] font-normal border border-white/5">
                            {msg.userType}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {isSelf && msg.isAnonymous && (
                      <div className="text-[9px] text-purple-950 font-bold uppercase tracking-wider mb-1 opacity-70">
                        🎭 Sent Anonymously ({msg.anonTotem})
                      </div>
                    )}

                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    
                    {/* Timestamp */}
                    <div className={`text-[9px] text-right mt-1.5 opacity-60 font-mono ${isSelf ? 'text-purple-950/75' : 'text-white/40'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Typing indicator */}
          {typingList.length > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-white/50 font-mono italic pl-2">
              <span className="h-1.5 w-1.5 bg-yellow-400 rounded-full animate-bounce" />
              <span>{typingList.join(', ')} {typingList.length === 1 ? 'is' : 'are'} stirring the gumbo pot (typing)...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Panel */}
        <form onSubmit={handleSendMessage} className="p-3 bg-white/5 border-t border-white/10 flex gap-2">
          <input
            id="chat-message-input"
            type="text"
            placeholder={isAnonMode ? "Whisper anonymously to the bayou..." : "Stir the pot! Say something..."}
            value={inputText}
            onChange={handleInputChange}
            maxLength={350}
            className="flex-1 bg-white/10 text-white placeholder-white/30 border border-white/10 rounded-lg px-4 py-2.5 text-xs focus:outline-none focus:border-yellow-400 transition-colors"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            disabled={!inputText.trim()}
            className="bg-yellow-400 text-purple-950 p-2.5 rounded-lg font-bold disabled:opacity-40 disabled:hover:scale-100 transition-all flex items-center justify-center shadow-lg shadow-yellow-400/20"
          >
            <Send className="h-4 w-4" />
          </motion.button>
        </form>
      </div>

    </div>
  );
}
