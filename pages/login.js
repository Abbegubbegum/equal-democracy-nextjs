import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Users, Info } from "lucide-react";
import { useTranslation } from "../lib/hooks/useTranslation";
import { useConfig } from "../lib/contexts/ConfigContext";

export default function LoginPage() {
	const router = useRouter();
	const { t } = useTranslation();
	const { config } = useConfig();
	const [step, setStep] = useState("email"); // 'email' | 'code'
	const [email, setEmail] = useState("");
	const [code, setCode] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [info, setInfo] = useState("");

	async function requestCode(e) {
		e.preventDefault();
		setError("");
		setInfo("");
		setLoading(true);
		try {
			const res = await fetch("/api/auth/request-code", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email }),
			});
			const data = await res.json();
			if (!res.ok)
				throw new Error(data.message || t("login.couldNotSendCode"));
			setInfo(t("login.codeSent"));
			setStep("code");
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	}

	async function verifyCode(e) {
		e.preventDefault();
		setError("");
		setLoading(true);
		try {
			const result = await signIn("credentials", {
				email,
				code,
				redirect: false,
			});
			if (result?.error) throw new Error(result.error);
			router.push("/");
		} catch (err) {
			setError(err.message || t("login.loginError"));
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="min-h-screen bg-linear-to-br from-blue-600 to-blue-800 flex flex-col items-center justify-center p-6">
			<div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 space-y-6">
				<div className="text-center space-y-2">
					<div className="w-20 h-20 bg-yellow-400 rounded-full mx-auto flex items-center justify-center">
						<Users className="w-10 h-10 text-blue-800" />
					</div>
					<h1 className="text-3xl font-bold text-blue-800">
						{t("appName")}
					</h1>
					<p className="text-lg text-gray-600">
						{t("login.subtitle")}
					</p>
				</div>

				{step === "email" && (
					<form onSubmit={requestCode} className="space-y-4">
						{error && (
							<div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-red-700 text-sm">
								{error}
							</div>
						)}
						{info && (
							<div className="bg-green-50 border-2 border-green-200 rounded-xl p-3 text-green-700 text-sm">
								{info}
							</div>
						)}

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								{t("login.email")}
							</label>
							<input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-lg"
								placeholder={t("login.emailPlaceholder")}
								required
								autoFocus
							/>
						</div>

						<button
							type="submit"
							disabled={loading}
							className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-4 rounded-xl transition-colors text-lg shadow-lg"
						>
							{loading ? t("login.sending") : t("login.sendCode")}
						</button>
					</form>
				)}

				{step === "code" && (
					<form onSubmit={verifyCode} className="space-y-4">
						{error && (
							<div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-red-700 text-sm">
								{error}
							</div>
						)}

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								{t("login.code")}
							</label>
							<input
								inputMode="numeric"
								pattern="\d{6}"
								maxLength={6}
								value={code}
								onChange={(e) =>
									setCode(e.target.value.replace(/\D/g, ""))
								}
								className="w-full tracking-widest text-center text-2xl px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
								placeholder="••••••"
								required
								autoFocus
							/>
							<p className="text-xs text-gray-500 mt-2">
								{t("login.codeSentTo")}{" "}
								<span className="font-medium">{email}</span>
							</p>
						</div>

						<button
							type="submit"
							disabled={loading || code.length !== 6}
							className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-4 rounded-xl transition-colors text-lg shadow-lg"
						>
							{loading ? t("login.verifying") : t("login.login")}
						</button>

						<button
							type="button"
							onClick={() => setStep("email")}
							className="w-full text-blue-600 hover:text-blue-700 font-medium"
						>
							{t("login.changeEmail")}
						</button>
					</form>
				)}

				<div className="text-center space-y-3">
					<p className="text-gray-600">
						{t("login.newHere")}{" "}
						<Link
							href="/register"
							className="text-blue-600 hover:text-blue-700 font-medium"
						>
							{t("login.createAccount")}
						</Link>
					</p>
					<Link
						href="/about"
						className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
					>
						<Info className="w-4 h-4" /> {t("login.aboutLink")}
					</Link>
				</div>
			</div>
		</div>
	);
}
