import mongoose from "mongoose";

// User Model
const UserSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: [true, "Please provide a name"],
			maxlength: [60, "Name cannot be more than 60 characters"],
		},
		email: {
			type: String,
			required: [true, "Please provide an email"],
			unique: true,
			lowercase: true,
			match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
		},
		password: {
			type: String,
			required: false,
			minlength: [6, "Password must be at least 6 characters"],
		},
		createdAt: {
			type: Date,
			default: Date.now,
		},
		isAdmin: {
			type: Boolean,
			default: false,
			index: true,
		},
	},
	{
		timestamps: true,
	}
);

const LoginCodeSchema = new mongoose.Schema(
	{
		email: { type: String, index: true, required: true, lowercase: true },
		codeHash: { type: String, required: true },
		// Optional: keep intended name for first-time users (set during verify)
		pendingName: { type: String },
		// Basic throttling
		attempts: { type: Number, default: 0 },
		// Auto-expire after 10 min via TTL index
		expiresAt: { type: Date, required: true, index: { expires: 0 } },
		createdAt: { type: Date, default: Date.now },
	},
	{ timestamps: true }
);

// Proposal Model
const ProposalSchema = new mongoose.Schema(
	{
		sessionId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Session",
			required: true,
			index: true,
		},
		title: {
			type: String,
			required: [true, "Please provide a title"],
			maxlength: [200, "Title cannot be more than 200 characters"],
		},
		problem: {
			type: String,
			required: [true, "Please describe the problem"],
			maxlength: [
				1000,
				"Problem description cannot be more than 1000 characters",
			],
		},
		solution: {
			type: String,
			required: [true, "Please describe the solution"],
			maxlength: [
				1000,
				"Solution description cannot be more than 1000 characters",
			],
		},
		estimatedCost: {
			type: String,
			required: [true, "Please provide an estimated cost"],
			maxlength: [
				100,
				"Cost estimate cannot be more than 100 characters",
			],
		},
		// Legacy field for backwards compatibility
		description: {
			type: String,
			maxlength: [
				2000,
				"Description cannot be more than 2000 characters",
			],
		},
		authorId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		authorName: {
			type: String,
			required: true,
		},
		status: {
			type: String,
			enum: ["active", "top3", "archived"],
			default: "active",
		},
		thumbsUpCount: {
			type: Number,
			default: 0,
		},
		averageRating: {
			type: Number,
			default: 0,
			min: 0,
			max: 5,
		},
		createdAt: {
			type: Date,
			default: Date.now,
		},
	},
	{
		timestamps: true,
	}
);

// ThumbsUp Model (now supports 1-5 star rating)
const ThumbsUpSchema = new mongoose.Schema(
	{
		sessionId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Session",
			required: true,
			index: true,
		},
		proposalId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Proposal",
			required: true,
		},
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		rating: {
			type: Number,
			required: true,
			min: 1,
			max: 5,
			default: 5,
		},
		createdAt: {
			type: Date,
			default: Date.now,
		},
	},
	{
		timestamps: true,
	}
);

ThumbsUpSchema.index({ proposalId: 1, userId: 1 }, { unique: true });

// Comment Model (supports for/against/neutral)
const CommentSchema = new mongoose.Schema(
	{
		sessionId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Session",
			required: true,
			index: true,
		},
		proposalId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Proposal",
			required: true,
		},
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		authorName: {
			type: String,
			required: true,
		},
		text: {
			type: String,
			required: [true, "Please provide comment text"],
			maxlength: [1000, "Comment cannot be more than 1000 characters"],
		},
		type: {
			type: String,
			enum: ["for", "against", "neutral"],
			default: "neutral",
		},
		averageRating: {
			type: Number,
			default: 0,
			min: 0,
			max: 5,
		},
		createdAt: {
			type: Date,
			default: Date.now,
		},
	},
	{
		timestamps: true,
	}
);

// CommentRating Model - for rating comments/arguments (similar to ThumbsUp for proposals)
const CommentRatingSchema = new mongoose.Schema(
	{
		sessionId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Session",
			required: true,
			index: true,
		},
		commentId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Comment",
			required: true,
		},
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		rating: {
			type: Number,
			required: true,
			min: 1,
			max: 5,
		},
		createdAt: {
			type: Date,
			default: Date.now,
		},
	},
	{
		timestamps: true,
	}
);

