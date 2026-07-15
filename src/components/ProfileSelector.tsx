/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { MapPin, User, ShieldAlert, Sparkles, LogIn } from 'lucide-react';
import { motion } from 'motion/react';
import { auth, googleProvider } from '../firebase';
import { onAuthStateChanged, signInWithPopup } from 'firebase/auth';


interface ProfileSelectorProps {
  onProfileSaved: (profile: UserProfile) => void;
  currentProfile: UserProfile | null;
}

export const PARISHES = [
  { name: 'Orleans', desc: 'New Orleans - Frenchmen Jazz, Beignets, & Mardi Gras' },
  { name: 'Lafayette', desc: 'Cajun Country - Crawfish boils, Zydeco, & Boudin' },
  { name: 'East Baton Rouge', desc: 'Capital Hub - Tiger Stadium, LSU, & Red Stick history' },
  { name: 'Jefferson', desc: 'Metairie, Kenner & Bayou Segnette State Park' },
  { name: 'St. Tammany', desc: 'Northshore - Piney woods, Abita Springs, & Lake Pontchartrain' },
  { name: 'Caddo', desc: 'Shreveport - Red River boardwalks & Ark-La-Tex vibes' },
  { name: 'Calcasieu', desc: 'Lake Charles - Casinos, Contraband Bayou, & Southwest marsh' },
  { name: 'Houma/Terrebonne', desc: 'Deep Bayou - Shrimp boats, delta marshes, & coastal fishing' },
  { name: 'St. Martin', desc: 'Breaux Bridge - Crawfish Capital of the World & Atchafalaya swamp' },
  { name: 'Iberia', desc: 'Avery Island - Tabasco sauce birthplace & Jungle Gardens' }
];

export const USER_TYPES = [
  'Cajun Native 🐊',
  'Creole Chef 🍲',
  'Jazz Fanatic 🎷',
  'Swamp Guide 🛶',
  'Bayou Resident 🏡',
  'Louisiana Explorer 🗺️'
];

export const AVATAR_COLORS = [
  { name: 'Neon Green', value: '#39FF14' },
  { name: 'Mardi Gras Purple', value: '#9D00FF' },
  { name: 'Bourbon Gold', value: '#FFD700' },
  { name: 'Hot Pink', value: '#FF007F' },
  { name: 'Electric Cyan', value: '#00E5FF' },
  { name: 'Cayenne Red', value: '#FF3F3F' }
];

const TOTEM_ADJECTIVES = [
  'Spicy', 'Zydeco', 'Crawfish', 'Boudin', 'Muddy', 'Sazerac', 'Beignet', 'Swampy', 'Bayou', 
  'MardiGras', 'French Quarter', 'Tabasco', 'Magnolia', 'Atchafalaya', 'Voodoo', 'Creole'
];

const TOTEM_ANIMALS = [
  'Gator', 'Pelican', 'Crawfish', 'Opossum', 'Mosquito', 'Nutria', 'Catfish', 'Owl', 
  'SnappingTurtle', 'Raccoon', 'BlackBear', 'Egret', 'Armadillo', 'Bullfrog'
];

export function generateRandomTotem(): string {
  const adj = TOTEM_ADJECTIVES[Math.floor(Math.random() * TOTEM_ADJECTIVES.length)];
  const animal = TOTEM_ANIMALS[Math.floor(Math.random() * TOTEM_ANIMALS.length)];
  return `${adj} ${animal}`;
}

