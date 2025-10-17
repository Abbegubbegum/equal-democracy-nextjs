# Equal Democracy - Next.js Setup Guide

## Prerequisites

- Node.js 18+ installed
- MongoDB installed locally OR MongoDB Atlas account (cloud)

## Step 1: Project Setup

```bash
# Create new Next.js project
npx create-next-app@latest equal-democracy-nextjs
cd equal-democracy-nextjs

# Install dependencies
npm install next-auth mongodb mongoose bcryptjs lucide-react

# Install dev dependencies
npm install -D @types/bcryptjs
```

## Step 2: Project Structure

Create the following folder structure:

```
equal-democracy-nextjs/
├── lib/
│   ├── mongodb.js
│   └── models.js
├── pages/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── [...nextauth].js
│   │   │   └── register.js
│   │   ├── proposals/
│   │   │   ├── index.js
│   │   │   └── [id].js
│   │   ├── comments.js
│   │   ├── thumbsup.js
│   │   └── votes.js
│   ├── _app.js
│   ├── index.js
│   ├── login.js
│   ├── register.js
│   └── dashboard.js
├── components/
│   └── (your React components)
├── .env.local
└── package.json
```

## Step 3: Environment Variables

Create `.env.local` in the root directory:

```bash
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/equal-democracy

# For MongoDB Atlas (cloud):
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/equal-democracy

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32

NODE_ENV=development
```

Generate NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```

## Step 4: MongoDB Setup

### Option A: Local MongoDB

1. Install MongoDB Community Edition
2. Start MongoDB:
   ```bash
   # macOS/Linux
   mongod --dbpath /path/to/data
   
   # Windows
   "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --dbpath C:\data\db
   ```

### Option B: MongoDB Atlas (Cloud - Recommended for Production)

1. Go to https://www.mongodb.com/cloud/atlas
2. Create free account
3. Create new cluster (free tier available)
4. Create database user
5. Whitelist your IP address (or 0.0.0.0/0 for development)
6. Get connection string and add to `.env.local`

## Step 5: Run the Application

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

Visit http://localhost:3000

## Step 6: Key Features Implemented

### ✅ User Authentication
- Email/password registration
- Secure login with NextAuth.js
- Password hashing with bcrypt

### ✅ Anonymity
- Users see only anonymous names on proposals/comments
- Real user IDs stored separately in database
- Only you can see your own activity history

### ✅ Personal Dashboard
- View all your proposals
- See your thumbs up votes
- Track your comments
- View your final votes

### ✅ Database Persistence
- All activities stored in MongoDB
- Proposals persist across sessions
- Vote counts are accurate and validated
- Comments stored with timestamps

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new user
- `POST /api/auth/signin` - Login
- `POST /api/auth/signout` - Logout

### Proposals
- `GET /api/proposals` - Get all proposals
- `POST /api/proposals` - Create new proposal
- `PATCH /api/proposals` - Update proposal status

### Voting
- `POST /api/thumbsup` - Add thumbs up vote
- `GET /api/thumbsup?proposalId=xxx` - Check if voted
- `POST /api/votes` - Cast final vote (yes/no)
- `GET /api/votes?proposalId=xxx` - Get vote results

### Comments
- `GET /api/comments?proposalId=xxx` - Get comments
- `POST /api/comments` - Add comment

### User Activity
- `GET /api/user/activity` - Get user's activity history

## Security Features

1. **Password Security**: Bcrypt hashing with salt rounds
2. **Session Management**: JWT tokens with 30-day expiry
3. **Protected Routes**: Server-side session validation
4. **Input Validation**: Request body validation on all endpoints
5. **Anonymity**: User IDs not exposed in public responses
6. **Unique Constraints**: Prevent duplicate votes via MongoDB indexes

## Testing Before Election

### Test Checklist
- [ ] Register multiple users
- [ ] Create proposals from different accounts
- [ ] Vote with thumbs up (test limit: 1 per user)
- [ ] Add comments
- [ ] Move top 3 proposals
- [ ] Cast final votes (yes/no)
- [ ] Check personal dashboard
- [ ] Verify anonymity (can't see other users' real info)
- [ ] Test on mobile devices
- [ ] Load test with expected user count

### Deployment Options

**Option 1: Vercel (Recommended)**
- Push code to GitHub
- Import project in Vercel
- Add environment variables
- Deploy automatically

**Option 2: Traditional Hosting**
- VPS (DigitalOcean, Linode, etc.)
- Install Node.js and MongoDB
- Use PM2 for process management
- Set up nginx as reverse proxy

## Monitoring

Monitor these metrics before election:
- User registration rate
- Proposal creation rate
- Vote participation rate
- Database size
- Response times

## Next Steps for Production

1. **Email Verification**: Add email confirmation flow
2. **Rate Limiting**: Prevent spam proposals/votes
3. **Admin Panel**: Moderate content if needed
4. **Analytics**: Track engagement metrics
5. **Backup Strategy**: Daily database backups
6. **Load Testing**: Simulate election day traffic
7. **Mobile App**: Consider React Native version

## Support

For issues during development, check:
- MongoDB connection in logs
- NextAuth configuration
- Environment variables loaded correctly
- Network requests in browser DevTools