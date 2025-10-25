import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import connectDB from "../../../lib/mongodb";
import { User } from "../../../lib/models";

export const authOptions = {
	providers: [
		CredentialsProvider({
			name: "Credentials",
			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Password", type: "password" },
			},
			async authorize(credentials) {
				try {
					await connectDB();

					if (!credentials?.email || !credentials?.password) {
						throw new Error("Vänligen ange e-post och lösenord");
					}

					const user = await User.findOne({
						email: credentials.email,
					});

					if (!user) {
						throw new Error(
							"Ingen användare hittades med denna e-post"
						);
					}

					const isPasswordValid = await bcrypt.compare(
						credentials.password,
						user.password
					);

					if (!isPasswordValid) {
						throw new Error("Felaktigt lösenord");
					}

					console.log("AUTH: %b", user.isAdmin);

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
