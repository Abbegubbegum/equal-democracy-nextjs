import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendLoginCode(email, code) {
	const from = "Equal Democracy <no-reply@votes.abbegubbegum.dev>";
	const subject = "Din engångskod för inloggning";
	const text = `Din kod är: ${code}\n\nKoden är giltig i 10 minuter. Om du inte begärt denna kod kan du ignorera detta mail.`;
	const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5">
      <h2>Din inloggningskod</h2>
      <p>Använd koden nedan för att logga in. Den gäller i 10 minuter.</p>
      <div style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0">${code}</div>
      <p>Om du inte begärt koden kan du ignorera detta meddelande.</p>
    </div>
  `;
	await resend.emails.send({ to: email, from, subject, text, html });
}
