import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import connectDB from "../../../lib/mongodb";
import { User, LoginCode } from "../../../lib/models";

export const authOptions = {
	providers: [
		CredentialsProvider({
			name: "Email Code",
			credentials: {
				email: { label: "Email", type: "email" },
				code: { label: "Code", type: "text" },
			},
			async authorize(credentials) {
				try {
					await connectDB();

					const email = credentials?.email?.toLowerCase();
					const code = credentials?.code?.trim();

					if (!email || !code) {
						throw new Error("Vänligen ange e-post och kod");
					}

					// Find active code
					const rec = await LoginCode.findOne({
						email,
						expiresAt: { $gt: new Date() },
					});

					if (!rec) {
						throw new Error("Ogiltig eller utgången kod");
					}

					// throttle attempts
					if (rec.attempts >= 5) {
						await LoginCode.deleteMany({ email });
						throw new Error("För många försök. Begär en ny kod.");
					}

					const ok = await bcrypt.compare(code, rec.codeHash);
					if (!ok) {
						rec.attempts += 1;
						await rec.save();
						throw new Error("Felaktig kod");
					}

					// One-time: consume code
					await LoginCode.deleteMany({ email });

					let user = await User.findOne({ email });

					if (!user) {
						// Use pendingName from the code request or fallback to local-part
						const fallbackName =
							email
								.split("@")[0]
								.replace(/[._-]/g, " ")
								.replace(/\b\w/g, (c) => c.toUpperCase())
								.slice(0, 60) || "Medborgare";

						user = await User.create({
							name: rec.pendingName?.slice(0, 60) || fallbackName,
							email,
							// no password
						});
					} else if (!user.name) {
						// If existing (legacy) user had no name, backfill from pendingName
						if (rec.pendingName) {
							user.name = rec.pendingName.slice(0, 60);
							await user.save();
						}
					}

					return {
						id: user._id.toString(),
						email: user.email,
						name: user.name,
						isAdmin: !!user.isAdmin,
					};
				} catch (error) {
					console.error("Auth error:", error);
					throw error;
				}
			},
		}),
	],
	pages: {
		signIn: "/login",
		signOut: "/login",
		error: "/login",
	},
	callbacks: {
		async jwt({ token, user }) {
			if (user) {
				token.id = user.id;
				token.isAdmin = !!user.isAdmin;
			}
			return token;
		},
		async session({ session, token }) {
			if (token && session.user) {
				session.user.id = token.id;
				session.user.isAdmin = !!token.isAdmin;
			}
			return session;
		},
	},
	session: {
		strategy: "jwt",
		maxAge: 30 * 24 * 60 * 60, // 30 days
	},
	secret: process.env.NEXTAUTH_SECRET,
	debug: process.env.NODE_ENV === "development",
};

export default NextAuth(authOptions);
