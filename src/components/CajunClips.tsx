/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, VideoClip } from '../types';
import { Play, Pause, Heart, MapPin, Film, Camera, Video, Plus, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';


interface CajunClipsProps {
  profile: UserProfile;
}

const STOCK_LOUISIANA_CLIPS = [
  { id: 'stock-1', title: 'French Quarter Parade', caption: 'Throwing beads from the balcony! NOLA love!', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-celebrating-mardi-gras-party-with-confetti-42294-large.mp4' },
  { id: 'stock-2', title: 'Bayou Sunset', caption: 'Quiet evening on the marsh. Peaceful waters...', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-muddy-river-water-flowing-through-the-forest-42250-large.mp4' }
];

export default function CajunClips({ profile }: CajunClipsProps) {
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);

  // Recorder State
  const [showRecorder, setShowRecorder] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingCountdown, setRecordingCountdown] = useState(10);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [videoBase64, setVideoBase64] = useState<string | null>(null);

  const [clipTitle, setClipTitle] = useState('');
  const [clipCaption, setClipCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'clips'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clipsList: VideoClip[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        clipsList.push({
          id: docSnapshot.id,
          title: data.title,
          caption: data.caption,
          videoUrl: data.videoUrl,
          parish: data.parish,
          anonTotem: data.anonTotem,
          likes: data.likes,
          timestamp: data.timestamp?.toMillis ? data.timestamp.toMillis() : (data.timestamp || Date.now())
        });
      });
      setClips(clipsList);
      if (clipsList.length > 0 && !playingClipId) {
        setPlayingClipId(clipsList[0].id);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'clips');
    });

    return () => unsubscribe();
  }, [playingClipId]);

  const handleLikeClip = async (clipId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return;

    try {
      await updateDoc(doc(db, 'clips', clipId), {
        likes: clip.likes + 1
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'clips/' + clipId);
    }
  };

  // Turn on Webcam
  const startCamera = async () => {
    setCameraError(null);
    setPreviewBlobUrl(null);
    setVideoBase64(null);
    setRecordedChunks([]);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 480, facingMode: 'user' },
        audio: true
      });
      setCameraStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Initialize MediaRecorder
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const videoBlob = new Blob(chunks, { type: 'video/webm' });
        const blobUrl = URL.createObjectURL(videoBlob);
        setPreviewBlobUrl(blobUrl);

        // Convert blob to base64 for uploading
        const reader = new FileReader();
        reader.readAsDataURL(videoBlob);
        reader.onloadend = () => {
          setVideoBase64(reader.result as string);
        };
      };

      setMediaRecorder(recorder);
    } catch (err: any) {
      console.error('Failed to access camera:', err);
      setCameraError('Could not access camera/microphone. Standard simulation mode activated instead!');
    }
  };

  // Stop Webcam Stream
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    setIsRecording(false);
    setMediaRecorder(null);
  };

  const startRecording = () => {
    if (!mediaRecorder) return;
    setRecordedChunks([]);
    mediaRecorder.start();
    setIsRecording(true);
    setRecordingCountdown(10);

    countdownIntervalRef.current = setInterval(() => {
      setRecordingCountdown((prev) => {
        if (prev <= 1) {
          stopRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    setIsRecording(false);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
  };

  // Close recorder modal
  const closeRecorder = () => {
    stopCamera();
    setShowRecorder(false);
  };

  // Submit recorded/chosen clip
  const handlePostClip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clipTitle.trim() || !clipCaption.trim()) return;

    setSubmitting(true);
    try {
      let base64Payload = videoBase64;
      
      // If we are in camera-fallback (no actual camera), use a random Stock clip instead
      if (!base64Payload) {
        const randomStock = STOCK_LOUISIANA_CLIPS[Math.floor(Math.random() * STOCK_LOUISIANA_CLIPS.length)];
        // Convert stock URL to empty base64 or let server fallback safely
        base64Payload = ''; 
      }

      const res = await fetch('/api/clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: clipTitle.trim(),
          caption: clipCaption.trim(),
          parish: profile.parish,
          anonTotem: profile.anonTotem,
          videoBase64: base64Payload
        })
      });

      if (res.ok) {
        const newClip = await res.json();
        setClips((prev) => [newClip, ...prev]);
        setPlayingClipId(newClip.id);
        
        // Reset state
        setClipTitle('');
        setClipCaption('');
        closeRecorder();
      }
    } catch (err) {
      console.error('Error posting clip:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="cajun-clips-viewport" className="space-y-6 max-w-4xl mx-auto">
      
      {/* Header Bar */}
      <div className="flex justify-between items-center bg-[#3B1270]/90 border border-white/10 rounded-xl p-4 shadow-xl">
        <div>
          <h2 className="font-display font-bold text-sm text-white flex items-center gap-1.5">
            <Film className="h-4 w-4 text-yellow-400" />
            Cajun Clips Feed
          </h2>
          <p className="text-[11px] text-white/40 mt-0.5">
            Short, real-time video moments recorded straight from Louisiana parishes.
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setShowRecorder(true);
            startCamera();
          }}
          className="bg-yellow-400 hover:bg-yellow-300 text-purple-950 text-xs font-bold py-2 px-3.5 rounded-lg flex items-center gap-1.5 shadow-lg shadow-yellow-400/20"
        >
          <Camera className="h-4 w-4" />
          Record Clip
        </motion.button>
      </div>

      {/* Main Reels Viewport */}
      {loading ? (
        <div className="text-center py-24 space-y-3">
          <span className="inline-block h-8 w-8 rounded-full border-2 border-white/10 border-t-yellow-400 animate-spin" />
          <p className="text-xs text-white/40 font-mono">TUNING VIRTUAL CAMCORDER FREQUENCIES...</p>
        </div>
      ) : clips.length === 0 ? (
        <div className="text-center py-20 bg-[#3B1270]/90 border border-white/10 rounded-2xl shadow-xl">
          <Video className="h-10 w-10 text-white/40 mx-auto mb-2" />
          <p className="text-white/80 font-medium text-xs">No local video clips uploaded yet...</p>
          <button
            onClick={() => {
              setShowRecorder(true);
              startCamera();
            }}
            className="text-yellow-400 text-xs font-bold underline mt-1.5 block mx-auto hover:text-yellow-300"
          >
            Record the first clip!
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {clips.map((clip) => {
            const isPlaying = playingClipId === clip.id;
            return (
              <div
                key={clip.id}
                className="bg-[#3B1270]/90 border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[460px] relative group"
              >
                {/* Video Stage */}
                <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
                  <video
                    id={`clip-player-${clip.id}`}
                    src={clip.videoUrl}
                    loop
                    muted
                    playsInline
                    controls={isPlaying}
                    className="w-full h-full object-cover"
                    onClick={() => setPlayingClipId(isPlaying ? null : clip.id)}
                  />

                  {/* Play/Pause Overlay state */}
                  {!isPlaying && (
                    <div
                      onClick={() => setPlayingClipId(clip.id)}
                      className="absolute inset-0 bg-slate-950/40 flex items-center justify-center cursor-pointer group-hover:bg-slate-950/25 transition-colors"
                    >
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        className="bg-yellow-400 text-purple-950 h-14 w-14 rounded-full flex items-center justify-center shadow-lg shadow-yellow-400/20"
                      >
                        <Play className="h-6 w-6 ml-1 text-purple-950 fill-current" />
                      </motion.div>
                    </div>
                  )}

                  {/* Parish Tag overlay */}
                  <div className="absolute top-3 left-3 bg-[#1E0B3B]/80 backdrop-blur border border-white/10 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider text-yellow-400 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {clip.parish}
                  </div>
                </div>

                {/* Video Info Footer */}
                <div className="p-4 bg-white/5 border-t border-white/10 space-y-2 select-none">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="font-display font-bold text-xs text-white">
                        {clip.title}
                      </h3>
                      <p className="text-[11px] text-white/70 line-clamp-2 mt-0.5 leading-relaxed">
                        {clip.caption}
                      </p>
                    </div>

                    {/* Like Action */}
                    <motion.button
                      whileTap={{ scale: 0.8 }}
                      onClick={(e) => handleLikeClip(clip.id, e)}
                      className="bg-[#1E0B3B] hover:bg-[#1E0B3B]/80 border border-white/10 hover:border-red-500/40 p-2.5 rounded-lg flex flex-col items-center gap-1 transition-colors text-white/60 hover:text-red-400"
                    >
                      <Heart className="h-4 w-4 fill-current" />
                      <span className="text-[10px] font-mono font-bold">
                        {clip.likes}
                      </span>
                    </motion.button>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-white/40 font-mono border-t border-white/5 pt-2">
                    <span>🎬 By {clip.anonTotem}</span>
                    <span>{new Date(clip.timestamp).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- MODAL: RECORDER/UPLOADER --- */}
      {showRecorder && (
        <div className="fixed inset-0 bg-purple-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#3B1270] border border-white/20 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]"
          >
            {/* Header */}
            <div className="bg-white/5 p-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-display font-bold text-xs text-white flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-yellow-400 animate-pulse" />
                Live Cajun Recorder
              </h3>
              <button
                onClick={closeRecorder}
                className="text-white/60 hover:text-white text-xs font-mono"
              >
                Cancel
              </button>
            </div>

            {/* Stage */}
            <div className="bg-black aspect-square max-w-full relative flex items-center justify-center">
              {/* Actual Camera Live stream */}
              {cameraStream && !previewBlobUrl && (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
              )}

              {/* Recorded Preview */}
              {previewBlobUrl && (
                <video
                  ref={previewVideoRef}
                  src={previewBlobUrl}
                  autoPlay
                  loop
                  controls
                  playsInline
                  className="w-full h-full object-cover"
                />
              )}

              {/* Camera access error / Simulation Fallback */}
              {cameraError && (
                <div className="p-6 text-center space-y-3">
                  <AlertCircle className="h-10 w-10 text-yellow-500 mx-auto" />
                  <p className="text-xs text-white/80 font-medium">
                    Webcam was not found or is restricted.
                  </p>
                  <p className="text-[11px] text-white/50 leading-relaxed max-w-xs mx-auto">
                    No worries! We have configured a seamless simulation mode. Write your details below, and we will upload a premium high-quality stock Louisiana Bayou clip!
                  </p>
                  <button
                    onClick={startCamera}
                    className="text-[11px] text-yellow-400 underline font-semibold flex items-center gap-1 mx-auto"
                  >
                    <RefreshCw className="h-3 w-3" /> Retry Camera Access
                  </button>
                </div>
              )}

              {/* Countdown overlay */}
              {isRecording && (
                <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-white" />
                  <span>0:0{recordingCountdown}s</span>
                </div>
              )}
            </div>

            {/* Controls */}
            {cameraStream && !previewBlobUrl && (
              <div className="bg-[#1E0B3B] p-4 border-b border-white/10 flex justify-center items-center gap-4">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-2 rounded-full text-xs flex items-center gap-1.5 shadow"
                  >
                    <span className="h-2.5 w-2.5 bg-white rounded-full animate-ping" />
                    Record (10s)
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-6 py-2 rounded-full text-xs"
                  >
                    ⏹️ Stop Recording
                  </button>
                )}
              </div>
            )}

            {previewBlobUrl && (
              <div className="bg-[#1E0B3B] p-3 border-b border-white/10 flex justify-center">
                <button
                  onClick={startCamera}
                  className="text-xs font-bold text-yellow-400 hover:underline"
                >
                  🔄 Re-record Clip
                </button>
              </div>
            )}

            {/* Metadata form */}
            <form onSubmit={handlePostClip} className="p-4 space-y-3 bg-white/5 flex-1 overflow-y-auto">
              <div>
                <label className="block text-[10px] font-semibold text-white/60 uppercase tracking-wider mb-1">
                  Clip Title
                </label>
                <input
                  id="clip-title-input"
                  type="text"
                  required
                  placeholder="e.g. Catching live crabs!"
                  value={clipTitle}
                  onChange={(e) => setClipTitle(e.target.value)}
                  maxLength={40}
                  className="w-full bg-[#1E0B3B] text-white placeholder-white/30 border border-white/10 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-yellow-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-white/60 uppercase tracking-wider mb-1">
                  Caption / Details
                </label>
                <input
                  id="clip-caption-input"
                  type="text"
                  required
                  placeholder="e.g. Purging and boiling on Bayou Lafourche."
                  value={clipCaption}
                  onChange={(e) => setClipCaption(e.target.value)}
                  maxLength={140}
                  className="w-full bg-[#1E0B3B] text-white placeholder-white/30 border border-white/10 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-yellow-400"
                />
              </div>

              <div className="text-[10px] text-white/40 font-mono italic">
                🎭 Signed anonymously as: <span className="font-bold text-yellow-400">{profile.anonTotem}</span>
              </div>

              <button
                type="submit"
                disabled={submitting || (!videoBase64 && !cameraError)}
                className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 text-purple-950 font-bold py-2.5 rounded-lg text-xs tracking-wider shadow-lg shadow-yellow-400/20 mt-2"
              >
                {submitting ? 'UPLOADING CLIP...' : 'POST CLIP TO LOUISIANA 🚀'}
              </button>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}
