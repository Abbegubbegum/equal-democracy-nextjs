import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Users, Info } from "lucide-react";

export default function RegisterPage() {
	const router = useRouter();
	const [formData, setFormData] = useState({
		name: "",
		email: "",
		password: "",
		confirmPassword: "",
	});
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleChange = (e) => {
		setFormData({
			...formData,
			[e.target.name]: e.target.value,
		});
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError("");

		if (formData.password !== formData.confirmPassword) {
			setError("Lösenorden matchar inte");
			return;
		}

		if (formData.password.length < 6) {
			setError("Lösenordet måste vara minst 6 tecken");
			return;
		}

		setLoading(true);

		try {
			const res = await fetch("/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: formData.name,
					email: formData.email,
					password: formData.password,
				}),
			});

			const data = await res.json();

			if (res.ok) {
				router.push("/login?registered=true");
			} else {
				setError(data.message || "Ett fel uppstod vid registrering");
			}
		} catch (error) {
			setError("Ett fel uppstod vid registrering");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex flex-col items-center justify-center p-6">
			<div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 space-y-6">
				<div className="text-center space-y-2">
					<div className="w-20 h-20 bg-yellow-400 rounded-full mx-auto flex items-center justify-center">
						<Users className="w-10 h-10 text-blue-800" />
					</div>
					<h1 className="text-3xl font-bold text-blue-800">
						Equal Democracy
					</h1>
					<p className="text-lg text-gray-600">Skapa ditt konto</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					{error && (
						<div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-red-700 text-sm">
							{error}
						</div>
					)}

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Namn
						</label>
						<input
							type="text"
							name="name"
							value={formData.name}
							onChange={handleChange}
							className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-lg"
							placeholder="Ditt namn"
							required
							autoFocus
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							E-post
						</label>
						<input
							type="email"
							name="email"
							value={formData.email}
							onChange={handleChange}
							className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-lg"
							placeholder="din@email.com"
							required
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Lösenord
						</label>
						<input
							type="password"
							name="password"
							value={formData.password}
							onChange={handleChange}
							className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-lg"
							placeholder="Minst 6 tecken"
							required
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Bekräfta lösenord
						</label>
						<input
							type="password"
							name="confirmPassword"
							value={formData.confirmPassword}
							onChange={handleChange}
							className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-lg"
							placeholder="Ange lösenordet igen"
							required
						/>
					</div>

					<button
						type="submit"
						disabled={loading}
						className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-4 rounded-xl transition-colors text-lg shadow-lg"
					>
						{loading ? "Skapar konto..." : "Skapa konto"}
					</button>
				</form>

				<div className="text-center space-y-3">
					<p className="text-gray-600">
						Har du redan ett konto?{" "}
						<Link
							href="/login"
							className="text-blue-600 hover:text-blue-700 font-medium"
						>
							Logga in här
						</Link>
					</p>

					<Link
						href="/about"
						className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
					>
						<Info className="w-4 h-4" />
						Om Equal Democracy
					</Link>
				</div>
			</div>
		</div>
	);
}
