import crypto from "node:crypto";
import { storageGetSignedUrl } from "./storage.js";
import { ENV } from "./_core/env.js";

type Media = { fileUrl: string; filename: string; mimeType: string; contentId?: string | null; placement: "INLINE" | "ATTACHMENT" };
type SendInput = { from: string; replyTo?: string | null; to: string[]; subject: string; html: string; text?: string; media?: Media[] };
export type SendResult = { ok: true; id: string } | { ok: false; error: string };

function parseSender(from: string): { name?: string; email: string } {
  const match = from.match(/^(.*)<([^<>]+)>\s*$/);
  if (match) return { name: match[1].trim().replace(/^"|"$/g, "") || undefined, email: match[2].trim() };
  return { email: from.trim() };
}

export async function sendEmail(input: SendInput): Promise<SendResult> {
  const apiKey = ENV.brevoApiKey;
  if (!apiKey) return { ok: false, error: "Brevo is not configured. Set BREVO_API_KEY in the deployment environment." };
  if (!input.from || !input.to.length) return { ok: false, error: "Central sender configuration is incomplete." };
  try {
    // Only real (non-inline) attachments go over the wire as base64 — Brevo's
    // transactional API has no CID/inline-image support, so INLINE media is
    // expected to already be a plain hosted <img src> baked into input.html.
    const attachment: { content: string; name: string }[] = [];
    for (const media of (input.media ?? []).filter(m => m.placement === "ATTACHMENT")) {
      const signed = await storageGetSignedUrl(media.fileUrl);
      const file = await fetch(signed);
      if (!file.ok) throw new Error("Attachment could not be loaded");
      attachment.push({ name: media.filename, content: Buffer.from(await file.arrayBuffer()).toString("base64") });
    }
    const sender = parseSender(input.from);
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender,
        to: input.to.map(email => ({ email })),
        replyTo: input.replyTo ? { email: input.replyTo } : undefined,
        subject: input.subject,
        htmlContent: input.html,
        textContent: input.text ?? input.html.replace(/<[^>]+>/g, " "),
        ...(attachment.length ? { attachment } : {}),
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: typeof result.message === "string" ? result.message : "Brevo rejected the message." };
    return { ok: true, id: typeof result.messageId === "string" ? result.messageId : crypto.randomUUID() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not connect to Brevo." };
  }
}

export function escapeHtml(value:string){return value.replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]!))}
export function renderTemplate(source:string,values:Record<string,string|undefined>){return source.replace(/\{\{(firstName|lastName|fullName|school|classLevel|country|email|whatsapp|groupLink|channelLink)\}\}/g,(_,key)=>escapeHtml(values[key]??""))}
export function textToEmailHtml(source:string){return source.split(/\n{2,}/).map(block=>`<p style="margin:0 0 16px;line-height:1.65">${escapeHtml(block).replace(/\n/g,"<br>")}</p>`).join("")}
export const DEFAULT_SUBJECT="🎉 You're in — THE NEXT MIND";
export const DEFAULT_BODY=`🎉 YOU'RE IN!\n\nThank you for completing the steps. Your spot for THE NEXT MIND — AI FOR STUDENTS has been successfully secured.\n\nWelcome to this initiative by Coach Jam Digital Solutions, under the ambition of JAM TO THE WORLD.\n\n👥 JOIN THE OFFICIAL GROUP\n\n👉 {{groupLink}}\n\n📢 OFFICIAL CHANNEL\n\n👉 {{channelLink}}\n\nWelcome to THE NEXT MIND.`;
export const DEFAULT_HTML=(body:string,image=`${ENV.publicAppUrl}/next-mind-logo.png`)=>`<div style="background:#070b14;padding:24px;font-family:Arial,sans-serif;color:#e8eef9"><div style="max-width:620px;margin:auto;background:#0f1726;border:1px solid #263650;border-radius:16px;overflow:hidden"><img src="${image}" alt="THE NEXT MIND — AI for Students" style="display:block;width:100%;max-height:340px;object-fit:cover"><div style="padding:28px">${body}</div></div></div>`;
