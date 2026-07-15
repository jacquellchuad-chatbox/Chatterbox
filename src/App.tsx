/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UserProfile } from './types';
import ProfileSelector from './components/ProfileSelector';
import SwampChat from './components/SwampChat';
import BayouBuzz from './components/BayouBuzz';
import CajunClips from './components/CajunClips';
import CajunCall from './components/CajunCall';
import { MessageSquare, Flame, Film, Phone, LogOut, Radio, Music, Volume2 } from 'lucide-react';
import { motion } from 'motion/react';
import { auth, testConnection } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';


// Web Audio API Soundboard Synth (100% client side!)
function playSwampSound(type: 'bullfrog' | 'gator-hiss' | 'trumpet' | 'washboard') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'bullfrog') {
      // Deep low croak
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.5);

      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

      // Lowpass filter for mud
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, ctx.currentTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } else if (type === 'gator-hiss') {
      // Hiss noise
      const bufferSize = ctx.sampleRate * 0.8;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 4000;
      filter.Q.value = 1.0;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
      noise.stop(ctx.currentTime + 0.8);
    } else if (type === 'trumpet') {
      // Mardi Gras Brass
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(349.23, ctx.currentTime); // F4
      osc1.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.4); // A4

      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(351.23, ctx.currentTime); // Detuned
      osc2.frequency.exponentialRampToValueAtTime(442, ctx.currentTime + 0.4);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, ctx.currentTime);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.7);
      osc2.stop(ctx.currentTime + 0.7);
    } else if (type === 'washboard') {
      // Rapid scrapes
      const bufferSize = ctx.sampleRate * 0.1;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 8000;

      for (let j = 0; j < 3; j++) {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.15, ctx.currentTime + j * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + j * 0.08 + 0.06);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        source.start(ctx.currentTime + j * 0.08);
        source.stop(ctx.currentTime + j * 0.08 + 0.06);
      }
    }
  } catch (err) {
    console.error('AudioContext synth error:', err);
  }
}

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'buzz' | 'clips' | 'call'>('chat');

  // Load profile from local storage if exists and verify auth connection
  useEffect(() => {
    testConnection();

    const saved = localStorage.getItem('louisiana_chatbox_profile');
    if (saved) {
      try {
        setProfile(JSON.parse(saved));
      } catch (err) {
        console.error('Stale profile in localStorage', err);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setProfile(null);
        localStorage.removeItem('louisiana_chatbox_profile');
      }
    });

    return () => unsubscribe();
  }, []);

  const handleProfileSaved = (newProfile: UserProfile) => {
    setProfile(newProfile);
    localStorage.setItem('louisiana_chatbox_profile', JSON.stringify(newProfile));
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Error signing out of Firebase:', err);
    }
    localStorage.removeItem('louisiana_chatbox_profile');
    setProfile(null);
  };


  return (
    <div className="min-h-screen bg-[#4C1D95] bg-gradient-to-br from-[#4C1D95] via-[#3B1270] to-[#230847] text-white flex flex-col font-sans selection:bg-yellow-400 selection:text-purple-950">
      
      {/* Decorative Mossy Header banner */}
      <div className="h-1 bg-gradient-to-r from-purple-500 via-green-500 to-amber-500 shrink-0" />

      {/* Main Container */}
      <div className="flex-1 flex flex-col max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Top Navbar */}
        <header className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-[#3B1270] border border-white/10 p-4 rounded-2xl backdrop-blur-md shadow-xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-400 flex items-center justify-center text-purple-900 font-bold text-2xl shadow-lg shadow-yellow-400/20">
              ⚜️
            </div>
            <div>
              <h1 className="font-display font-black text-lg text-white tracking-tight leading-none animate-glow flex items-center gap-1.5">
                LOUISIANA CHATBOX
              </h1>
              <p className="text-[10px] text-white/40 font-mono tracking-wider mt-1">
                BAYOU STREAM BROADCAST SERVICE • EST. 2026
              </p>
            </div>
          </div>

          {/* User Status Badge */}
          {profile && (
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 py-1.5 pl-3 pr-2.5 rounded-full select-none">
              <div className="flex items-center gap-2">
                <span
                  style={{ backgroundColor: profile.avatarColor }}
                  className="h-2 w-2 rounded-full shadow"
                />
                <span className="text-xs font-mono font-medium text-white">
                  🐊 {profile.username}
                </span>
                <span className="text-[10px] text-white/40">
                  ({profile.parish} Parish)
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="text-white/40 hover:text-red-400 p-1 rounded-full transition-colors border border-transparent hover:border-red-500/20"
                title="Change Persona"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </header>

        {/* Dynamic Main Body Stage */}
        <main className="flex-1">
          {!profile ? (
            <div className="py-12">
              <ProfileSelector onProfileSaved={handleProfileSaved} currentProfile={profile} />
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Feature Tabs Navigation */}
              <div className="bg-[#3B1270]/80 border border-white/10 p-1.5 rounded-xl grid grid-cols-4 gap-1 max-w-2xl mx-auto shrink-0 select-none shadow-md">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`py-2.5 rounded-lg flex flex-col sm:flex-row items-center justify-center gap-1.5 text-xs font-bold transition-all ${
                    activeTab === 'chat'
                      ? 'bg-yellow-400 text-purple-950 shadow-lg shadow-yellow-400/20'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <MessageSquare className="h-4.5 w-4.5" />
                  <span className="hidden sm:inline">Swamp Chat</span>
                </button>

                <button
                  onClick={() => setActiveTab('buzz')}
                  className={`py-2.5 rounded-lg flex flex-col sm:flex-row items-center justify-center gap-1.5 text-xs font-bold transition-all ${
                    activeTab === 'buzz'
                      ? 'bg-yellow-400 text-purple-950 shadow-lg shadow-yellow-400/20'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Flame className="h-4.5 w-4.5" />
                  <span className="hidden sm:inline">Bayou Buzz</span>
                </button>

                <button
                  onClick={() => setActiveTab('clips')}
                  className={`py-2.5 rounded-lg flex flex-col sm:flex-row items-center justify-center gap-1.5 text-xs font-bold transition-all ${
                    activeTab === 'clips'
                      ? 'bg-yellow-400 text-purple-950 shadow-lg shadow-yellow-400/20'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Film className="h-4.5 w-4.5" />
                  <span className="hidden sm:inline">Cajun Clips</span>
                </button>

                <button
                  onClick={() => setActiveTab('call')}
                  className={`py-2.5 rounded-lg flex flex-col sm:flex-row items-center justify-center gap-1.5 text-xs font-bold transition-all ${
                    activeTab === 'call'
                      ? 'bg-yellow-400 text-purple-950 shadow-lg shadow-yellow-400/20'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Phone className="h-4.5 w-4.5" />
                  <span className="hidden sm:inline">Cajun Call</span>
                </button>
              </div>

              {/* Core Active Workspace View */}
              <div className="min-h-[460px]">
                {activeTab === 'chat' && <SwampChat profile={profile} />}
                {activeTab === 'buzz' && <BayouBuzz profile={profile} />}
                {activeTab === 'clips' && <CajunClips profile={profile} />}
                {activeTab === 'call' && <CajunCall profile={profile} />}
              </div>

            </div>
          )}
        </main>

        {/* Louisiana Swamp Soundboard (Awesome easter egg!) */}
        <footer className="bg-[#3B1270]/80 border border-white/10 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 shadow-lg text-xs">
          <div className="flex items-center gap-2.5 text-white/70">
            <Volume2 className="h-4 w-4 text-yellow-400" />
            <span className="font-semibold">Swamp Soundboard:</span>
            <span className="text-[11px] text-white/40 font-mono hidden md:inline">Click buttons to trigger real-time synthesized SFX</span>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => playSwampSound('bullfrog')}
              className="flex-1 sm:flex-initial bg-white/5 hover:bg-white/10 border border-white/10 hover:border-yellow-400 text-white px-3 py-1.5 rounded-lg transition-colors font-mono text-[10px] flex items-center justify-center gap-1.5"
            >
              🐸 Bullfrog
            </button>
            <button
              onClick={() => playSwampSound('gator-hiss')}
              className="flex-1 sm:flex-initial bg-white/5 hover:bg-white/10 border border-white/10 hover:border-yellow-400 text-white px-3 py-1.5 rounded-lg transition-colors font-mono text-[10px] flex items-center justify-center gap-1.5"
            >
              🐊 Gator Hiss
            </button>
            <button
              onClick={() => playSwampSound('trumpet')}
              className="flex-1 sm:flex-initial bg-white/5 hover:bg-white/10 border border-white/10 hover:border-yellow-400 text-white px-3 py-1.5 rounded-lg transition-colors font-mono text-[10px] flex items-center justify-center gap-1.5"
            >
              🎷 Brass Horn
            </button>
            <button
              onClick={() => playSwampSound('washboard')}
              className="flex-1 sm:flex-initial bg-white/5 hover:bg-white/10 border border-white/10 hover:border-yellow-400 text-white px-3 py-1.5 rounded-lg transition-colors font-mono text-[10px] flex items-center justify-center gap-1.5"
            >
              🧺 Washboard
            </button>
          </div>
        </footer>

      </div>
    </div>
  );
}