export default function ProfileSelector({ onProfileSaved, currentProfile }: ProfileSelectorProps) {
  const [firebaseUser, setFirebaseUser] = useState(auth.currentUser);
  const [username, setUsername] = useState(currentProfile?.username || '');
  const [parish, setParish] = useState(currentProfile?.parish || PARISHES[0].name);
  const [userType, setUserType] = useState(currentProfile?.userType || USER_TYPES[0]);
  const [avatarColor, setAvatarColor] = useState(currentProfile?.avatarColor || AVATAR_COLORS[0].value);
  const [anonTotem, setAnonTotem] = useState(currentProfile?.anonTotem || generateRandomTotem());
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (user && !username) {
        setUsername(user.displayName || '');
      }
    });
    return () => unsubscribe();
  }, [username]);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setAuthError(err.message || 'Failed to authenticate with Google. Please try again.');
    }
  };

  const handleRollTotem = () => {
    setAnonTotem(generateRandomTotem());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !firebaseUser) return;

    const savedProfile: UserProfile = {
      id: firebaseUser.uid,
      username: username.trim(),
      parish,
      userType,
      avatarColor,
      anonTotem
    };

    onProfileSaved(savedProfile);
  };

  if (!firebaseUser) {
    return (
      <div id="profile-selector-container" className="max-w-md mx-auto bg-[#3B1270]/90 border border-white/20 rounded-2xl p-8 shadow-2xl backdrop-blur-md text-center">
        <div className="mb-6">
          <div className="w-16 h-16 rounded-2xl bg-yellow-400 flex items-center justify-center text-purple-900 font-bold text-4xl shadow-lg shadow-yellow-400/20 mx-auto mb-4">
            ⚜️
          </div>
          <h2 className="font-display text-2xl font-bold text-white tracking-tight">
            Louisiana Locals Hub
          </h2>
          <p className="text-xs text-white/60 mt-2 font-sans leading-relaxed">
            Welcome to Louisiana Chatbox! To access the swamp chat rooms, post anonymous stories to the Bayou Buzz, and view Cajun Clips, please authenticate using Google.
          </p>
        </div>

        {authError && (
          <div className="bg-red-900/40 border border-red-500/30 rounded-xl p-3 mb-5 text-left">
            <p className="text-[11px] text-red-200 font-mono leading-tight">{authError}</p>
          </div>
        )}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleGoogleSignIn}
          className="w-full bg-yellow-400 hover:bg-yellow-300 text-purple-950 font-bold py-3.5 px-4 rounded-xl text-sm transition-all shadow-lg shadow-yellow-400/20 flex items-center justify-center gap-2"
        >
          <LogIn className="h-4 w-4" />
          Sign In with Google
        </motion.button>
        
        <p className="text-[10px] text-white/40 mt-4 font-mono uppercase tracking-wider">
          Secure Firebase Authentication Active
        </p>
      </div>
    );
  }

  return (
    <div id="profile-selector-container" className="max-w-md mx-auto bg-[#3B1270]/90 border border-white/20 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
      <div className="text-center mb-6">
        <h2 className="font-display text-2xl font-bold text-white tracking-tight flex items-center justify-center gap-2">
          <Sparkles className="h-6 w-6 text-yellow-400 animate-pulse" />
          Louisiana Locals Hub
        </h2>
        <p className="text-xs text-white/60 mt-1 font-sans">
          Define your local identity and register your swamp alias.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Username */}
        <div>
          <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
            Local Nickname / Handle
          </label>
          <div className="relative">
            <span className="absolute left-3 top-3 text-white/40">
              <User className="h-4 w-4" />
            </span>
            <input
              id="profile-username-input"
              type="text"
              required
              maxLength={20}
              placeholder="e.g. CajunDave, BeignetBabe"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#1E0B3B] text-white placeholder-white/30 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-yellow-400 transition-colors"
            />
          </div>
        </div>

        {/* Parish Selection */}
        <div>
          <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
            Select Parish (Location)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-3 text-white/40">
              <MapPin className="h-4 w-4" />
            </span>
            <select
              id="profile-parish-select"
              value={parish}
              onChange={(e) => setParish(e.target.value)}
              className="w-full bg-[#1E0B3B] text-white border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-yellow-400 appearance-none transition-colors animate-none"
            >
              {PARISHES.map((p) => (
                <option key={p.name} value={p.name} className="bg-[#1E0B3B] text-white">
                  {p.name} Parish
                </option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-white/50 mt-1.5 italic">
            {PARISHES.find((p) => p.name === parish)?.desc}
          </p>
        </div>

        {/* User Type */}
        <div>
          <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
            Local Vibe
          </label>
          <div className="grid grid-cols-2 gap-2">
            {USER_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setUserType(type)}
                className={`text-left p-2.5 rounded-lg border text-xs font-medium transition-all ${
                  userType === type
                    ? 'bg-yellow-400 border-yellow-400 text-purple-950 font-bold shadow-sm shadow-yellow-400/20'
                    : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Avatar Color */}
        <div>
          <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
            Signature Neon Aura Color
          </label>
          <div className="flex justify-between items-center bg-[#1E0B3B] p-2 rounded-lg border border-white/10">
            {AVATAR_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                title={color.name}
                onClick={() => setAvatarColor(color.value)}
                style={{ backgroundColor: color.value }}
                className={`h-7 w-7 rounded-full transition-transform ${
                  avatarColor === color.value
                    ? 'ring-2 ring-white scale-110 shadow-lg'
                    : 'opacity-70 hover:opacity-100 hover:scale-105'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Anonymous Totem Generator */}
        <div className="bg-[#1E0B3B] p-4 rounded-lg border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider flex items-center gap-1">
              <ShieldAlert className="h-3.5 w-3.5 text-yellow-400" />
              Your Anonymous Totem
            </span>
            <button
              type="button"
              onClick={handleRollTotem}
              className="text-[11px] text-yellow-400 hover:text-yellow-300 font-bold hover:underline flex items-center gap-1"
            >
              🔄 Roll Random
            </button>
          </div>
          <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded px-3 py-2">
            <span className="font-mono text-sm text-yellow-400 font-bold tracking-wide">
              🎭 {anonTotem}
            </span>
            <span className="text-[10px] text-white/50 bg-white/5 px-2 py-0.5 rounded border border-white/10">
              Anonymous Persona
            </span>
          </div>
          <p className="text-[10px] text-white/40 mt-2">
            Used automatically when posting to the Anonymous Bayou Buzz and chat rooms in Ghost mode.
          </p>
        </div>

        {/* Submit */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          id="profile-save-button"
          type="submit"
          className="w-full bg-yellow-400 hover:bg-yellow-300 text-purple-950 font-bold py-3 px-4 rounded-lg text-sm transition-all shadow-lg shadow-yellow-400/20"
        >
          Enter Louisiana Chatbox
        </motion.button>
      </form>
    </div>
  );
}
