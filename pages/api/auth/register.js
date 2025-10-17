import bcrypt from "bcryptjs";
import connectDB from "../../../lib/mongodb";
import { User } from "../../../lib/models";

export default async function handler(req, res) {
	if (req.method !== "POST") {
		return res.status(405).json({ message: "Method not allowed" });
	}

	const { name, email, password } = req.body;

	if (!name || !email || !password) {
		return res.status(400).json({ message: "Alla fält måste fyllas i" });
	}

	if (password.length < 6) {
		return res
			.status(400)
			.json({ message: "Lösenordet måste vara minst 6 tecken" });
	}

	try {
		await connectDB();

		const existingUser = await User.findOne({ email });
		if (existingUser) {
			return res
				.status(400)
				.json({ message: "En användare med denna e-post finns redan" });
		}

		const hashedPassword = await bcrypt.hash(password, 10);

		const user = await User.create({
			name,
			email,
			password: hashedPassword,
		});

		return res.status(201).json({
			message: "Användare skapad",
			user: {
				id: user._id.toString(),
				name: user.name,
				email: user.email,
			},
		});
	} catch (error) {
		console.error("Registration error:", error);
		return res
			.status(500)
			.json({ message: "Ett fel uppstod vid registrering" });
	}
}
