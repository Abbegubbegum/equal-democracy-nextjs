import { useState } from "react";

export default function SetSuperadmin() {
	const [result, setResult] = useState(null);
	const [loading, setLoading] = useState(false);

	const handleClick = async () => {
		setLoading(true);
		try {
			const res = await fetch('/api/debug-user', { method: 'POST' });
			const data = await res.json();
			setResult(data);
		} catch (error) {
			setResult({ error: error.message });
		}
		setLoading(false);
	};

	return (
		<div style={{ padding: '40px', fontFamily: 'system-ui' }}>
			<h1>Set Superadmin Status</h1>
			<p>This will set peer.norback@gmail.com as superadmin.</p>

			<button
				onClick={handleClick}
				disabled={loading}
				style={{
					padding: '12px 24px',
					fontSize: '16px',
					backgroundColor: '#0070f3',
					color: 'white',
					border: 'none',
					borderRadius: '6px',
					cursor: loading ? 'not-allowed' : 'pointer'
				}}
			>
				{loading ? 'Setting...' : 'Set as Superadmin'}
			</button>

			{result && (
				<pre style={{
					marginTop: '20px',
					padding: '20px',
					backgroundColor: '#f5f5f5',
					borderRadius: '6px',
					overflow: 'auto'
				}}>
					{JSON.stringify(result, null, 2)}
				</pre>
			)}

			{result && result.message === "Superadmin status set" && (
				<div style={{
					marginTop: '20px',
					padding: '16px',
					backgroundColor: '#d4edda',
					border: '1px solid #c3e6cb',
					borderRadius: '6px',
					color: '#155724'
				}}>
					<strong>Success!</strong> You are now a superadmin.
					<br />
					<strong>Important:</strong> Log out and log back in for the changes to take effect.
				</div>
			)}
		</div>
	);
}
