/**
 * Script to set the application language to Swedish
 */

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

// Load environment variables manually from .env.local
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
	const envContent = fs.readFileSync(envPath, "utf-8");
	envContent.split("\n").forEach((line) => {
		const trimmed = line.trim();
		if (trimmed && !trimmed.startsWith("#")) {
			const [key, ...valueParts] = trimmed.split("=");
			if (key && valueParts.length > 0) {
				process.env[key.trim()] = valueParts.join("=").trim();
			}
		}
	});
}

const settingsSchema = new mongoose.Schema({
	sessionLimitHours: Number,
	language: String,
	theme: String,
	municipalityName: String,
});

const Settings = mongoose.models.Settings || mongoose.model("Settings", settingsSchema);

async function setLanguageToSwedish() {
	try {
		// Connect to MongoDB
		const mongoUri = process.env.MONGODB_URI;
		if (!mongoUri) {
			console.error("❌ MONGODB_URI not found in environment variables");
			process.exit(1);
		}

		console.log("🔗 Connecting to MongoDB...");
		await mongoose.connect(mongoUri);
		console.log("✅ Connected to MongoDB");

		// Update or create settings
		const result = await Settings.findOneAndUpdate(
			{},
			{ language: "sv" },
			{ upsert: true, new: true }
		);

		console.log("✅ Language updated to Swedish (sv)");
		console.log("📝 Current settings:", result);

		await mongoose.connection.close();
		console.log("✅ Done! Please refresh your browser to see the changes.");
	} catch (error) {
		console.error("❌ Error:", error);
		process.exit(1);
	}
}

setLanguageToSwedish();
