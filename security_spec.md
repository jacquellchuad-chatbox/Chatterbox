# Security Specification: Louisiana Chatbox Firestore Rules

This document specifies the data invariants, security test payloads, and test runner configurations designed to guarantee a zero-trust, fully secure Firestore environment.

## 1. Data Invariants
- **Authentication**: All writes must be authenticated (either via anonymous authentication or Google Sign-In). 
- **Message Integrity**: Room messages must have a valid `roomId`, a valid non-empty `content` <= 1000 characters, and are immutable after creation.
- **Post Integrity**: Forum posts must have a valid `category` from the allowed enum, positive integer votes, `upvotes` and `downvotes` initialized to 0 on creation, and only specific vote updates are permitted. Other fields are immutable.
- **Comment Integrity**: Comments must belong to an existing post, have a content <= 500 characters, and are immutable after creation.
- **Clip Integrity**: Video clips are immutable except for the `likes` field, which can only be incremented.

---

## 2. The "Dirty Dozen" Malicious Payloads

### Case 1: Chat Room Messages (`/messages/{messageId}`)
1. **ID Poisoning Attack**: Trying to write a message with an invalid document ID structure (e.g., `msg_$$$bad_id_123`).
2. **Denial of Wallet (Huge Payload)**: Trying to write a message containing 10,000 characters of spam.
3. **Immutability Bypass**: Trying to update/modify a message content once it has been posted.

### Case 2: Forum Posts (`/posts/{postId}`)
4. **Initial Vote Hijacking**: Posting a new story with `upvotes` pre-initialized to `999`.
5. **Invalid Enum Poisoning**: Posting with an unapproved category name (e.g. `"scam-deals"`).
6. **Title/Content Tampering**: Trying to edit/modify another user's post title or content.
7. **Shadow Update (Ghost Fields)**: Modifying a post to increment votes but sneaky-inserting a field like `"isAdmin": true`.

### Case 3: Post Comments (`/posts/{postId}/comments/{commentId}`)
8. **Orphaned Comments**: Trying to write a comment on a post that does not exist.
9. **Volumetric Comment Spam**: Writing a comment with content exceeding 500 characters.
10. **Comment Tampering**: Trying to edit/update an existing comment's text.

### Case 4: Video Clips (`/clips/{clipId}`)
11. **Video Hijacking**: Modifying the `videoUrl` of an existing video clip to point to a malicious source.
12. **Shadow Clip Update**: Sneakily updating the clip's metadata (like `parish` or `anonTotem`) during a like operation.

---

## 3. Test Runner Definition (`firestore.rules.test.ts`)

```typescript
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

// Verification suite mock tests for security_spec.md
```
