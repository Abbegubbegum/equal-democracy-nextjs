import { getServerSession } from "next-auth/next";
import { authOptions } from "../pages/api/auth/[...nextauth]";

export async function requireAdmin(req, res) {
	const session = await getServerSession(req, res, authOptions);
	if (!session) {
		res.status(401).json({ message: "Du måste vara inloggad" });
		return null;
	}
	if (!session.user?.isAdmin) {
		res.status(403).json({
			message: "Endast administratörer har behörighet",
		});
		return null;
	}
	return session;
}
