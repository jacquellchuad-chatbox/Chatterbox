/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

// Database file path
const DB_FILE = path.join(process.cwd(), 'database.json');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// Create uploads directory if it doesn't exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Interfaces matching src/types.ts
import { ChatMessage, AnonymousPost, PostComment, VideoClip } from './src/types';

interface DatabaseSchema {
  messages: ChatMessage[];
  posts: AnonymousPost[];
  comments: PostComment[];
  clips: VideoClip[];
}

// Initial seed data with authentic Louisiana flavor
const DEFAULT_DATABASE: DatabaseSchema = {
  messages: [
    {
      id: 'm1',
      roomId: 'nola',
      userId: 'seed-1',
      username: 'BoudreauxNOLA',
      parish: 'Orleans',
      userType: 'Jazz Fan',
      avatarColor: '#DFFF00',
      content: 'Who is going to Frenchmen Street tonight? Heard some incredible brass bands are playing!',
      timestamp: Date.now() - 3600000 * 2,
      isAnonymous: false,
      anonTotem: 'Gumbo Gator'
    },
    {
      id: 'm2',
      roomId: 'cajun-country',
      userId: 'seed-2',
      username: 'CrawfishQueen',
      parish: 'Lafayette',
      userType: 'Cajun',
      avatarColor: '#FF007F',
      content: 'Chère! Got 30 lbs of select live crawfish today. Fire up the pot, we boilin\'!',
      timestamp: Date.now() - 3600000 * 1.5,
      isAnonymous: false,
      anonTotem: 'Boudin Badger'
    },
    {
      id: 'm3',
      roomId: 'nola',
      userId: 'seed-anon-1',
      username: 'Anonymous',
      parish: 'Jefferson',
      userType: 'Swamp Native',
      avatarColor: '#39FF14',
      content: 'Just saw a 10-foot gator sunbathing right near the Bayou Segnette boat launch. Watch your toes, y\'all!',
      timestamp: Date.now() - 3600000 * 0.5,
      isAnonymous: true,
      anonTotem: 'Beignet Beaver'
    }
  ],
  posts: [
    {
      id: 'p1',
      title: 'The ultimate Crawfish Boil rules',
      content: 'Listen up, y\'all. There is NO rinsing after boiling. If you are not putting mushrooms, garlic heads, and pineapple in your boil pot, you are missing out. Also, DO NOT suck the heads if you didn\'t purge them properly! Keep it spicy or go back up north.',
      category: 'food',
      parish: 'Lafayette',
      color: 'from-emerald-950 to-green-900 border-green-500 text-green-200',
      upvotes: 42,
      downvotes: 3,
      timestamp: Date.now() - 3600000 * 5,
      anonTotem: 'Crawfish Commodore',
      spiciness: 'cayenne'
    },
    {
      id: 'p2',
      title: 'French Quarter Ghost Sighting in Alleyway',
      content: 'Was walking home from Frenchmen St around 2:00 AM, took a shortcut past St. Louis Cathedral. Swear I saw a woman in 19th-century dress floating near the gates. Anyone else seen the "Cathedral Bride" lately or was that just the Abita Purple Haze talking?',
      category: 'whispers',
      parish: 'Orleans',
      color: 'from-purple-950 to-fuchsia-950 border-purple-500 text-purple-200',
      upvotes: 28,
      downvotes: 1,
      timestamp: Date.now() - 3600000 * 12,
      anonTotem: 'Bourbon Banshee',
      spiciness: 'spicy'
    },
    {
      id: 'p3',
      title: 'Louisiana Slang Guide: "Mais, la!"',
      content: 'For any newcomers here: "Mais, la!" is our universal expression. It can mean "Oh my god!", "Well, of course!", "No way!", or just "Indeed". Use it when you run out of crawfish or when NOLA traffic is gridlocked. Pronounced like "May-lah". Thank me later.',
      category: 'slang',
      parish: 'St. Martin',
      color: 'from-amber-950 to-yellow-950 border-amber-500 text-yellow-200',
      upvotes: 56,
      downvotes: 2,
      timestamp: Date.now() - 3600000 * 24,
      anonTotem: 'Gator Guru',
      spiciness: 'mild'
    }
  ],
  comments: [
    {
      id: 'c1',
      postId: 'p1',
      content: 'Adding pineapple is a game changer! It absorbs the cayenne spice so well.',
      timestamp: Date.now() - 3600000 * 4,
      anonTotem: 'Spicy Pelican',
      parish: 'Iberia'
    },
    {
      id: 'c2',
      postId: 'p1',
      content: 'Mais, who puts pineapple in a crawfish boil?! Sacrilège!',
      timestamp: Date.now() - 3600000 * 3,
      anonTotem: 'Cajun Purist',
      parish: 'Acadia'
    }
  ],
  clips: [
    {
      id: 'v1',
      title: 'Mardi Gras Parade Vibes!',
      caption: 'Catching throws from the Zulu parade. Happy Mardi Gras, y\'all! 💜💚💛',
      videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-celebrating-mardi-gras-party-with-confetti-42294-large.mp4',
      parish: 'Orleans',
      anonTotem: 'Zulu Reveler',
      likes: 104,
      timestamp: Date.now() - 3600000 * 20
    },
    {
      id: 'v2',
      title: 'Feeding Alligators in the Bayou 🐊',
      caption: 'Meet "Old Toothless" at our local swamp tour. Cajun country is beautiful!',
      videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-muddy-river-water-flowing-through-the-forest-42250-large.mp4',
      parish: 'St. Tammany',
      anonTotem: 'Swamp Captain',
      likes: 85,
      timestamp: Date.now() - 3600000 * 18
    }
  ]
};

