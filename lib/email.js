import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_ADDRESS = "Jämlik Demokrati <no-reply@votes.abbegubbegum.dev>";

export async function sendLoginCode(email, code) {
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
	await resend.emails.send({
		to: email,
		from: FROM_ADDRESS,
		subject,
		text,
		html,
	});
}

export async function sendSessionResultsEmail(
	email,
	sessionPlace,
	topProposals
) {
	const subject = `Tack för ditt deltagande i ${sessionPlace}`;

	let proposalsList = "";
	if (topProposals.length > 0) {
		proposalsList = topProposals
			.map(
				(p, i) =>
					`${i + 1}. ${p.title} (${p.yesVotes} ja-röster, ${
						p.noVotes
					} nej-röster)`
			)
			.join("\n");
	} else {
		proposalsList = "Tyvärr nådde inga förslag ja-majoritet denna gång.";
	}

	const text = `Tack för att du har varit med och utvecklat demokratin!

Omgång: ${sessionPlace}

${topProposals.length > 0 ? "Dessa förslag har röstats fram:" : ""}
${proposalsList}

${
	topProposals.length > 0
		? "Om vi vinner valet så lovar vi att lägga fram dessa förslag och ge möjlighet att påverka lokalpolitiken på en helt ny nivå."
		: ""
}

Med vänliga hälsningar,
Jämlik Demokrati
`;

	const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#1e293b">
      <h2 style="color:#1e40af">Tack för ditt deltagande!</h2>
      <p>Tack för att du har varit med och utvecklat demokratin!</p>

      <p><strong>Omgång:</strong> ${sessionPlace}</p>

      ${
			topProposals.length > 0
				? `
        <h3 style="color:#1e40af;margin-top:24px">Dessa förslag har röstats fram:</h3>
        <ol style="margin:16px 0">
          ${topProposals
				.map(
					(p) =>
						`<li style="margin:8px 0"><strong>${p.title}</strong><br/>
              <span style="color:#64748b">${p.yesVotes} ja-röster, ${p.noVotes} nej-röster</span></li>`
				)
				.join("")}
        </ol>
        <p style="margin-top:24px;padding:16px;background:#fef3c7;border-left:4px solid #eab308">
          Om vi vinner valet så lovar vi att lägga fram dessa förslag och ge möjlighet att påverka lokalpolitiken på en helt ny nivå.
        </p>
      `
				: `<p style="color:#64748b">Tyvärr nådde inga förslag ja-majoritet denna gång.</p>`
		}

      <p style="margin-top:32px;color:#64748b">
        Med vänliga hälsningar,<br/>
        <strong>Jämlik Demokrati</strong>
      </p>
    </div>
  `;

	await resend.emails.send({
		to: email,
		from: FROM_ADDRESS,
		subject,
		text,
		html,
	});
}

export async function sendBroadcastEmail(email, subject, message) {
	const text = message;
	const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#1e293b">
      ${message
			.split("\n")
			.map((line) => `<p>${line}</p>`)
			.join("")}

      <p style="margin-top:32px;color:#64748b">
        Med vänliga hälsningar,<br/>
        <strong>Jämlik Demokrati</strong>
      </p>
    </div>
  `;

	await resend.emails.send({
		to: email,
		from: FROM_ADDRESS,
		subject,
		text,
		html,
	});
}
