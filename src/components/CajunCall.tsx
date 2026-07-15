/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../types';
import { Video, VideoOff, Mic, MicOff, MapPin, Sparkles, AlertTriangle, Phone, PhoneOff, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CajunCallProps {
  profile: UserProfile;
}

const CALL_CHANNELS = [
  { id: 'fquarter-lounge', name: 'Bourbon St. Lounge 🎺', desc: 'Jazz music lovers, festival discussions, and late-night calls.' },
  { id: 'bayou-shack', name: 'Bayou Fishing Cabin 🎣', desc: 'Boating, fishing spots, duck hunting, and outdoor crawfish boils.' },
  { id: 'mardi-gras-revelry', name: 'Mardi Gras Parade Float 🎭', desc: 'Carnival vibes, float building, bead-throwing strategy, and king cakes.' }
];

const FILTERS = [
  { id: 'none', name: 'No Filter 📷', class: '' },
  { id: 'mardi-gras', name: 'Mardi Gras Beads 🟣🟡🟢', borderClass: 'border-purple-500 animate-pulse', overlayClass: 'bg-gradient-to-t from-purple-900/20 via-yellow-400/5 to-emerald-500/10' },
  { id: 'swamp-gator', name: 'Swamp Gator Mouth 🐊', borderClass: 'border-green-500', overlayClass: 'bg-gradient-to-r from-emerald-950/20 to-green-950/20 border-8 border-dashed border-emerald-800/60' },
  { id: 'french-quarter', name: 'Bourbon Neon Glow 💡', borderClass: 'border-fuchsia-500 animate-neon', overlayClass: 'bg-gradient-to-b from-fuchsia-500/10 via-purple-500/5 to-slate-900/40' },
  { id: 'bayou-fog', name: 'Mysterious Bayou Fog 🌫️', borderClass: 'border-slate-400', overlayClass: 'bg-gradient-to-b from-slate-500/10 via-slate-700/5 to-slate-950/50 grayscale opacity-90' }
];

const CAJUN_BUDDIES = [
  { id: 'pierre', name: 'Uncle Pierre 🎣', parish: 'St. Martin', role: 'Swamp Tour Guide', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-man-fishing-in-a-lake-at-sunset-42232-large.mp4', dialogue: ['Chère! Welcome to the Bayou!', 'Got some boudin steaming right now!', 'Did you hear that owl hooting in the cypress trees?', 'C\'est si bon! Let\'s keep the good times rolling!'] },
  { id: 'claudette', name: 'Claudette Creole 🍲', parish: 'Orleans', role: 'Chef & Baker', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-woman-pouring-powder-into-a-bowl-in-the-kitchen-42095-large.mp4', dialogue: ['Mais la! You look like you need a bowl of gumbo!', 'Mardi Gras is around the corner, got my king cakes rising.', 'Suck the heads and pinch the tails, that is the Cajun secret!', 'Enjoy Frenchmen Street tonight, hear some sweet brass bands!'] }
];

export default function CajunCall({ profile }: CajunCallProps) {
  const [activeChannelId, setActiveChannelId] = useState(CALL_CHANNELS[0].id);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState(FILTERS[0]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Simulated Buddy Call state
  const [activeCallBuddy, setActiveCallBuddy] = useState<any | null>(null);
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [callConnected, setCallConnected] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const buddyVideoRef = useRef<HTMLVideoElement | null>(null);
  const dialogueTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    startLocalVideo();
    return () => {
      stopLocalVideo();
    };
  }, []);

  const startLocalVideo = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 400, height: 400, facingMode: 'user' },
        audio: true
      });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Webcam access error:', err);
      setErrorMsg('Webcam and audio elements could not be established. Falling back to Louisiana avatar camera streams!');
    }
  };

  const stopLocalVideo = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    if (dialogueTimerRef.current) clearInterval(dialogueTimerRef.current);
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoEnabled;
        setVideoEnabled(!videoEnabled);
      }
    } else {
      setVideoEnabled(!videoEnabled);
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioEnabled;
        setAudioEnabled(!audioEnabled);
      }
    } else {
      setAudioEnabled(!audioEnabled);
    }
  };

  const handleStartBuddyCall = (buddy: any) => {
    setActiveCallBuddy(buddy);
    setCallConnected(true);
    setDialogueIndex(0);

    if (dialogueTimerRef.current) clearInterval(dialogueTimerRef.current);
    dialogueTimerRef.current = setInterval(() => {
      setDialogueIndex((prev) => (prev + 1) % buddy.dialogue.length);
    }, 6000);
  };

  const handleEndCall = () => {
    if (dialogueTimerRef.current) clearInterval(dialogueTimerRef.current);
    setCallConnected(false);
    setActiveCallBuddy(null);
  };

  const channel = CALL_CHANNELS.find((c) => c.id === activeChannelId) || CALL_CHANNELS[0];

  return (
    <div id="cajun-call-layout" className="space-y-6 max-w-5xl mx-auto">
      
      {/* Channels Selector */}
      <div className="bg-[#3B1270]/90 border border-white/10 rounded-2xl p-4 shadow-xl">
        <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">
          Select Video Call Channels
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {CALL_CHANNELS.map((ch) => (
            <button
              key={ch.id}
              onClick={() => {
                setActiveChannelId(ch.id);
                handleEndCall(); // Reset active call
              }}
              className={`text-left p-3.5 rounded-xl border transition-all ${
                activeChannelId === ch.id
                  ? 'bg-purple-900/60 border-yellow-400 text-yellow-400 shadow-md'
                  : 'bg-[#1E0B3B]/60 border-white/5 text-white/60 hover:border-white/10 hover:text-white'
              }`}
            >
              <h4 className="font-display font-bold text-xs">{ch.name}</h4>
              <p className="text-[10px] text-white/40 mt-1 line-clamp-1">{ch.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Local Stream Window */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#3B1270]/90 border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative flex flex-col h-[480px]">
            {/* Local Feed Stage */}
            <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
              
              {/* Actual Camera Stream */}
              {localStream && videoEnabled ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
              ) : (
                <div className="text-center space-y-2 select-none">
                  <div
                    style={{ backgroundColor: profile.avatarColor }}
                    className="h-20 w-20 rounded-full flex items-center justify-center text-purple-950 font-bold text-3xl mx-auto shadow-lg"
                  >
                    🐊
                  </div>
                  <h4 className="font-display font-bold text-sm text-white">
                    {profile.username}
                  </h4>
                  <p className="text-xs text-white/40 font-mono">
                    CAMERA MUTED / INACTIVE
                  </p>
                </div>
              )}

              {/* Dynamic Overlay Filter */}
              {videoEnabled && selectedFilter.id !== 'none' && (
                <div className={`absolute inset-0 border-4 pointer-events-none transition-all ${selectedFilter.borderClass} ${selectedFilter.overlayClass}`}>
                  {selectedFilter.id === 'mardi-gras' && (
                    <div className="absolute inset-0 flex flex-col justify-between p-4 opacity-75 font-display text-white text-xs font-bold pointer-events-none uppercase tracking-wider">
                      <div className="flex justify-between">
                        <span>💜 Green, Gold & Purple</span>
                        <span>Laissez les Bons Temps Rouler!</span>
                      </div>
                      <div className="flex justify-between">
                        <span>🎭 Beads Catching Active</span>
                        <span>⚜️ New Orleans, LA</span>
                      </div>
                    </div>
                  )}

                  {selectedFilter.id === 'swamp-gator' && (
                    <div className="absolute inset-x-0 bottom-4 text-center">
                      <span className="bg-emerald-950/90 border border-emerald-500 text-green-300 font-mono text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest animate-pulse">
                        ⚠️ DEEP SWAMP GATOR WARNING active
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Tag overlay */}
              <div className="absolute top-4 left-4 bg-[#1E0B3B]/80 border border-white/10 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider text-yellow-400 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {profile.parish} (You)
              </div>
            </div>

            {/* Local Feed Toolbar Controls */}
            <div className="bg-white/5 p-4 border-t border-white/10 flex justify-between items-center shrink-0">
              {/* Media Toggles */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleVideo}
                  className={`p-2.5 rounded-lg border transition-colors ${
                    videoEnabled
                      ? 'bg-[#1E0B3B] border-white/10 text-white/70 hover:text-white'
                      : 'bg-red-950/30 border-red-500 text-red-400'
                  }`}
                  title={videoEnabled ? 'Mute Camera' : 'Unmute Camera'}
                >
                  {videoEnabled ? <Video className="h-4.5 w-4.5" /> : <VideoOff className="h-4.5 w-4.5" />}
                </button>

                <button
                  onClick={toggleAudio}
                  className={`p-2.5 rounded-lg border transition-colors ${
                    audioEnabled
                      ? 'bg-[#1E0B3B] border-white/10 text-white/70 hover:text-white'
                      : 'bg-red-950/30 border-red-500 text-red-400'
                  }`}
                  title={audioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
                >
                  {audioEnabled ? <Mic className="h-4.5 w-4.5" /> : <MicOff className="h-4.5 w-4.5" />}
                </button>
              </div>

              {/* Filters selector dropdown */}
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-yellow-400 animate-pulse" />
                <select
                  id="filter-select"
                  value={selectedFilter.id}
                  onChange={(e) => {
                    const found = FILTERS.find((f) => f.id === e.target.value);
                    if (found) setSelectedFilter(found);
                  }}
                  className="bg-[#1E0B3B] border border-white/10 text-white rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-yellow-400"
                >
                  {FILTERS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Remote Call Lobbies & Buddies list */}
        <div className="lg:col-span-1 space-y-4">
          
          {/* Active Call Status */}
          <div className="bg-[#3B1270]/90 border border-white/10 rounded-2xl p-4 flex flex-col h-[480px]">
            {!callConnected ? (
              <div className="flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
                    <Phone className="h-4 w-4 text-yellow-400 animate-pulse" />
                    Locals Online
                  </h3>
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    Connect instantly with parish locals inside the <span className="text-yellow-400 font-bold">{channel.name}</span> channel. Select a Cajun Buddy below to initiate a live simulation call!
                  </p>

                  <div className="space-y-2 pt-2">
                    {CAJUN_BUDDIES.map((buddy) => (
                      <div
                        key={buddy.id}
                        className="bg-[#1E0B3B] border border-white/10 rounded-xl p-3 flex items-center justify-between hover:border-yellow-400/50 transition-all"
                      >
                        <div>
                          <h4 className="font-display font-bold text-xs text-white">
                            {buddy.name}
                          </h4>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="h-1.5 w-1.5 bg-green-500 rounded-full animate-ping" />
                            <span className="text-[10px] text-white/50 font-mono">
                              {buddy.role} ({buddy.parish} Parish)
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleStartBuddyCall(buddy)}
                          className="bg-yellow-400 hover:bg-yellow-300 text-purple-950 p-2 rounded-lg font-bold transition-colors shadow shadow-yellow-400/10"
                          title="Call"
                        >
                          <Phone className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#1E0B3B]/60 p-3 rounded-xl border border-white/5 text-[10px] text-white/50 leading-relaxed">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 float-left mr-2" />
                  Your video filter will be projected and visible on the call. Be creative and let the good times roll!
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between h-full overflow-hidden">
                <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-display font-bold text-xs text-white">
                        📞 Active Call: {activeCallBuddy.name}
                      </h4>
                      <span className="text-[10px] text-yellow-400 font-mono tracking-widest font-bold">
                        CALL CONNECTED (SECURE)
                      </span>
                    </div>

                    <button
                      onClick={handleEndCall}
                      className="bg-red-600 hover:bg-red-500 text-white p-2 rounded-lg transition-colors"
                    >
                      <PhoneOff className="h-4.5 w-4.5" />
                    </button>
                  </div>

                  {/* Remote video viewer */}
                  <div className="bg-black rounded-xl aspect-video overflow-hidden relative flex-1 flex items-center justify-center">
                    <video
                      ref={buddyVideoRef}
                      src={activeCallBuddy.videoUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />

                    {/* Badge */}
                    <div className="absolute top-2.5 left-2.5 bg-[#1E0B3B]/90 px-2 py-0.5 rounded border border-white/10 text-[9px] font-mono text-white/80">
                      👤 {activeCallBuddy.name} ({activeCallBuddy.parish} Parish)
                    </div>
                  </div>

                  {/* Subtitles / Speech dialogue */}
                  <div className="bg-[#1E0B3B] border border-white/10 p-3.5 rounded-xl text-center flex flex-col justify-center shrink-0 min-h-24">
                    <span className="text-[9px] text-yellow-400 font-mono font-bold uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
                      <Award className="h-3 w-3" /> Uncle Pierre says:
                    </span>
                    <p className="text-xs text-white/90 leading-relaxed font-sans italic">
                      "{activeCallBuddy.dialogue[dialogueIndex]}"
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleEndCall}
                  className="w-full bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-xl text-xs font-bold tracking-wider mt-4"
                >
                  Disconnect From Call
                </button>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
