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

/**
 * Send admin application notification to superadmins
 * @param {string} email - Superadmin email
 * @param {string} applicantName - Name of applicant
 * @param {string} applicantEmail - Email of applicant
 * @param {string} organization - Applicant's organization
 * @param {number} requestedSessions - Number of sessions requested
 * @param {string} language - Language code (sv, en, es, de, sr)
 */
export async function sendAdminApplicationNotification(
	email,
	applicantName,
	applicantEmail,
	organization,
	requestedSessions,
	language = "sv"
) {
	const subject = t(language, "email.adminApplication.subject");

	const text = `${t(language, "email.adminApplication.newApplication")}

${t(language, "email.adminApplication.applicantName")}: ${applicantName}
${t(language, "email.adminApplication.applicantEmail")}: ${applicantEmail}
${t(language, "email.adminApplication.organization")}: ${organization}
${t(language, "email.adminApplication.requestedSessions")}: ${requestedSessions}

${t(language, "email.adminApplication.reviewPrompt")}

${t(language, "email.adminApplication.bestRegards")},
Equal Democracy
`;

	const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#1e293b">
      <h2 style="color:#1e40af">${t(language, "email.adminApplication.subject")}</h2>
      <p>${t(language, "email.adminApplication.newApplication")}</p>

      <div style="background:#f1f5f9;padding:16px;border-radius:8px;margin:16px 0">
        <p style="margin:4px 0"><strong>${t(language, "email.adminApplication.applicantName")}:</strong> ${applicantName}</p>
        <p style="margin:4px 0"><strong>${t(language, "email.adminApplication.applicantEmail")}:</strong> ${applicantEmail}</p>
        <p style="margin:4px 0"><strong>${t(language, "email.adminApplication.organization")}:</strong> ${organization}</p>
        <p style="margin:4px 0"><strong>${t(language, "email.adminApplication.requestedSessions")}:</strong> ${requestedSessions}</p>
      </div>

      <p>${t(language, "email.adminApplication.reviewPrompt")}</p>

      <p style="margin-top:32px;color:#64748b">
        ${t(language, "email.adminApplication.bestRegards")},<br/>
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
 * Send admin application approval notification to applicant
 * @param {string} email - Applicant email
 * @param {string} name - Applicant name
 * @param {number} sessionLimit - Number of sessions approved
 * @param {string} language - Language code (sv, en, es, de, sr)
 */
export async function sendAdminApprovalNotification(
	email,
	name,
	sessionLimit,
	language = "sv"
) {
	const subject = t(language, "email.adminApproval.subject");

	const text = `${t(language, "email.adminApproval.congratulations", { name })}

${t(language, "email.adminApproval.approved")}
${t(language, "email.adminApproval.sessionLimit", { limit: sessionLimit })}

${t(language, "email.adminApproval.accessInstructions")}

${t(language, "email.adminApproval.bestRegards")},
Equal Democracy
`;

	const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#1e293b">
      <h2 style="color:#16a34a">${t(language, "email.adminApproval.subject")}</h2>
      <p>${t(language, "email.adminApproval.congratulations", { name })}</p>

      <div style="background:#f0fdf4;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #16a34a">
        <p style="margin:4px 0">${t(language, "email.adminApproval.approved")}</p>
        <p style="margin:4px 0"><strong>${t(language, "email.adminApproval.sessionLimit", { limit: sessionLimit })}</strong></p>
      </div>

      <p>${t(language, "email.adminApproval.accessInstructions")}</p>

      <p style="margin-top:32px;color:#64748b">
        ${t(language, "email.adminApproval.bestRegards")},<br/>
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
 * Send admin application denial notification to applicant
 * @param {string} email - Applicant email
 * @param {string} name - Applicant name
 * @param {string} language - Language code (sv, en, es, de, sr)
 */
export async function sendAdminDenialNotification(
	email,
	name,
	language = "sv"
) {
	const subject = t(language, "email.adminDenial.subject");

	const text = `${t(language, "email.adminDenial.greeting", { name })}

${t(language, "email.adminDenial.denied")}

${t(language, "email.adminDenial.explanation")}

${t(language, "email.adminDenial.reapplyInstructions")}

${t(language, "email.adminDenial.bestRegards")},
Equal Democracy
`;

	const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#1e293b">
      <h2 style="color:#dc2626">${t(language, "email.adminDenial.subject")}</h2>
      <p>${t(language, "email.adminDenial.greeting", { name })}</p>

      <div style="background:#fef2f2;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #dc2626">
        <p style="margin:4px 0">${t(language, "email.adminDenial.denied")}</p>
      </div>

      <p>${t(language, "email.adminDenial.explanation")}</p>
      <p>${t(language, "email.adminDenial.reapplyInstructions")}</p>

      <p style="margin-top:32px;color:#64748b">
        ${t(language, "email.adminDenial.bestRegards")},<br/>
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
