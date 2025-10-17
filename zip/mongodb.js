# Equal Democracy - Complete File Package

All files are provided below. Copy each section into the corresponding file path in your Next.js project.

---

## 1. lib/mongodb.js

```javascript
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('✅ Connected to MongoDB');
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectDB;
```

---

## 2. lib/models.js

```javascript
import mongoose from 'mongoose';

// User Model
const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    maxlength: [60, 'Name cannot be more than 60 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Proposal Model
const ProposalSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide a title'],
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Please provide a description'],
    maxlength: [2000, 'Description cannot be more than 2000 characters']
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  authorName: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'top3', 'archived'],
    default: 'active'
  },
  thumbsUpCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// ThumbsUp Model
const ThumbsUpSchema = new mongoose.Schema({
  proposalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Proposal',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

ThumbsUpSchema.index({ proposalId: 1, userId: 1 }, { unique: true });

// Comment Model
const CommentSchema = new mongoose.Schema({
  proposalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Proposal',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  authorName: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: [true, 'Please provide comment text'],
    maxlength: [1000, 'Comment cannot be more than 1000 characters']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// FinalVote Model
const FinalVoteSchema = new mongoose.Schema({
  proposalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Proposal',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  choice: {
    type: String,
    enum: ['yes', 'no'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

FinalVoteSchema.index({ proposalId: 1, userId: 1 }, { unique: true });

// Export models
export const User = mongoose.models.User || mongoose.model('User', UserSchema);
export const Proposal = mongoose.models.Proposal || mongoose.model('Proposal', ProposalSchema);
export const ThumbsUp = mongoose.models.ThumbsUp || mongoose.model('ThumbsUp', ThumbsUpSchema);
export const Comment = mongoose.models.Comment || mongoose.model('Comment', CommentSchema);
export const FinalVote = mongoose.models.FinalVote || mongoose.model('FinalVote', FinalVoteSchema);
```

---

## 3. pages/api/auth/[...nextauth].js

```javascript
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import connectDB from '../../../lib/mongodb';
import { User } from '../../../lib/models';

export default NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        await connectDB();

        const user = await User.findOne({ email: credentials.email });

        if (!user) {
          throw new Error('Ingen användare hittades med denna e-post');
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) {
          throw new Error('Felaktigt lösenord');
        }

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name
        };
      }
    })
  ],
  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
      }
      return session;
    }
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
});
```

---

## 4. pages/api/auth/register.js

```javascript
import bcrypt from 'bcryptjs';
import connectDB from '../../../lib/mongodb';
import { User } from '../../../lib/models';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Alla fält måste fyllas i' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Lösenordet måste vara minst 6 tecken' });
  }

  try {
    await connectDB();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'En användare med denna e-post finns redan' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword
    });

    return res.status(201).json({
      message: 'Användare skapad',
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Ett fel uppstod vid registrering' });
  }
}
```

---

## 5. pages/api/proposals/index.js

```javascript
import { getSession } from 'next-auth/react';
import connectDB from '../../../lib/mongodb';
import { Proposal, ThumbsUp, Comment } from '../../../lib/models';

export default async function handler(req, res) {
  await connectDB();

  if (req.method === 'GET') {
    try {
      const proposals = await Proposal.find()
        .sort({ createdAt: -1 })
        .lean();

      const proposalsWithCounts = await Promise.all(
        proposals.map(async (proposal) => {
          const thumbsUpCount = await ThumbsUp.countDocuments({ proposalId: proposal._id });
          const commentsCount = await Comment.countDocuments({ proposalId: proposal._id });
          
          return {
            ...proposal,
            _id: proposal._id.toString(),
            authorId: proposal.authorId.toString(),
            thumbsUpCount,
            commentsCount
          };
        })
      );

      return res.status(200).json(proposalsWithCounts);
    } catch (error) {
      console.error('Error fetching proposals:', error);
      return res.status(500).json({ message: 'Ett fel uppstod' });
    }
  }

  if (req.method === 'POST') {
    const session = await getSession({ req });
    
    if (!session) {
      return res.status(401).json({ message: 'Du måste vara inloggad' });
    }

    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: 'Titel och beskrivning krävs' });
    }

    try {
      const proposal = await Proposal.create({
        title,
        description,
        authorId: session.user.id,
        authorName: session.user.name,
        status: 'active',
        thumbsUpCount: 0
      });

      return res.status(201).json({
        ...proposal.toObject(),
        _id: proposal._id.toString(),
        authorId: proposal.authorId.toString()
      });
    } catch (error) {
      console.error('Error creating proposal:', error);
      return res.status(500).json({ message: 'Ett fel uppstod vid skapande av förslag' });
    }
  }

  if (req.method === 'PATCH') {
    const session = await getSession({ req });
    
    if (!session) {
      return res.status(401).json({ message: 'Du måste vara inloggad' });
    }

    const { action, proposalIds } = req.body;

    if (action === 'moveToTop3' && proposalIds && Array.isArray(proposalIds)) {
      try {
        await Proposal.updateMany(
          { _id: { $in: proposalIds } },
          { $set: { status: 'top3' } }
        );

        return res.status(200).json({ message: 'Topp 3 uppdaterad' });
      } catch (error) {
        console.error('Error updating proposals:', error);
        return res.status(500).json({ message: 'Ett fel uppstod' });
      }
    }

    return res.status(400).json({ message: 'Ogiltig förfrågan' });
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
```

