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
		title: {
			type: String,
			required: [true, "Please provide a title"],
			maxlength: [200, "Title cannot be more than 200 characters"],
		},
		description: {
			type: String,
			required: [true, "Please provide a description"],
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
		createdAt: {
			type: Date,
			default: Date.now,
		},
	},
	{
		timestamps: true,
	}
);

// ThumbsUp Model
const ThumbsUpSchema = new mongoose.Schema(
	{
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

// Comment Model
const CommentSchema = new mongoose.Schema(
	{
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
		createdAt: {
			type: Date,
			default: Date.now,
		},
	},
	{
		timestamps: true,
	}
);

// FinalVote Model
const FinalVoteSchema = new mongoose.Schema(
	{
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

// Settings Model - for municipality name and other global settings
const SettingsSchema = new mongoose.Schema(
	{
		municipalityName: {
			type: String,
			required: true,
			default: "Vallentuna",
			maxlength: [100, "Municipality name cannot be more than 100 characters"],
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
export const FinalVote =
	mongoose.models.FinalVote || mongoose.model("FinalVote", FinalVoteSchema);

export const LoginCode =
	mongoose.models.LoginCode || mongoose.model("LoginCode", LoginCodeSchema);

export const Settings =
	mongoose.models.Settings || mongoose.model("Settings", SettingsSchema);
