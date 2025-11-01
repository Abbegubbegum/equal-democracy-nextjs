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
						throw new Error("Please enter an email and code");
					}

					// Find active code
					const rec = await LoginCode.findOne({
						email,
						expiresAt: { $gt: new Date() },
					});

					if (!rec) {
						throw new Error("Code is invalid or expired");
					}

					// throttle attempts
					if (rec.attempts >= 5) {
						await LoginCode.deleteMany({ email });
						throw new Error(
							"To many failed attemps, request a new code."
						);
					}

					const ok = await bcrypt.compare(code, rec.codeHash);
					if (!ok) {
						rec.attempts += 1;
						await rec.save();
						throw new Error("Code is invalid");
					}

					// One-time: consume code
					await LoginCode.deleteMany({ email });

					let user = await User.findOne({ email });

					if (!user) {
						const name =
							email
								.split("@")[0]
								.replace(/[._-]/g, " ")
								.replace(/\b\w/g, (c) => c.toUpperCase())
								.slice(0, 60) || "Citizen";

						user = await User.create({
							name: name,
							email,
							// no password
						});
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