---

## 6. pages/api/thumbsup.js

```javascript
import { getSession } from 'next-auth/react';
import connectDB from '../../lib/mongodb';
import { ThumbsUp, Proposal } from '../../lib/models';

export default async function handler(req, res) {
  await connectDB();

  if (req.method === 'POST') {
    const session = await getSession({ req });
    
    if (!session) {
      return res.status(401).json({ message: 'Du måste vara inloggad' });
    }

    const { proposalId } = req.body;

    if (!proposalId) {
      return res.status(400).json({ message: 'Proposal ID krävs' });
    }

    try {
      const existingVote = await ThumbsUp.findOne({
        proposalId,
        userId: session.user.id
      });

      if (existingVote) {
        return res.status(400).json({ message: 'Du har redan röstat på detta förslag' });
      }

      await ThumbsUp.create({
        proposalId,
        userId: session.user.id
      });

      const count = await ThumbsUp.countDocuments({ proposalId });
      await Proposal.findByIdAndUpdate(proposalId, { thumbsUpCount: count });

      return res.status(201).json({ message: 'Röst registrerad', count });
    } catch (error) {
      console.error('Error adding thumbs up:', error);
      return res.status(500).json({ message: 'Ett fel uppstod' });
    }
  }

  if (req.method === 'GET') {
    const session = await getSession({ req });
    
    if (!session) {
      return res.status(401).json({ message: 'Du måste vara inloggad' });
    }

    const { proposalId } = req.query;

    if (proposalId) {
      const voted = await ThumbsUp.exists({
        proposalId,
        userId: session.user.id
      });

      return res.status(200).json({ voted: !!voted });
    }

    const votes = await ThumbsUp.find({ userId: session.user.id })
      .populate('proposalId')
      .lean();

    return res.status(200).json(votes);
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
```

---

## 7. pages/api/comments.js

```javascript
import { getSession } from 'next-auth/react';
import connectDB from '../../lib/mongodb';
import { Comment } from '../../lib/models';

export default async function handler(req, res) {
  await connectDB();

  if (req.method === 'GET') {
    const { proposalId } = req.query;

    if (!proposalId) {
      return res.status(400).json({ message: 'Proposal ID krävs' });
    }

    try {
      const comments = await Comment.find({ proposalId })
        .sort({ createdAt: -1 })
        .lean();

      const anonymizedComments = comments.map(comment => ({
        _id: comment._id.toString(),
        proposalId: comment.proposalId.toString(),
        authorName: comment.authorName,
        text: comment.text,
        createdAt: comment.createdAt
      }));

      return res.status(200).json(anonymizedComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      return res.status(500).json({ message: 'Ett fel uppstod' });
    }
  }

  if (req.method === 'POST') {
    const session = await getSession({ req });
    
    if (!session) {
      return res.status(401).json({ message: 'Du måste vara inloggad' });
    }

    const { proposalId, text } = req.body;

    if (!proposalId || !text) {
      return res.status(400).json({ message: 'Proposal ID och text krävs' });
    }

    if (text.length > 1000) {
      return res.status(400).json({ message: 'Kommentaren är för lång (max 1000 tecken)' });
    }

    try {
      const comment = await Comment.create({
        proposalId,
        userId: session.user.id,
        authorName: session.user.name,
        text
      });

      return res.status(201).json({
        _id: comment._id.toString(),
        proposalId: comment.proposalId.toString(),
        authorName: comment.authorName,
        text: comment.text,
        createdAt: comment.createdAt
      });
    } catch (error) {
      console.error('Error creating comment:', error);
      return res.status(500).json({ message: 'Ett fel uppstod vid skapande av kommentar' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
```

---

## 8. pages/api/votes.js

