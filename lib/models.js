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
		isSuperAdmin: {
			type: Boolean,
			default: false,
			index: true,
		},
		adminStatus: {
			type: String,
			enum: ["none", "pending", "approved", "denied"],
			default: "none",
			index: true,
		},
		sessionLimit: {
			type: Number,
			default: 10,
			min: 1,
			max: 50,
		},
		remainingSessions: {
			type: Number,
			default: 10,
			min: 0,
			max: 50,
		},
		appliedForAdminAt: {
			type: Date,
		},
		organization: {
			type: String,
		},
		requestedSessions: {
			type: Number,
			min: 1,
			max: 50,
		},
		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
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
		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			index: true,
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
			enum: ["default", "green", "red", "blue"],
			default: "default",
		},
		sessionLimitHours: {
			type: Number,
			default: 24,
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

// SessionRequest Model - for existing admins requesting more sessions
const SessionRequestSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		requestedSessions: {
			type: Number,
			required: true,
			min: 1,
			max: 50,
		},
		status: {
			type: String,
			enum: ["pending", "approved", "denied"],
			default: "pending",
			index: true,
		},
		createdAt: {
			type: Date,
			default: Date.now,
		},
		processedAt: {
			type: Date,
		},
		processedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
	},
	{
		timestamps: true,
	}
);

// BudgetSession Model - represents a budget voting session
const BudgetSessionSchema = new mongoose.Schema(
	{
		sessionId: {
			type: String,
			required: true,
			unique: true,
			index: true,
		},
		name: {
			type: String,
			required: [true, "Please provide a session name"],
			maxlength: [200, "Session name cannot be more than 200 characters"],
		},
		municipality: {
			type: String,
			required: [true, "Please provide a municipality name"],
			maxlength: [100, "Municipality name cannot be more than 100 characters"],
		},
		totalBudget: {
			type: Number,
			required: true,
			min: 0,
		},
		status: {
			type: String,
			enum: ["draft", "active", "closed"],
			default: "draft",
			index: true,
		},
		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		startDate: {
			type: Date,
		},
		endDate: {
			type: Date,
		},
		// Tax base for calculating tax income (e.g., population × 1000 kr)
		// For 2025 Vallentuna: 19 kr = 2135.3 mnkr, so taxBase = 112,384,210
		taxBase: {
			type: Number,
			min: 0,
		},
		defaultTaxRateKr: {
			type: Number,
			default: 19,
		},
		minTaxRateKr: {
			type: Number,
			default: 18,
		},
		maxTaxRateKr: {
			type: Number,
			default: 21,
		},
		// Expense categories (nämnder)
		categories: [
			{
				id: {
					type: String,
					required: true,
				},
				name: {
					type: String,
					required: true,
				},
				defaultAmount: {
					type: Number,
					required: true,
					min: 0,
				},
				minAmount: {
					type: Number,
					required: true,
					min: 0,
				},
				isFixed: {
					type: Boolean,
					default: false,
				},
				color: {
					type: String,
					default: "#4a90e2",
				},
				subcategories: [
					{
						id: {
							type: String,
							required: true,
						},
						name: {
							type: String,
							required: true,
						},
						defaultAmount: {
							type: Number,
							required: true,
							min: 0,
						},
						minAmount: {
							type: Number,
							required: true,
							min: 0,
						},
						isFixed: {
							type: Boolean,
							default: false,
						},
					},
				],
			},
		],
		// Income categories (intäkter)
		incomeCategories: [
			{
				id: {
					type: String,
					required: true,
				},
				name: {
					type: String,
					required: true,
				},
				amount: {
					type: Number,
					required: true,
					min: 0,
				},
				color: {
					type: String,
					default: "#6b7280",
				},
				// For tax rate (kommunalskatt)
				isTaxRate: {
					type: Boolean,
					default: false,
				},
				taxRatePercent: {
					type: Number,
					min: 0,
					max: 100,
				},
			},
		],
		createdAt: {
			type: Date,
			default: Date.now,
		},
	},
	{
		timestamps: true,
	}
);

// BudgetVote Model - individual participant's budget proposal
const BudgetVoteSchema = new mongoose.Schema(
	{
		sessionId: {
			type: String,
			required: true,
			index: true,
		},
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		// Expense allocations
		allocations: [
			{
				categoryId: {
					type: String,
					required: true,
				},
				amount: {
					type: Number,
					required: true,
					min: 0,
				},
				subcategories: [
					{
						subcategoryId: {
							type: String,
							required: true,
						},
						amount: {
							type: Number,
							required: true,
							min: 0,
						},
					},
				],
			},
		],
		// Income allocations
		incomeAllocations: [
			{
				categoryId: {
					type: String,
					required: true,
				},
				amount: {
					type: Number,
					required: true,
					min: 0,
				},
				// For tax rate
				taxRatePercent: {
					type: Number,
					min: 0,
					max: 100,
				},
			},
		],
		totalExpenses: {
			type: Number,
			required: true,
			min: 0,
		},
		totalIncome: {
			type: Number,
			required: true,
			min: 0,
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

// Ensure one vote per user per session
BudgetVoteSchema.index({ sessionId: 1, userId: 1 }, { unique: true });

// BudgetResult Model - calculated median budget
const BudgetResultSchema = new mongoose.Schema(
	{
		sessionId: {
			type: String,
			required: true,
			unique: true,
			index: true,
		},
		// Median expense allocations
		medianAllocations: [
			{
				categoryId: {
					type: String,
					required: true,
				},
				medianAmount: {
					type: Number,
					required: true,
					min: 0,
				},
				percentageOfTotal: {
					type: Number,
					required: true,
					min: 0,
					max: 100,
				},
				subcategories: [
					{
						subcategoryId: {
							type: String,
							required: true,
						},
						medianAmount: {
							type: Number,
							required: true,
							min: 0,
						},
						percentageOfCategory: {
							type: Number,
							required: true,
							min: 0,
							max: 100,
						},
					},
				],
			},
		],
		// Median income allocations
		medianIncomeAllocations: [
			{
				categoryId: {
					type: String,
					required: true,
				},
				medianAmount: {
					type: Number,
					required: true,
					min: 0,
				},
				// For tax rate
				medianTaxRatePercent: {
					type: Number,
					min: 0,
					max: 100,
				},
			},
		],
		totalMedianExpenses: {
			type: Number,
			required: true,
			min: 0,
		},
		totalMedianIncome: {
			type: Number,
			required: true,
			min: 0,
		},
		// After balancing expenses to match income
		balancedExpenses: {
			type: Number,
			required: true,
			min: 0,
		},
		voterCount: {
			type: Number,
			required: true,
			min: 0,
		},
		calculatedAt: {
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

// Force delete cached model to ensure schema updates are applied
if (mongoose.models.Settings) {
	delete mongoose.models.Settings;
}
export const Settings = mongoose.model("Settings", SettingsSchema);

export const Session =
	mongoose.models.Session || mongoose.model("Session", SessionSchema);

export const TopProposal =
	mongoose.models.TopProposal ||
	mongoose.model("TopProposal", TopProposalSchema);

export const SessionRequest =
	mongoose.models.SessionRequest ||
	mongoose.model("SessionRequest", SessionRequestSchema);

export const BudgetSession =
	mongoose.models.BudgetSession ||
	mongoose.model("BudgetSession", BudgetSessionSchema);

export const BudgetVote =
	mongoose.models.BudgetVote ||
	mongoose.model("BudgetVote", BudgetVoteSchema);

export const BudgetResult =
	mongoose.models.BudgetResult ||
	mongoose.model("BudgetResult", BudgetResultSchema);
