/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserProfile {
  id: string;
  username: string;
  parish: string; // e.g. Orleans, Lafayette, East Baton Rouge, etc.
  userType: string; // e.g. Cajun, Creole, Jazz Fan, Swamp Native, Explorer
  avatarColor: string; // e.g. #39FF14 (neon green), #FF007F (neon pink), etc.
  anonTotem: string; // e.g. "Gumbo Gator", "Boudin Badger", "Zydeco Zebra"
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  parish: string;
  userType: string;
  avatarColor: string;
  content: string;
  timestamp: number;
  isAnonymous: boolean;
  anonTotem: string;
  mediaUrl?: string; // Optional image upload
}

export interface AnonymousPost {
  id: string;
  title: string;
  content: string;
  category: 'slang' | 'food' | 'whispers' | 'festivals' | 'swamp-life' | 'general';
  parish: string;
  color: string; // Background color preset/gradient for visual variety
  upvotes: number;
  downvotes: number;
  timestamp: number;
  anonTotem: string;
  spiciness: 'mild' | 'spicy' | 'cayenne';
}

export interface PostComment {
  id: string;
  postId: string;
  content: string;
  timestamp: number;
  anonTotem: string;
  parish: string;
}

export interface VideoClip {
  id: string;
  title: string;
  caption: string;
  videoUrl: string;
  parish: string;
  anonTotem: string;
  likes: number;
  timestamp: number;
}

export interface ChatRoom {
  id: string;
  name: string;
  description: string;
  category: string;
  activeCount: number;
}
