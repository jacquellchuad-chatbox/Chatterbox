/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UserProfile, AnonymousPost, PostComment } from '../types';
import { Flame, MessageSquare, Plus, ArrowUp, ArrowDown, MapPin, Eye, Sparkles, Filter, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, setDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';


interface BayouBuzzProps {
  profile: UserProfile;
}

const COLOR_PRESETS = [
  { name: 'Mardi Gras Magic 🔮', class: 'from-[#3B1270]/90 to-[#2E0B5E]/80 border-purple-500/50 text-purple-100' },
  { name: 'Acadian Gold 🎷', class: 'from-amber-900/90 to-yellow-800/80 border-yellow-500/50 text-amber-100' },
  { name: 'Emerald Moss 🧪', class: 'from-emerald-950/90 to-green-950/60 border-emerald-500/50 text-emerald-100' },
  { name: 'Creole Spice 🌶️', class: 'from-red-950/90 to-rose-900/80 border-rose-500/50 text-rose-100' },
  { name: 'Midnight Bayou 🌫️', class: 'from-[#1E0B3B]/90 to-[#120524]/80 border-white/10 text-white' }
];

const CATEGORIES = [
  { id: 'all', name: 'All Buzz 📢' },
  { id: 'food', name: 'Gumbo & Crawfish 🍲' },
  { id: 'whispers', name: 'Ghost Stories & Rumors 👻' },
  { id: 'slang', name: 'Louisiana Slang 🗣️' },
  { id: 'swamp-life', name: 'Swamp & Wild Life 🐊' },
  { id: 'festivals', name: 'Festivals & Mardi Gras 🎉' },
  { id: 'general', name: 'General Chat 💬' }
];

export default function BayouBuzz({ profile }: BayouBuzzProps) {
  const [posts, setPosts] = useState<AnonymousPost[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);

  // Post Creator Modal
  const [showCreator, setShowCreator] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [newColor, setNewColor] = useState(COLOR_PRESETS[0].class);
  const [newSpiciness, setNewSpiciness] = useState<'mild' | 'spicy' | 'cayenne'>('mild');

  // Detail Modal
  const [activePost, setActivePost] = useState<AnonymousPost | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsList: AnonymousPost[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        postsList.push({
          id: docSnapshot.id,
          title: data.title,
          content: data.content,
          category: data.category,
          parish: data.parish,
          color: data.color,
          upvotes: data.upvotes,
          downvotes: data.downvotes,
          timestamp: data.timestamp?.toMillis ? data.timestamp.toMillis() : (data.timestamp || Date.now()),
          anonTotem: data.anonTotem,
          spiciness: data.spiciness
        });
      });
      setPosts(postsList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'posts');
    });

    return () => unsubscribe();
  }, []);

  // Listen to comments real-time when details modal is open
  useEffect(() => {
    if (!activePost) return;

    setCommentsLoading(true);
    const q = query(collection(db, 'posts', activePost.id, 'comments'), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsList: PostComment[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        commentsList.push({
          id: docSnapshot.id,
          postId: data.postId,
          content: data.content,
          timestamp: data.timestamp?.toMillis ? data.timestamp.toMillis() : (data.timestamp || Date.now()),
          anonTotem: data.anonTotem,
          parish: data.parish
        });
      });
      setComments(commentsList);
      setCommentsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `posts/${activePost.id}/comments`);
    });

    return () => unsubscribe();
  }, [activePost?.id]);

  // Synchronize activePost details view when votes change
  useEffect(() => {
    if (activePost) {
      const updated = posts.find((p) => p.id === activePost.id);
      if (updated && (updated.upvotes !== activePost.upvotes || updated.downvotes !== activePost.downvotes || updated.spiciness !== activePost.spiciness)) {
        setActivePost(updated);
      }
    }
  }, [posts, activePost?.id]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const titleText = newTitle.trim();
    const contentText = newContent.trim();
    const postId = 'post_' + Math.random().toString(36).substring(2, 9);

    try {
      await setDoc(doc(db, 'posts', postId), {
        id: postId,
        title: titleText,
        content: contentText,
        category: newCategory,
        parish: profile.parish,
        color: newColor,
        upvotes: 0,
        downvotes: 0,
        timestamp: serverTimestamp(),
        anonTotem: profile.anonTotem,
        spiciness: newSpiciness
      });

      setNewTitle('');
      setNewContent('');
      setShowCreator(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'posts/' + postId);
    }
  };

  const handleVote = async (postId: string, type: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid opening details modal
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const newUpvotes = type === 'up' ? post.upvotes + 1 : post.upvotes;
    const newDownvotes = type === 'down' ? post.downvotes + 1 : post.downvotes;
    const netVotes = newUpvotes - newDownvotes;
    
    let nextSpiciness: 'mild' | 'spicy' | 'cayenne' = 'mild';
    if (netVotes > 15) {
      nextSpiciness = 'cayenne';
    } else if (netVotes > 5) {
      nextSpiciness = 'spicy';
    }

    try {
      await updateDoc(doc(db, 'posts', postId), {
        upvotes: newUpvotes,
        downvotes: newDownvotes,
        spiciness: nextSpiciness
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'posts/' + postId);
    }
  };

  const handleOpenDetails = (post: AnonymousPost) => {
    setActivePost(post);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || !activePost) return;

    const contentText = commentInput.trim();
    setCommentInput('');
    const commentId = 'comment_' + Math.random().toString(36).substring(2, 9);

    try {
      await setDoc(doc(db, 'posts', activePost.id, 'comments', commentId), {
        id: commentId,
        postId: activePost.id,
        content: contentText,
        timestamp: serverTimestamp(),
        anonTotem: profile.anonTotem,
        parish: profile.parish
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `posts/${activePost.id}/comments/${commentId}`);
    }
  };

  const filteredPosts = posts.filter((post) => {
    if (activeCategory === 'all') return true;
    return post.category === activeCategory;
  });

  return (
    <div id="bayou-buzz-board" className="space-y-6">
      
      {/* Categories Bar & Create Button */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? 'bg-yellow-400 border-yellow-400 text-purple-950 shadow-md shadow-yellow-400/20'
                  : 'bg-[#3B1270]/90 border-white/10 text-white/60 hover:border-white/20 hover:text-white hover:bg-[#3B1270]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowCreator(true)}
          className="w-full md:w-auto bg-yellow-400 hover:bg-yellow-300 text-purple-950 text-xs font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-lg shadow-yellow-400/20"
        >
          <Plus className="h-4 w-4" />
          Share Local Buzz
        </motion.button>
      </div>

      {/* Main Grid Feed */}
      {loading ? (
        <div className="text-center py-24 space-y-3">
          <span className="inline-block h-8 w-8 rounded-full border-2 border-white/10 border-t-yellow-400 animate-spin" />
          <p className="text-xs text-white/50 font-mono">RETRIEVING Bayou BBS FREQUENCIES...</p>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-20 bg-[#3B1270]/90 border border-white/10 rounded-2xl p-6 shadow-xl">
          <p className="text-white/80 font-medium text-sm">Quiet in the marshes today...</p>
          <p className="text-xs text-white/40 mt-1 max-w-sm mx-auto">
            No local anonymous gossip or news has been posted in this category yet. Be the first to share!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence>
            {filteredPosts.map((post) => (
              <motion.div
                key={post.id}
                layoutId={`post-card-${post.id}`}
                onClick={() => handleOpenDetails(post)}
                className={`cursor-pointer bg-gradient-to-br border rounded-xl p-5 shadow-lg flex flex-col justify-between transition-all hover:scale-102 hover:shadow-2xl relative group ${post.color} ${
                  post.spiciness === 'cayenne' ? 'ring-2 ring-red-500 shadow-red-500/20' : ''
                }`}
              >
                {/* Spiciness Level Header */}
                <div className="flex justify-between items-start gap-4 mb-3">
                  <span className="text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#1E0B3B]/70 border border-white/10 flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-red-400" />
                    {post.parish} Parish
                  </span>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    post.spiciness === 'cayenne' ? 'bg-red-500 text-white font-mono animate-bounce' :
                    post.spiciness === 'spicy' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                    'bg-[#1E0B3B]/50 text-white/60 border border-white/10'
                  }`}>
                    <Flame className="h-3.5 w-3.5" />
                    {post.spiciness.toUpperCase()} HEAT
                  </span>
                </div>

                {/* Post Body */}
                <div className="flex-1 space-y-2 mb-4">
                  <h3 className="font-display font-bold text-base leading-snug group-hover:underline">
                    {post.title}
                  </h3>
                  <p className="text-xs leading-relaxed opacity-85 line-clamp-4">
                    {post.content}
                  </p>
                </div>

                {/* Post Footer Actions */}
                <div className="border-t border-white/10 pt-3 flex items-center justify-between">
                  {/* Totem Author */}
                  <span className="text-[11px] font-mono opacity-60">
                    🎭 {post.anonTotem}
                  </span>

                  {/* Comments & Votes */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs opacity-75">
                      <MessageSquare className="h-4 w-4" />
                      <span>Buzz</span>
                    </div>

                    <div className="flex items-center bg-[#1E0B3B]/50 rounded-lg p-0.5 border border-white/10">
                      <button
                        onClick={(e) => handleVote(post.id, 'up', e)}
                        className="p-1 hover:text-yellow-400 transition-colors"
                        title="Mildly Hot"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-[10px] font-mono px-1 min-w-4 text-center font-bold">
                        {post.upvotes - post.downvotes}
                      </span>
                      <button
                        onClick={(e) => handleVote(post.id, 'down', e)}
                        className="p-1 hover:text-red-400 transition-colors"
                        title="Not Hot"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* --- MODAL: POST CREATOR --- */}
      {showCreator && (
        <div className="fixed inset-0 bg-purple-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#3B1270] border border-white/20 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-lg text-white flex items-center gap-1.5">
                <Sparkles className="h-5 w-5 text-yellow-400" />
                Whisper to the Bayou
              </h2>
              <button
                onClick={() => setShowCreator(false)}
                className="text-white/60 hover:text-white text-xs font-mono border border-white/10 rounded px-2 py-1 bg-[#1E0B3B]/50"
              >
                ESC
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5">
                  Buzz Headline
                </label>
                <input
                  id="buzz-title-input"
                  type="text"
                  required
                  placeholder="The best boudin in Acadiana is..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  maxLength={60}
                  className="w-full bg-[#1E0B3B] text-white placeholder-white/30 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-yellow-400"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5">
                  Details / Gossip / Confession
                </label>
                <textarea
                  id="buzz-content-input"
                  required
                  placeholder="Tell us what's happening around your parish. Keep it juicy, helpful, or ghostly..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  maxLength={1000}
                  rows={4}
                  className="w-full bg-[#1E0B3B] text-white placeholder-white/30 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-yellow-400 resize-none"
                />
              </div>

              {/* Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5">
                    Category
                  </label>
                  <select
                    id="buzz-category-select"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-[#1E0B3B] text-white border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-yellow-400"
                  >
                    {CATEGORIES.slice(1).map((cat) => (
                      <option key={cat.id} value={cat.id} className="bg-[#1E0B3B] text-white">
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5">
                    Initial Heat level
                  </label>
                  <select
                    id="buzz-heat-select"
                    value={newSpiciness}
                    onChange={(e) => setNewSpiciness(e.target.value as any)}
                    className="w-full bg-[#1E0B3B] text-white border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-yellow-400"
                  >
                    <option value="mild" className="bg-[#1E0B3B]">Mild 🌶️</option>
                    <option value="spicy" className="bg-[#1E0B3B]">Spicy 🔥</option>
                    <option value="cayenne" className="bg-[#1E0B3B]">Cayenne Heat 🥵</option>
                  </select>
                </div>
              </div>

              {/* Card Preset Gradients */}
              <div>
                <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5">
                  BBS Card Color / Vibe
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.class}
                      type="button"
                      onClick={() => setNewColor(preset.class)}
                      className={`text-[9px] font-bold p-1 rounded border text-center transition-all ${preset.class} ${
                        newColor === preset.class ? 'ring-2 ring-white scale-105' : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      {preset.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notice */}
              <div className="bg-[#1E0B3B] border border-white/10 p-3 rounded-lg text-[10px] text-white/50 flex gap-2">
                <AlertTriangle className="h-4.5 w-4.5 text-yellow-400 shrink-0" />
                <p>
                  This is completely anonymous! Your post will be marked as submitted from your parish with the totem author identity:{' '}
                  <span className="font-mono text-yellow-400 font-bold">🎭 {profile.anonTotem}</span>.
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreator(false)}
                  className="flex-1 bg-[#1E0B3B] text-white/60 hover:text-white border border-white/10 py-2.5 rounded-lg text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-purple-950 py-2.5 rounded-lg text-xs font-bold shadow-lg shadow-yellow-400/20"
                >
                  Post Anonymously
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* --- MODAL: POST DETAILS & COMMENTS --- */}
      {activePost && (
        <div className="fixed inset-0 bg-purple-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div
            layoutId={`post-card-${activePost.id}`}
            className="bg-[#3B1270] border border-white/20 w-full max-w-2xl rounded-2xl p-6 shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* Post details */}
            <div className="flex justify-between items-start gap-4 mb-3 shrink-0">
              <span className="text-[10px] font-mono font-bold tracking-wider uppercase px-2.5 py-1 rounded-full bg-[#1E0B3B] border border-white/10 flex items-center gap-1.5 text-white/80">
                <MapPin className="h-3 w-3 text-red-400" />
                {activePost.parish} Parish
              </span>
              <button
                onClick={() => setActivePost(null)}
                className="text-white/60 hover:text-white text-xs font-mono border border-white/10 bg-[#1E0B3B]/50 rounded px-2.5 py-1"
              >
                CLOSE
              </button>
            </div>

            <div className="space-y-2 mb-4 shrink-0">
              <h2 className="font-display font-bold text-lg text-white">
                {activePost.title}
              </h2>
              <div className="p-4 bg-[#1E0B3B] rounded-xl border border-white/10 text-xs text-white/90 leading-relaxed max-h-48 overflow-y-auto">
                {activePost.content}
              </div>
              <div className="flex items-center justify-between text-[11px] text-white/40 font-mono">
                <span>🎭 Posted by {activePost.anonTotem}</span>
                <span>{new Date(activePost.timestamp).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Comments Area */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-[200px] border-t border-white/10 pt-4">
              <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 flex items-center gap-1.5 shrink-0">
                <MessageSquare className="h-4 w-4 text-yellow-400" />
                Bayou Whispers ({comments.length})
              </h3>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-4">
                {commentsLoading ? (
                  <div className="text-center py-8 text-xs text-white/40 font-mono animate-pulse">
                    RETRIEVING COMMENT STREAM...
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-10 text-xs text-white/30 italic">
                    Silence. No whispers on this post yet. Stir the pot below!
                  </div>
                ) : (
                  comments.map((comm) => (
                    <div key={comm.id} className="bg-white/5 border border-white/10 p-3 rounded-lg space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] font-mono text-yellow-400 font-bold">
                        <span>🎭 {comm.anonTotem}</span>
                        <span className="text-white/40 font-normal">({comm.parish} Parish)</span>
                      </div>
                      <p className="text-xs text-white/90 leading-relaxed">
                        {comm.content}
                      </p>
                      <div className="text-[9px] text-white/40 font-mono text-right">
                        {new Date(comm.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Comment Input */}
              <form onSubmit={handleAddComment} className="flex gap-2 shrink-0 border-t border-white/10 pt-3">
                <input
                  id="buzz-comment-input"
                  type="text"
                  required
                  placeholder={`Comment anonymously as ${profile.anonTotem}...`}
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  maxLength={250}
                  className="flex-1 bg-[#1E0B3B] text-white placeholder-white/30 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-yellow-400"
                />
                <button
                  type="submit"
                  disabled={!commentInput.trim()}
                  className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 text-purple-950 font-bold px-4 rounded-lg text-xs transition-colors"
                >
                  Send
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
