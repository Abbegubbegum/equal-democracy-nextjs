import bcrypt from "bcryptjs";
import connectDB from "../../../lib/mongodb";
import { LoginCode } from "../../../lib/models";
import { sendLoginCode } from "../../../lib/email";

function random6() {
	return Math.floor(100000 + Math.random() * 900000).toString();
}

export default async function handler(req, res) {
	if (req.method !== "POST")
		return res.status(405).json({ message: "Method not allowed" });

	const { email, name } = req.body || {};
	if (!email) return res.status(400).json({ message: "E-post krävs" });

	await connectDB();

	// Basic rate-limit: at most 1 active code per email; also delete stale codes
	await LoginCode.deleteMany({
		email: email.toLowerCase(),
		expiresAt: { $lte: new Date() },
	});
	const existingActive = await LoginCode.findOne({
		email: email.toLowerCase(),
		expiresAt: { $gt: new Date() },
	});
	if (existingActive) {
		return res
			.status(200)
			.json({
				ok: true,
				message: "Kod skickad (kontrollera din e-post)",
			});
	}

	const code = random6();
	const codeHash = await bcrypt.hash(code, 10);
	const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

	await LoginCode.create({
		email: email.toLowerCase(),
		codeHash,
		pendingName: name, // used if user is new
		expiresAt,
	});

	try {
		await sendLoginCode(email, code);
	} catch (e) {
		// Clean up if email fails
		await LoginCode.deleteMany({
			email: email.toLowerCase(),
			expiresAt: { $gt: new Date() },
		});
		console.error("sendLoginCode error:", e);
		return res.status(500).json({ message: "Kunde inte skicka kod" });
	}

	return res.status(200).json({ ok: true, message: "Kod skickad" });
}