// Add index for efficient sorting by rating
CommentSchema.index({ averageRating: -1, createdAt: -1 });

CommentRatingSchema.index({ commentId: 1, userId: 1 }, { unique: true });

// FinalVote Model
const FinalVoteSchema = new mongoose.Schema(
	{
		sessionId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Session",
			required: true,
			index: true,
		},
		proposalId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Proposal",
			required: true,
		},
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		choice: {
			type: String,
			enum: ["yes", "no"],
			required: true,
		},
		createdAt: {
			type: Date,
			default: Date.now,
		},
	},
	{
		timestamps: true,
	}
);

FinalVoteSchema.index({ proposalId: 1, userId: 1 }, { unique: true });

// Session Model - represents a voting round/session
const SessionSchema = new mongoose.Schema(
	{
		place: {
			type: String,
			required: true,
			maxlength: [100, "Place name cannot be more than 100 characters"],
		},
		status: {
			type: String,
			enum: ["active", "closed"],
			default: "active",
			index: true,
		},
		phase: {
			type: String,
			enum: ["phase1", "phase2", "closed"],
			default: "phase1",
			index: true,
		},
		activeUsers: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
			},
		],
		phase1TransitionScheduled: {
			type: Date,
		},
		startDate: {
			type: Date,
			default: Date.now,
		},
		phase2StartTime: {
			type: Date,
		},
		endDate: {
			type: Date,
		},
		createdAt: {
			type: Date,
			default: Date.now,
		},
	},
	{
		timestamps: true,
	}
);

// TopProposal Model - winning proposals from closed sessions (top3 with yes-majority)
const TopProposalSchema = new mongoose.Schema(
	{
		sessionId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Session",
			required: true,
		},
		sessionPlace: {
			type: String,
			required: true,
		},
		sessionStartDate: {
			type: Date,
			required: true,
		},
		proposalId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Proposal",
			required: true,
		},
		title: {
			type: String,
			required: true,
		},
		problem: {
			type: String,
			required: true,
		},
		solution: {
			type: String,
			required: true,
		},
		estimatedCost: {
			type: String,
			required: true,
		},
		// Legacy field
		description: {
			type: String,
		},
		authorName: {
			type: String,
			required: true,
		},
		yesVotes: {
			type: Number,
			required: true,
		},
		noVotes: {
			type: Number,
			required: true,
		},
		archivedAt: {
			type: Date,
			default: Date.now,
		},
	},
	{
		timestamps: true,
	}
);

// Settings Model - for global settings
const SettingsSchema = new mongoose.Schema(
	{
		language: {
			type: String,
			enum: ["sv", "en", "sr", "es", "de"],
			default: "sv",
		},
		theme: {
			type: String,
			enum: ["default", "green", "red"],
			default: "default",
		},
		phase2DurationHours: {
			type: Number,
			default: 6,
			min: 1,
			max: 168, // Max 1 week
		},
		updatedAt: {
			type: Date,
			default: Date.now,
		},
	},
	{
		timestamps: true,
	}
);

// Export models
export const User = mongoose.models.User || mongoose.model("User", UserSchema);
export const Proposal =
	mongoose.models.Proposal || mongoose.model("Proposal", ProposalSchema);
export const ThumbsUp =
	mongoose.models.ThumbsUp || mongoose.model("ThumbsUp", ThumbsUpSchema);
export const Comment =
	mongoose.models.Comment || mongoose.model("Comment", CommentSchema);
export const CommentRating =
	mongoose.models.CommentRating ||
	mongoose.model("CommentRating", CommentRatingSchema);
export const FinalVote =
	mongoose.models.FinalVote || mongoose.model("FinalVote", FinalVoteSchema);

export const LoginCode =
	mongoose.models.LoginCode || mongoose.model("LoginCode", LoginCodeSchema);

export const Settings =
	mongoose.models.Settings || mongoose.model("Settings", SettingsSchema);

export const Session =
	mongoose.models.Session || mongoose.model("Session", SessionSchema);

export const TopProposal =
	mongoose.models.TopProposal ||
	mongoose.model("TopProposal", TopProposalSchema);