```javascript
import { getSession } from 'next-auth/react';
import connectDB from '../../lib/mongodb';
import { FinalVote } from '../../lib/models';

export default async function handler(req, res) {
  await connectDB();

  if (req.method === 'POST') {
    const session = await getSession({ req });
    
    if (!session) {
      return res.status(401).json({ message: 'Du måste vara inloggad' });
    }

    const { proposalId, choice } = req.body;

    if (!proposalId || !choice) {
      return res.status(400).json({ message: 'Proposal ID och val krävs' });
    }

    if (!['yes', 'no'].includes(choice)) {
      return res.status(400).json({ message: 'Val måste vara "yes" eller "no"' });
    }

    try {
      const existingVote = await FinalVote.findOne({
        proposalId,
        userId: session.user.id
      });

      if (existingVote) {
        return res.status(400).json({ message: 'Du har redan röstat på detta förslag' });
      }

      await FinalVote.create({
        proposalId,
        userId: session.user.id,
        choice
      });

      const yesCount = await FinalVote.countDocuments({ proposalId, choice: 'yes' });
      const noCount = await FinalVote.countDocuments({ proposalId, choice: 'no' });

      return res.status(201).json({
        message: 'Röst registrerad',
        results: {
          yes: yesCount,
          no: noCount,
          total: yesCount + noCount
        }
      });
    } catch (error) {
      console.error('Error creating vote:', error);
      return res.status(500).json({ message: 'Ett fel uppstod' });
    }
  }

  if (req.method === 'GET') {
    const { proposalId, userId } = req.query;

    if (proposalId) {
      try {
        const yesCount = await FinalVote.countDocuments({ proposalId, choice: 'yes' });
        const noCount = await FinalVote.countDocuments({ proposalId, choice: 'no' });

        let hasVoted = false;
        if (userId) {
          hasVoted = await FinalVote.exists({ proposalId, userId });
        }

        return res.status(200).json({
          yes: yesCount,
          no: noCount,
          total: yesCount + noCount,
          hasVoted: !!hasVoted
        });
      } catch (error) {
        console.error('Error fetching vote results:', error);
        return res.status(500).json({ message: 'Ett fel uppstod' });
      }
    }

    return res.status(400).json({ message: 'Proposal ID krävs' });
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
```

---

## 9. pages/api/user/activity.js

```javascript
import { getSession } from 'next-auth/react';
import connectDB from '../../../lib/mongodb';
import { Proposal, ThumbsUp, Comment, FinalVote } from '../../../lib/models';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const session = await getSession({ req });
  
  if (!session) {
    return res.status(401).json({ message: 'Du måste vara inloggad' });
  }

  await connectDB();

  try {
    const userId = session.user.id;

    const myProposals = await Proposal.find({ authorId: userId })
      .sort({ createdAt: -1 })
      .lean();

    const myThumbsUps = await ThumbsUp.find({ userId })
      .populate('proposalId')
      .sort({ createdAt: -1 })
      .lean();

    const myComments = await Comment.find({ userId })
      .populate('proposalId')
      .sort({ createdAt: -1 })
      .lean();

    const myVotes = await FinalVote.find({ userId })
      .populate('proposalId')
      .sort({ createdAt: -1 })
      .lean();

    const activity = {
      proposals: myProposals.map(p => ({
        _id: p._id.toString(),
        title: p.title,
        description: p.description,
        status: p.status,
        thumbsUpCount: p.thumbsUpCount,
        createdAt: p.createdAt
      })),
      thumbsUps: myThumbsUps
        .filter(t => t.proposalId)
        .map(t => ({
          _id: t._id.toString(),
          proposalTitle: t.proposalId.title,
          proposalId: t.proposalId._id.toString(),
          createdAt: t.createdAt
        })),
      comments: myComments
        .filter(c => c.proposalId)
        .map(c => ({
          _id: c._id.toString(),
          text: c.text,
          proposalTitle: c.proposalId.title,
          proposalId: c.proposalId._id.toString(),
          createdAt: c.createdAt
        })),
      finalVotes: myVotes
        .filter(v => v.proposalId)
        .map(v => ({
          _id: v._id.toString(),
          choice: v.choice,
          proposalTitle: v.proposalId.title,
          proposalId: v.proposalId._id.toString(),
          createdAt: v.createdAt
        }))
    };

    return res.status(200).json(activity);
  } catch (error) {
    console.error('Error fetching user activity:', error);
    return res.status(500).json({ message: 'Ett fel uppstod' });
  }
}
```

---

I'll continue with the remaining pages in the next artifact...