// Helper to read database
function readDb(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading database file, using seeds instead', err);
  }
  return DEFAULT_DATABASE;
}

// Helper to write database
function writeDb(data: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing database file', err);
  }
}

// Load database initially
let db = readDb();
if (!fs.existsSync(DB_FILE)) {
  writeDb(db);
}

// Initialize Firestore on server-side using Client SDK (fully node-compatible)
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const firebaseApp = initializeApp(firebaseConfig);
const firestoreDb = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

async function seedFirestore() {
  try {
    const postsCol = collection(firestoreDb, 'posts');
    const existingPosts = await getDocs(postsCol);
    if (existingPosts.empty) {
      console.log('Seeding initial posts to Firestore...');
      for (const p of DEFAULT_DATABASE.posts) {
        await setDoc(doc(firestoreDb, 'posts', p.id), {
          id: p.id,
          title: p.title,
          content: p.content,
          category: p.category,
          parish: p.parish,
          color: p.color,
          upvotes: p.upvotes,
          downvotes: p.downvotes,
          timestamp: serverTimestamp(),
          anonTotem: p.anonTotem,
          spiciness: p.spiciness
        });
      }
    }

    const clipsCol = collection(firestoreDb, 'clips');
    const existingClips = await getDocs(clipsCol);
    if (existingClips.empty) {
      console.log('Seeding initial clips to Firestore...');
      for (const c of DEFAULT_DATABASE.clips) {
        await setDoc(doc(firestoreDb, 'clips', c.id), {
          id: c.id,
          title: c.title,
          caption: c.caption,
          videoUrl: c.videoUrl,
          parish: c.parish,
          anonTotem: c.anonTotem,
          likes: c.likes,
          timestamp: serverTimestamp()
        });
      }
    }
    
    const msgsCol = collection(firestoreDb, 'messages');
    const existingMsgs = await getDocs(msgsCol);
    if (existingMsgs.empty) {
      console.log('Seeding initial chat messages to Firestore...');
      for (const m of DEFAULT_DATABASE.messages) {
        await setDoc(doc(firestoreDb, 'messages', m.id), {
          id: m.id,
          roomId: m.roomId,
          userId: m.userId,
          username: m.username,
          parish: m.parish,
          userType: m.userType,
          avatarColor: m.avatarColor,
          content: m.content,
          timestamp: serverTimestamp(),
          isAnonymous: m.isAnonymous,
          anonTotem: m.anonTotem
        });
      }
    }
  } catch (err) {
    console.error('Error seeding Firestore from server:', err);
  }
}

