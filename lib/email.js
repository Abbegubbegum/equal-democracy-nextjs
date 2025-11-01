import { Resend } from "resend";
import { t } from "./locales";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_ADDRESS = "Equal Democracy <no-reply@votes.abbegubbegum.dev>";

/**
 * Send a login code email
 * @param {string} email - Recipient email
 * @param {string} code - 6-digit login code
 * @param {string} language - Language code (sv, en, es, de, sr)
 */
export async function sendLoginCode(email, code, language = "sv") {
	const subject = t(language, "email.loginCode.subject");
	const text = `${t(language, "email.loginCode.yourCode", { code })}\n\n${t(
		language,
		"email.loginCode.codeValid"
	)}`;
	const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5">
      <h2>${t(language, "email.loginCode.title")}</h2>
      <p>${t(language, "email.loginCode.useCodeBelow")}</p>
      <div style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0">${code}</div>
      <p>${t(language, "email.loginCode.ignoreIfNotRequested")}</p>
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

/**
 * Send session results email
 * @param {string} email - Recipient email
 * @param {string} sessionPlace - Session location/name
 * @param {Array} topProposals - Array of {title, yesVotes, noVotes}
 * @param {string} language - Language code (sv, en, es, de, sr)
 */
export async function sendSessionResultsEmail(
	email,
	sessionPlace,
	topProposals,
	language = "sv"
) {
	const subject = t(language, "email.sessionResults.subject", {
		place: sessionPlace,
	});

	let proposalsList = "";
	if (topProposals.length > 0) {
		proposalsList = topProposals
			.map(
				(p, i) =>
					`${i + 1}. ${p.title} (${p.yesVotes} ${t(
						language,
						"email.sessionResults.yesVotes"
					)}, ${p.noVotes} ${t(
						language,
						"email.sessionResults.noVotes"
					)})`
			)
			.join("\n");
	} else {
		proposalsList = t(language, "email.sessionResults.noMajority");
	}

	const text = `${t(language, "email.sessionResults.thankYou")}

${t(language, "email.sessionResults.session", { place: sessionPlace })}

${
	topProposals.length > 0
		? t(language, "email.sessionResults.proposalsVotedThrough")
		: ""
}
${proposalsList}

${
	topProposals.length > 0
		? t(language, "email.sessionResults.electionPromise")
		: ""
}

${t(language, "email.sessionResults.bestRegards")},
Equal Democracy
`;

	const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#1e293b">
      <h2 style="color:#1e40af">${t(
			language,
			"email.sessionResults.thankYou"
		)}</h2>
      <p>${t(language, "email.sessionResults.thankYou")}</p>

      <p><strong>${t(language, "email.sessionResults.session", {
			place: sessionPlace,
		})}</strong></p>

      ${
			topProposals.length > 0
				? `
        <h3 style="color:#1e40af;margin-top:24px">${t(
			language,
			"email.sessionResults.proposalsVotedThrough"
		)}</h3>
        <ol style="margin:16px 0">
          ${topProposals
				.map(
					(p) =>
						`<li style="margin:8px 0"><strong>${
							p.title
						}</strong><br/>
              <span style="color:#64748b">${p.yesVotes} ${t(
							language,
							"email.sessionResults.yesVotes"
						)}, ${p.noVotes} ${t(
							language,
							"email.sessionResults.noVotes"
						)}</span></li>`
				)
				.join("")}
        </ol>
        <p style="margin-top:24px;padding:16px;background:#fef3c7;border-left:4px solid #eab308">
          ${t(language, "email.sessionResults.electionPromise")}
        </p>
      `
				: `<p style="color:#64748b">${t(
						language,
						"email.sessionResults.noMajority"
				  )}</p>`
		}

      <p style="margin-top:32px;color:#64748b">
        ${t(language, "email.sessionResults.bestRegards")},<br/>
        <strong>Equal Democracy</strong>
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

/**
 * Send broadcast email to user
 * @param {string} email - Recipient email
 * @param {string} subject - Email subject
 * @param {string} message - Email message
 * @param {string} language - Language code (sv, en, es, de, sr)
 */
export async function sendBroadcastEmail(
	email,
	subject,
	message,
	language = "sv"
) {
	const text = message;
	const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#1e293b">
      ${message
			.split("\n")
			.map((line) => `<p>${line}</p>`)
			.join("")}

      <p style="margin-top:32px;color:#64748b">
        ${t(language, "email.broadcast.bestRegards")},<br/>
        <strong>Equal Democracy</strong>
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