async function startServer() {
  await seedFirestore();
  const app = express();
  const PORT = 3000;

  // Use JSON payload middleware with size limit for base64 uploads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Expose static files under /uploads
  app.use('/uploads', express.static(UPLOADS_DIR));

  // --- API Routes ---

  // 1. Buzz Forum (Anonymous Posts)
  app.get('/api/buzz', (req, res) => {
    res.json(db.posts);
  });

  app.post('/api/buzz', (req, res) => {
    const { title, content, category, parish, color, anonTotem, spiciness } = req.body;
    if (!title || !content || !category || !parish) {
      return res.status(400).json({ error: 'Missing required post fields' });
    }

    const newPost: AnonymousPost = {
      id: 'post_' + Math.random().toString(36).substring(2, 9),
      title,
      content,
      category,
      parish,
      color: color || 'from-zinc-900 to-zinc-950 border-zinc-800 text-zinc-300',
      upvotes: 0,
      downvotes: 0,
      timestamp: Date.now(),
      anonTotem: anonTotem || 'Mystery Cajun',
      spiciness: spiciness || 'mild'
    };

    db.posts.unshift(newPost);
    writeDb(db);
    res.status(201).json(newPost);
  });

  // Upvote/Downvote Buzz
  app.post('/api/buzz/:id/vote', (req, res) => {
    const { id } = req.params;
    const { type } = req.body; // 'up' or 'down'
    const post = db.posts.find(p => p.id === id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (type === 'up') {
      post.upvotes += 1;
    } else if (type === 'down') {
      post.downvotes += 1;
    }

    // Dynamic Spiciness based on vote activity
    const netVotes = post.upvotes - post.downvotes;
    if (netVotes > 15) {
      post.spiciness = 'cayenne';
    } else if (netVotes > 5) {
      post.spiciness = 'spicy';
    } else {
      post.spiciness = 'mild';
    }

    writeDb(db);
    res.json(post);
  });

  // Comments
  app.get('/api/buzz/:id/comments', (req, res) => {
    const { id } = req.params;
    const postComments = db.comments.filter(c => c.postId === id);
    res.json(postComments);
  });

  app.post('/api/buzz/:id/comments', (req, res) => {
    const { id } = req.params;
    const { content, anonTotem, parish } = req.body;

    if (!content || !anonTotem || !parish) {
      return res.status(400).json({ error: 'Missing comment fields' });
    }

    const newComment: PostComment = {
      id: 'comment_' + Math.random().toString(36).substring(2, 9),
      postId: id,
      content,
      timestamp: Date.now(),
      anonTotem,
      parish
    };

    db.comments.push(newComment);
    writeDb(db);
    res.status(201).json(newComment);
  });

  // 2. Video Clips
  app.get('/api/clips', (req, res) => {
    res.json(db.clips);
  });

  app.post('/api/clips', async (req, res) => {
    const { title, caption, parish, anonTotem, videoBase64 } = req.body;

    if (!title || !caption || !parish || !anonTotem) {
      return res.status(400).json({ error: 'Missing clip details' });
    }

    let finalVideoUrl = '';

    if (videoBase64) {
      // It is a base64 recorded clip. Save it locally!
      try {
        const fileExtension = 'webm';
        const fileName = `clip_${Date.now()}_${Math.random().toString(36).substring(2, 5)}.${fileExtension}`;
        const filePath = path.join(UPLOADS_DIR, fileName);

        // Strip data header if present
        const matches = videoBase64.match(/^data:video\/([a-zA-Z0-9]+);base64,(.+)$/);
        let dataBuffer: Buffer;

        if (matches && matches.length === 3) {
          dataBuffer = Buffer.from(matches[2], 'base64');
        } else {
          dataBuffer = Buffer.from(videoBase64, 'base64');
        }

        fs.writeFileSync(filePath, dataBuffer);
        finalVideoUrl = `/uploads/${fileName}`;
      } catch (err) {
        console.error('Failed to save base64 video', err);
        return res.status(500).json({ error: 'Failed to write video file' });
      }
    } else {
      // Use mock/fallback stock clip if no base64 provided
      finalVideoUrl = 'https://assets.mixkit.co/videos/preview/mixkit-muddy-river-water-flowing-through-the-forest-42250-large.mp4';
    }

    const newClip: VideoClip = {
      id: 'clip_' + Math.random().toString(36).substring(2, 9),
      title,
      caption,
      videoUrl: finalVideoUrl,
      parish,
      anonTotem,
      likes: 0,
      timestamp: Date.now()
    };

    try {
      await setDoc(doc(firestoreDb, 'clips', newClip.id), {
        id: newClip.id,
        title: newClip.title,
        caption: newClip.caption,
        videoUrl: newClip.videoUrl,
        parish: newClip.parish,
        anonTotem: newClip.anonTotem,
        likes: 0,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error('Failed to save uploaded clip to Firestore:', err);
    }

    db.clips.unshift(newClip);
    writeDb(db);
    res.status(201).json(newClip);
  });

  app.post('/api/clips/:id/like', (req, res) => {
    const { id } = req.params;
    const clip = db.clips.find(c => c.id === id);

    if (!clip) {
      return res.status(404).json({ error: 'Clip not found' });
    }

    clip.likes += 1;
    writeDb(db);
    res.json(clip);
  });

  // Endpoint to clear/reset mock database if user desires (dev tool helper)
  app.post('/api/reset-db', (req, res) => {
    db = JSON.parse(JSON.stringify(DEFAULT_DATABASE));
    writeDb(db);
    res.json({ message: 'Database reset successfully' });
  });

  // Base HTTP Server setup
  const httpServer = http.createServer(app);

  // --- WebSocket Server implementation for real-time chat, presence, and WebRTC signalling ---
  const wss = new WebSocketServer({ server: httpServer });

  interface ExtendedWebSocket extends WebSocket {
    userId?: string;
    username?: string;
    roomId?: string;
    parish?: string;
    anonTotem?: string;
    isAnonymous?: boolean;
  }

  // Active connected user tracking
  wss.on('connection', (ws: ExtendedWebSocket) => {
    console.log('Client connected to WebSocket server');

    ws.on('message', (messageStr: string) => {
      try {
        const data = JSON.parse(messageStr);
        
        switch (data.type) {
          case 'join': {
            const { roomId, userId, username, parish, anonTotem } = data.payload;
            ws.roomId = roomId;
            ws.userId = userId;
            ws.username = username;
            ws.parish = parish;
            ws.anonTotem = anonTotem;

            // Send historic chat messages for this room
            const roomMessages = db.messages.filter(m => m.roomId === roomId).slice(-50);
            ws.send(JSON.stringify({
              type: 'history',
              payload: roomMessages
            }));

            // Notify everyone in the room
            broadcastToRoom(roomId, {
              type: 'presence-update',
              payload: getActiveRoomUsers(roomId)
            });
            break;
          }

          case 'message': {
            const { roomId, userId, username, parish, userType, avatarColor, content, isAnonymous, anonTotem } = data.payload;
            
            const newMessage: ChatMessage = {
              id: 'msg_' + Math.random().toString(36).substring(2, 9),
              roomId,
              userId,
              username,
              parish,
              userType,
              avatarColor,
              content,
              timestamp: Date.now(),
              isAnonymous,
              anonTotem
            };

            db.messages.push(newMessage);
            writeDb(db);

            broadcastToRoom(roomId, {
              type: 'message',
              payload: newMessage
            });
            break;
          }

          case 'typing': {
            const { roomId, username, isTyping } = data.payload;
            broadcastToRoom(roomId, {
              type: 'typing',
              payload: { username, isTyping, userId: ws.userId }
            }, ws); // Skip sender
            break;
          }

          // WebRTC Signaling
          case 'signal': {
            const { targetUserId, signal } = data.payload;
            // Find target WebSocket client
            wss.clients.forEach((client: ExtendedWebSocket) => {
              if (client.readyState === WebSocket.OPEN && client.userId === targetUserId) {
                client.send(JSON.stringify({
                  type: 'signal',
                  payload: {
                    senderUserId: ws.userId,
                    senderUsername: ws.isAnonymous ? ws.anonTotem : ws.username,
                    signal
                  }
                }));
              }
            });
            break;
          }
        }
      } catch (err) {
        console.error('Error handling websocket message', err);
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected from WebSocket server');
      if (ws.roomId) {
        broadcastToRoom(ws.roomId, {
          type: 'presence-update',
          payload: getActiveRoomUsers(ws.roomId)
        });
      }
    });
  });

  // Helper to get active users in a room
  function getActiveRoomUsers(roomId: string) {
    const users: Array<{ userId: string; username: string; parish: string; anonTotem: string }> = [];
    wss.clients.forEach((client: ExtendedWebSocket) => {
      if (client.readyState === WebSocket.OPEN && client.roomId === roomId && client.userId) {
        users.push({
          userId: client.userId,
          username: client.username || 'Visitor',
          parish: client.parish || 'Unknown',
          anonTotem: client.anonTotem || 'Mystery Cajun'
        });
      }
    });
    return users;
  }

  // Helper to broadcast to a room
  function broadcastToRoom(roomId: string, data: any, skipClient?: ExtendedWebSocket) {
    wss.clients.forEach((client: ExtendedWebSocket) => {
      if (client.readyState === WebSocket.OPEN && client.roomId === roomId && client !== skipClient) {
        client.send(JSON.stringify(data));
      }
    });
  }

  // Vite Integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Louisiana Chatbox] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
