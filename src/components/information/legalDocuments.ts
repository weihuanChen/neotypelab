import type { AppPath } from "@/src/lib/appPaths";
import { appPaths } from "@/src/lib/appPaths";
import { aiModelDisclosure } from "@/src/lib/aiDisclosure";

export type LegalDocumentId = "terms" | "privacy" | "acceptable-use";

const { image: imageModel, text: textModel, safety: safetyProvider } = aiModelDisclosure;

export type LegalDocumentSection = {
  title: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
};

export type LegalDocument = {
  id: LegalDocumentId;
  number: string;
  title: string;
  summary: string;
  updatedLabel: string;
  effectiveLabel: string;
  href: AppPath;
  sections: readonly LegalDocumentSection[];
};

/** Catalog for /legal. Add Cookie / Copyright here later. */
export const legalDocuments: readonly LegalDocument[] = [
  {
    id: "terms",
    number: "01",
    title: "Terms of Service",
    summary: "Rules for planning spray-ready Gunpla and mecha paint schemes on NeotypeLab.",
    updatedLabel: "Updated Oct 8, 2026",
    effectiveLabel: "Effective Sep 22, 2026",
    href: appPaths.legalTerms,
    sections: [
      {
        title: "Agreement to these Terms",
        paragraphs: [
          "These Terms of Service govern your access to and use of the NeotypeLab websites, applications, generation tools, public showcases, libraries, paint-planning features, and related services (collectively, the “Service”). “NeotypeLab,” “we,” “us,” and “our” refer to the operator of the Service.",
          "By creating an account, purchasing Credits or a subscription, or otherwise using the Service, you agree to these Terms and our Privacy Policy. If you use the Service on behalf of an organization, you represent that you have authority to bind that organization. If you do not agree, do not use the Service.",
        ],
      },
      {
        title: "Eligibility",
        paragraphs: [
          "You must be at least 16 years old and legally able to enter into this agreement. If you are under the age of legal majority where you live, a parent or legal guardian must review and agree to these Terms and supervise your use. The Service is not directed to children under 16.",
          "You may not use the Service if doing so would violate applicable law, if your account has previously been suspended for serious or repeated violations, or if you are subject to trade restrictions that prohibit your use of the Service.",
        ],
      },
      {
        title: "Accounts and account security",
        paragraphs: [
          "Some features require an account. Authentication is provided through a third-party identity provider. You must provide accurate account information, keep your credentials secure, and promptly notify us if you suspect unauthorized access. You are responsible for activity conducted through your account unless applicable law provides otherwise.",
          "Handles, profile information, and public creator details must not impersonate another person, misrepresent affiliation, or violate another party’s rights. We may reclaim or change a handle when reasonably necessary to address impersonation, infringement, security, or product operation.",
        ],
      },
      {
        title: "What the Service provides",
        paragraphs: [
          "NeotypeLab is a creative planning and visualization service for model-kit repaint concepts. It can help you explore styles, generate visual previews, prepare palette and paint recommendations, organize generated work, and publish selected work to public or unlisted pages.",
          "Generated previews, color simulations, material descriptions, shopping suggestions, and spray plans are creative aids, not guarantees of a physical result. Screens, lighting, substrates, paint batches, tools, technique, and model behavior can change the result. Always follow the paint, solvent, adhesive, tool, and kit manufacturer’s safety instructions. The Service does not provide professional health, safety, engineering, or legal advice.",
          "Features may be experimental or labeled beta. We may add, change, limit, or discontinue features, model providers, catalog entries, quotas, or workflows. We will provide notice when a change materially affects an active paid service where required by law.",
        ],
      },
      {
        title: "Credits, paid plans, and billing",
        paragraphs: [
          "Certain actions consume virtual Credits, including some text interpretation, image generation, rendering, storage, or Original-file retention actions. The price shown before confirmation controls that transaction. Credits are a limited license to use eligible Service features; they are not money, have no cash value, are not transferable, and may not be resold.",
          "Generation and provider costs are incurred when work starts. If a generation reaches a final technical failure under the applicable workflow, the Service may automatically return the displayed generation cost to your Credit balance. A result that is technically completed but does not match a subjective preference is not, by itself, a failed generation.",
          "If paid subscriptions or Credit packs are offered, prices, included entitlements, renewal timing, taxes, and cancellation terms will be disclosed at purchase. Subscriptions renew until canceled as disclosed at checkout. A downgrade or cancellation may take effect at the end of the current billing period, while a refund may end paid entitlements sooner. Except where required by law or expressly stated at purchase, payments and used Credits are non-refundable.",
          "Payment details are handled by the applicable billing provider. You authorize that provider and NeotypeLab to process recurring charges you approve and to exchange billing status, subscription identifiers, plan information, and transaction events needed to administer your purchase.",
        ],
      },
      {
        title: "Your content and the license you give us",
        paragraphs: [
          "“Your Content” means prompts, custom style descriptions, uploaded images, feedback and attachments, profile information, and other material you submit, as well as selections you make for a generated project. As between you and NeotypeLab, you retain the rights you have in Your Content.",
          "You represent that you have all rights, permissions, and lawful bases needed to submit Your Content and to permit the processing described in these Terms. Do not upload confidential information you are not authorized to disclose, personal data about others without a lawful basis, or material that infringes copyright, trademark, privacy, publicity, or other rights.",
          "You grant NeotypeLab a worldwide, non-exclusive, royalty-free license to host, store, reproduce, adapt, transmit, and otherwise process Your Content only as needed to operate, secure, support, and improve the Service; follow your instructions; enforce these Terms; and comply with law. This license includes sending relevant prompts, specifications, and input files to configured generation providers to produce requested results.",
          "When you deliberately publish content as public or unlisted, you also permit us to display, distribute, index where applicable, cache, format, and make that content available through sharing, discovery, and remix-entry features. You can withdraw an active publication through available controls. Removal may take time to propagate through caches, search engines, backups, or copies and derivative projects lawfully created by other users before withdrawal.",
        ],
      },
      {
        title: "Generated content and intellectual-property risk",
        paragraphs: [
          "Subject to these Terms and any third-party rights, NeotypeLab does not claim ownership of the output generated specifically for you. To the extent NeotypeLab has rights in that output, we assign those rights to you upon successful completion of the applicable transaction. This does not transfer rights owned by another person and does not make third-party material yours.",
          "Generative systems can produce similar or identical results for different users, reproduce familiar visual elements, or respond unpredictably to references. We do not guarantee that an output is unique, copyrightable, available for trademark registration, accurate, or non-infringing. You are responsible for reviewing outputs and obtaining any clearance needed before publishing, selling, advertising, manufacturing from, or otherwise exploiting them.",
          "Do not use the Service to copy protected artwork, packaging, decals, logos, characters, or another creator’s distinctive work unless you have permission or a valid legal basis. Prompts that request “in the style of” a living artist, or that seek a close substitute for a protected work, may be limited or rejected. Removing watermarks, signatures, provenance data, or copyright-management information is prohibited.",
        ],
      },
      {
        title: "Model kits, brands, and reference catalog",
        paragraphs: [
          "The Service may refer to model kits, fictional universes, manufacturers, paint brands, product codes, and other third-party names to identify compatible subjects or materials. Those names, designs, characters, logos, and product images belong to their respective owners. Their appearance does not imply sponsorship, endorsement, licensing, or affiliation with NeotypeLab unless we expressly say so.",
          "Catalog references are intended for identification, comparison, creative commentary, and compatibility planning. You must not use the Service or its outputs in a way that falsely suggests an official product, confuses consumers about source, or exceeds any permission or legal exception available to you.",
        ],
      },
      {
        title: "Acceptable use",
        paragraphs: [
          "You may use the Service only for lawful purposes and in accordance with these Terms and our AI Acceptable Use Policy at neotypelab.com/acceptable-use, which lists prohibited content categories, explains how requests are screened before generation, and describes enforcement, reporting, and appeals. You must not attempt, facilitate, or encourage any of the following:",
        ],
        items: [
          "Infringing intellectual-property, privacy, publicity, contractual, or other rights.",
          "Creating or distributing sexual exploitation material, non-consensual intimate imagery, credible threats, targeted harassment, hateful abuse, or instructions for serious wrongdoing.",
          "Impersonating others, committing fraud, evading sanctions, or misleading people about whether content is authentic, official, or human-made.",
          "Uploading malware, probing security, bypassing access controls or rate limits, scraping protected areas, or interfering with the Service or another user.",
          "Reverse engineering or extracting models, prompts, source material, or non-public datasets except where that restriction is prohibited by law.",
          "Operating automated or high-volume access without our written permission, reselling the Service, brokering accounts or Credits, or using output to train a competing model where prohibited by an applicable provider term.",
        ],
      },
      {
        title: "Public content, moderation, and enforcement",
        paragraphs: [
          "You control whether eligible work is private, unlisted, or public. Unlisted content is accessible to anyone with its link and should not be treated as confidential. Public profiles, prototypes, styles, likes, saves, remix lineage, and creator attribution may be visible to visitors and indexed where the page is designed for discovery.",
          "We may review content and account activity when reasonably necessary to operate the Service, investigate reports, protect users, or comply with law. We may reject generation requests; reduce discovery; remove, withdraw, or disable content; preserve relevant evidence; limit features; or suspend or terminate accounts. We are not obligated to pre-screen all content and cannot guarantee that all objectionable or infringing material will be detected.",
        ],
      },
      {
        title: "Copyright complaints",
        paragraphs: [
          "If you believe material available through the Service infringes your copyright, email hello@neotypelab.com with the subject “Copyright Notice.” Your notice should include:",
        ],
        items: [
          "Your physical or electronic signature and an explanation of your authority to act for the copyright owner.",
          "Identification of the copyrighted work, or a representative list if the notice covers multiple works.",
          "The precise Service URL or other information that lets us locate the allegedly infringing material.",
          "Your name and reasonably sufficient contact information, including an email address.",
          "A statement that you have a good-faith belief the disputed use is not authorized by the copyright owner, its agent, or the law.",
          "A statement that the notice is accurate and, where applicable, made under penalty of perjury, that you are authorized to act for the owner.",
        ],
      },
      {
        title: "Copyright response and repeat infringement",
        paragraphs: [
          "We may forward a complaint to the affected user, remove or disable access to material, request more information, and take other appropriate action. A user who believes content was removed by mistake may contact us with a counter-notice identifying the removed material, its former location, the basis for the objection, consent to the legally required jurisdiction where applicable, and the user’s signature and contact information.",
          "We may terminate accounts of repeat infringers in appropriate circumstances. Knowingly submitting a materially false complaint or counter-notice can create liability. NeotypeLab is not a court and may decline to resolve ownership disputes that require factual or legal determinations beyond a platform review.",
        ],
      },
      {
        title: "Storage, exports, and data loss",
        paragraphs: [
          "Storage limits, Original-file retention periods, maximum export sizes, and download features depend on your active entitlements and are shown in the Service. Some Original files are temporary unless you have permanent Original storage or use an eligible Keep Original action. Optimized library versions may remain available separately from an expired or deleted Original.",
          "You are responsible for downloading and backing up content you need. We use reasonable operational safeguards but do not promise that every file, version, publication, or account record will be stored forever or can be recovered after deletion, expiration, withdrawal, account closure, or a technical incident.",
        ],
      },
      {
        title: "Third-party services",
        paragraphs: [
          `The Service relies on third parties for authentication, hosting, databases, storage, payment processing, email, and AI generation. Images are generated with ${imageModel.model}, developed by ${imageModel.developer} and served through ${imageModel.servedVia}; text is generated with ${textModel.model}, developed by ${textModel.developer}; prompts are screened by ${safetyProvider.service}. Their services and terms may affect feature availability and how they process data. Links, paint listings, product references, or integrations do not constitute our endorsement of a third party, and NeotypeLab is not responsible for third-party products or sites outside our control.`,
        ],
      },
      {
        title: "Suspension, termination, and account closure",
        paragraphs: [
          "You may stop using the Service at any time and may request account closure by emailing hello@neotypelab.com. Before closing an account, export any content you want to keep and cancel active subscriptions through the available billing controls. Account closure does not automatically reverse completed purchases or restore used Credits.",
          "We may suspend or terminate access if you materially or repeatedly breach these Terms, create legal or security risk, fail to pay amounts due, or use the Service in a way that could harm NeotypeLab, its providers, or others. Where appropriate, we will provide notice and an opportunity to appeal. Provisions that by their nature should survive termination—including ownership, licenses already granted for public distribution, payment obligations, disclaimers, liability limits, and dispute terms—will survive.",
        ],
      },
      {
        title: "Disclaimers",
        paragraphs: [
          "To the maximum extent permitted by law, the Service is provided “as is” and “as available.” NeotypeLab disclaims implied warranties of merchantability, fitness for a particular purpose, title, non-infringement, and uninterrupted or error-free operation. We do not warrant the accuracy of generated content, paint matches, catalog data, availability estimates, or third-party information.",
          "Nothing in these Terms excludes a warranty or consumer right that cannot lawfully be excluded. Some jurisdictions do not allow certain disclaimers, so parts of this section may not apply to you.",
        ],
      },
      {
        title: "Limitation of liability",
        paragraphs: [
          "To the maximum extent permitted by law, NeotypeLab and its affiliates, personnel, and suppliers will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, revenues, goodwill, data, or business opportunities arising from or related to the Service, even if advised that such loss was possible.",
          "To the maximum extent permitted by law, our aggregate liability for all claims relating to the Service will not exceed the greater of USD 100 or the amount you paid to NeotypeLab for the Service during the 12 months before the event giving rise to the claim. These limits do not apply to liability that cannot legally be limited, including liability for fraud or willful misconduct where applicable.",
        ],
      },
      {
        title: "Indemnity",
        paragraphs: [
          "If you use the Service for business purposes, or to the extent otherwise permitted by law, you will defend and indemnify NeotypeLab and its affiliates and personnel from third-party claims, losses, and reasonable costs arising from Your Content, your public or commercial use of output, your violation of these Terms, or your infringement of another party’s rights. This obligation does not apply to the extent a claim was caused by NeotypeLab’s own unlawful conduct.",
        ],
      },
      {
        title: "Disputes and applicable law",
        paragraphs: [
          "Before filing a formal claim, please contact hello@neotypelab.com and describe the issue so we can try to resolve it. These Terms are governed by the law applicable to your relationship with the NeotypeLab operator, without displacing any mandatory consumer protections available where you live. The competent courts and any required alternative dispute process will be determined under applicable law.",
        ],
      },
      {
        title: "Changes to these Terms",
        paragraphs: [
          "We may update these Terms to reflect changes to the Service, providers, law, or risk. We will update the date above and, for material changes, provide reasonable notice through the Service or by another appropriate method. Changes apply prospectively from their stated effective date. If you do not agree to an update, you must stop using the Service before it takes effect.",
        ],
      },
      {
        title: "Contact",
        paragraphs: [
          "Questions about these Terms, copyright concerns, and account-closure requests may be sent to hello@neotypelab.com. Please include enough detail for us to identify the account, page, or transaction involved, but do not send passwords, full payment-card details, or other unnecessary sensitive information.",
        ],
      },
    ],
  },
  {
    id: "privacy",
    number: "02",
    title: "Privacy Policy",
    summary: "How NeotypeLab handles your account and paint-plan data.",
    updatedLabel: "Updated Oct 8, 2026",
    effectiveLabel: "Effective Sep 22, 2026",
    href: appPaths.legalPrivacy,
    sections: [
      {
        title: "Scope and who is responsible",
        paragraphs: [
          "This Privacy Policy explains how the NeotypeLab service operator (“NeotypeLab,” “we,” “us,” or “our”) collects, uses, discloses, and retains personal information when you use our websites, applications, model-kit repaint tools, generated-content library, public showcases, and related services (the “Service”).",
          "NeotypeLab is the controller of the personal information described here unless another service is clearly identified as acting independently. For privacy questions or requests, contact hello@neotypelab.com.",
        ],
      },
      {
        title: "Information you provide",
        items: [
          "Account and profile information, such as your name, email address, profile image, handle, creator bio, specialties, and account preferences. Authentication credentials are handled by our identity provider rather than stored by NeotypeLab as plain-text passwords.",
          "Creative inputs, including prompts, style descriptions, selected kits, palettes, material and weathering choices, reference images, uploaded files, and instructions used to create a concept.",
          "Generated project information, including concepts, render specifications, paint recommendations, generated images, versions, exports, publication settings, remix lineage, favorites, and saved styles.",
          "Communications and support information, including feedback reports, titles and messages, screenshots or other attachments, related Build or concept identifiers, and our response to you.",
          "Public content and community activity, including content you publish, profile details you make public, likes, saves, and other interactions with public or unlisted content.",
          "Purchase-related information, such as plan, subscription status, billing period, Credit grants and usage, order or provider identifiers, and webhook events. Full payment-card details are processed by the applicable payment provider and are not intended to be stored by NeotypeLab.",
        ],
      },
      {
        title: "Information collected automatically",
        items: [
          "Technical and connection information, such as IP address, browser and device type, operating system, referring page, request timestamps, error information, and security logs generated by our hosting, authentication, database, and delivery providers.",
          "Service-usage and transaction information, such as sign-in and last-active time, pages or features used, generation-job status, provider and request identifiers, Credit ledger entries, storage usage, download requests, publication events, and actions taken to prevent abuse or recover failed requests.",
          "Essential cookies, tokens, and similar storage used to maintain a session, authenticate requests, protect against fraud, remember security state, and deliver the Service. We do not currently use third-party advertising cookies or sell browsing profiles for targeted advertising.",
        ],
      },
      {
        title: "Information from other sources",
        paragraphs: [
          "We receive account identity and profile fields from our authentication provider; subscription and transaction status from a billing provider if you make a purchase; generation results and related request metadata from configured text and image providers; and delivery, security, or error information from infrastructure providers. We may also receive a copyright, safety, or abuse report about content or an account from another person.",
        ],
      },
      {
        title: "How we use information",
        items: [
          "Create and secure accounts, authenticate users, maintain sessions, and provide owner-only access to private libraries and downloads.",
          "Compose prompts and specifications, run requested text and image generation, create previews and paint plans, store versions, process exports, and recover or refund eligible failed jobs.",
          "Operate Credits, subscriptions, entitlements, storage quotas, Original-file retention, and transaction records.",
          "Publish content at your direction, provide public or unlisted pages, attribute creators, support likes, saves and remix lineage, and withdraw publications when requested.",
          "Respond to feedback and support requests, investigate generation issues, administer rewards, and communicate service or policy updates.",
          "Maintain reliability and security, detect fraud and abuse, enforce our Terms, moderate content, audit administrator actions, and troubleshoot provider or storage failures.",
          "Understand aggregate feature performance and improve workflows, interfaces, catalog quality, generation instructions, and safety. We do not use private content to train a NeotypeLab general-purpose AI model unless we first disclose that use and obtain any consent required by law.",
          "Comply with legal obligations, preserve or disclose evidence when lawfully required, establish or defend legal claims, and respond to copyright or other rights complaints.",
        ],
      },
      {
        title: "Legal bases for processing",
        paragraphs: [
          "Where data-protection law requires a legal basis, we process information as necessary to perform our contract with you, including providing generation, storage, publication, account, and billing features. We also process information for legitimate interests such as securing and improving the Service, preventing abuse, supporting users, keeping appropriate business records, and protecting legal rights, balanced against your interests and rights.",
          "We process information to comply with law when required. Where we rely on consent—such as for an optional use that requires consent—you may withdraw it at any time, without affecting processing already completed. If we later introduce non-essential analytics or advertising technologies that require consent, we will provide the relevant notice and controls before using them.",
        ],
      },
      {
        title: "AI generation and automated processing",
        paragraphs: [
          "When you request an interpretation, palette, specification, or image, the Service sends the inputs needed for that request to the configured generation provider. These inputs may include your prompt or style description, selected catalog attributes, a compiled generation instruction, and eligible reference images. The provider returns generated text or image data and technical metadata. NeotypeLab stores validated results, job records, and selected provider identifiers so the workflow can continue and failures can be investigated.",
          "Current providers are Google Gemini, accessed through the Google Gemini API, for text processing, and OpenAI GPT Image, served through Cloudflare Workers AI, for image rendering. Before a request is sent to a generation provider, its prompt text is screened by Waffo’s content safety service, which returns a verdict and does not retain the prompt text. Provider availability and routing can change; our AI Acceptable Use Policy lists the current models. Each provider processes data under its own terms and privacy commitments, and its location may differ from yours. Do not include personal, confidential, or regulated information in creative inputs unless it is necessary and you are authorized to do so.",
          "Generation is automated, but NeotypeLab does not use automated processing to make decisions that produce legal or similarly significant effects about you. Safety systems may automatically reject a request, and anti-abuse signals may limit an account; you may contact us if you believe a restriction was made in error.",
        ],
      },
      {
        title: "How we disclose information",
        paragraphs: [
          "We disclose personal information only as described below. We do not sell personal information for money and do not share it for cross-context behavioral advertising.",
        ],
        items: [
          "Service providers: authentication providers such as Clerk; database and application infrastructure such as Convex; hosting, security, delivery, and object storage such as Cloudflare and R2-compatible services; configured AI generation providers; payment processors; and communication or email providers. They receive information needed to perform services for us.",
          "At your direction or publicly: information you choose to publish can be available to visitors, search engines where indexing is enabled, link recipients, and users who save or remix eligible work. An unlisted link is not private.",
          "Safety, rights, and legal process: information may be disclosed to rights holders, affected users, advisors, courts, regulators, law enforcement, or other parties when reasonably necessary to respond to valid process, investigate abuse, protect safety or rights, or handle a copyright complaint or counter-notice.",
          "Business transfers: information may be disclosed as part of a merger, financing, reorganization, sale of assets, or similar transaction, subject to appropriate confidentiality and any legally required notice.",
          "Aggregated or de-identified information: we may use and disclose information that cannot reasonably identify you, and we will not attempt to re-identify it except to test our de-identification safeguards where permitted by law.",
        ],
      },
      {
        title: "Public and unlisted content",
        paragraphs: [
          "Public content may include your handle, profile image, creator details, prototype title and settings, generated images, selected kit or style information, publication date, engagement counts, and remix or source attribution. Unlisted content can be viewed by anyone who receives the link. Do not publish information you want to keep confidential.",
          "Withdrawing a publication removes it from active NeotypeLab discovery and starts removal of public storage copies. Search-engine results, social previews, CDN caches, third-party archives, or copies made by others may persist for a period outside our control. Private source files remain subject to your library choices, entitlements, and retention rules.",
        ],
      },
      {
        title: "Data retention",
        paragraphs: [
          "We keep personal information for as long as reasonably necessary to provide the Service, maintain security and transaction integrity, comply with law, resolve disputes, and enforce agreements. Retention depends on the type of record and how it is used.",
        ],
        items: [
          "Account, profile, private-library, concept, and Credit records are generally kept while the account is active and then for the period needed to complete an account-closure request, protect users, or meet legal and accounting obligations.",
          "Generated Original files follow the retention period shown for your active entitlement at creation, unless eligible permanent storage or a Keep Original action applies. Optimized Master, Preview, and Thumbnail versions can have a different retention lifecycle. Superseded versions may expire separately.",
          "Public copies remain while a publication is active and are queued for removal after withdrawal. Limited cached or backup copies may remain temporarily.",
          "Billing, Credit, subscription, security, moderation, copyright, administrator audit, and legal records may be retained longer when needed for fraud prevention, tax or accounting, dispute resolution, or compliance.",
          "Feedback reports and attachments are kept for support, product improvement, and audit history until no longer needed. You may ask us to delete an unnecessary attachment, subject to legal or security retention.",
        ],
      },
      {
        title: "Security",
        paragraphs: [
          "We use administrative, technical, and organizational safeguards designed for the nature of the information we handle. Private library assets use owner checks and short-lived signed download URLs; public publication copies are stored separately; provider secrets are kept server-side; and administrative actions are access-controlled and logged where supported.",
          "No online service can guarantee absolute security. You are responsible for protecting your account and for avoiding unnecessary sensitive information in prompts, uploads, feedback, and public pages. If you believe your account or information has been compromised, contact hello@neotypelab.com promptly.",
        ],
      },
      {
        title: "International data transfers",
        paragraphs: [
          "NeotypeLab and its service providers may process information in countries other than the country where you live. Those countries may have different data-protection laws. Where required, we use an available legal transfer mechanism and appropriate safeguards, such as contractual protections, and you may contact us for more information about safeguards relevant to your information.",
        ],
      },
      {
        title: "Your privacy choices and rights",
        paragraphs: [
          "Depending on where you live, you may have the right to request access to, correction of, deletion of, or a portable copy of personal information; to object to or restrict certain processing; to withdraw consent; and to appeal our response. You may also have the right to complain to your local data-protection authority. These rights can be subject to exceptions, including the rights of others and requirements to preserve transaction, security, or legal records.",
          "You can edit certain profile and publication settings in the Service, withdraw eligible public content, clean up eligible stored files, and cancel a subscription through the available controls. For a privacy request or account closure, email hello@neotypelab.com from the address associated with your account and describe your request. We may need to verify your identity and authority before acting. Authorized agents may submit requests where local law permits, subject to verification.",
          "We do not discriminate against users for exercising privacy rights. If we deny a request, we will explain the reason when required and tell you how to appeal. NeotypeLab does not currently sell personal information or share it for cross-context behavioral advertising, so there is no sale or advertising-sharing opt-out required for our current practices.",
        ],
      },
      {
        title: "Children’s privacy",
        paragraphs: [
          "The Service is not directed to children under 16, and we do not knowingly collect personal information from them. If you believe a child under 16 has provided personal information to the Service, contact hello@neotypelab.com so we can investigate and take appropriate action. A higher age threshold may apply where required by local law.",
        ],
      },
      {
        title: "Third-party sites and services",
        paragraphs: [
          "The Service may link to paint manufacturers, stores, creators, billing pages, social services, or other third-party sites. Their privacy practices are governed by their own notices. This Policy does not cover information a third party collects independently when you leave NeotypeLab or choose to interact with its service.",
        ],
      },
      {
        title: "Changes to this Policy",
        paragraphs: [
          "We may update this Policy as the Service, providers, and legal requirements change. We will update the date above and provide additional notice for material changes when required. If a change requires consent, it will not apply to the relevant processing until the required consent is obtained.",
        ],
      },
      {
        title: "Contact us",
        paragraphs: [
          "For privacy questions, rights requests, account closure, or security concerns, email hello@neotypelab.com. Please do not include passwords, full payment-card details, government identification, or other sensitive information unless we specifically request it through a secure method.",
        ],
      },
    ],
  },
  {
    id: "acceptable-use",
    number: "03",
    title: "AI Acceptable Use Policy",
    summary: "The six prohibited content categories, the AI models we use, how prompts are moderated, and how we enforce, handle reports, and review appeals.",
    updatedLabel: "Updated Oct 8, 2026",
    effectiveLabel: "Effective Oct 8, 2026",
    href: appPaths.acceptableUse,
    sections: [
      {
        title: "Scope",
        paragraphs: [
          "NeotypeLab provides AI-assisted creative tools for scale model painting concepts, color exploration, and digital design. This AI Acceptable Use Policy (“Policy”) forms part of our Terms of Service; where the two conflict on a content or conduct question, the stricter rule applies. The Policy applies to all content submitted, generated, stored, or published through the Service, including:",
        ],
        items: [
          "User inputs: prompts, Custom Style descriptions, notes, and other instructions you submit.",
          "Text: AI-generated style interpretations, color and paint plans, and repaint specifications.",
          "Images: AI-generated previews and renders, and reference images you upload.",
          "Published content: anything you make public or unlisted, including styles, builds, and profile details.",
        ],
      },
      {
        title: "Prohibited content categories",
        paragraphs: [
          "NeotypeLab prohibits generating, requesting, uploading, storing, or publishing content in any of the following six categories, whether it appears in a prompt, a style description, notes, an uploaded file, a generated output, or a published page:",
        ],
        items: [
          "1. Pornography / NSFW content — pornography, sexually explicit or fetish imagery, nudity presented for sexual purposes, and non-consensual intimate content. NeotypeLab does not permit adult content in any form.",
          "2. Violence / gore — graphic or gratuitous violence, graphic injury, blood and gore, torture, and content that glorifies, celebrates, or incites real-world violence, terrorism, or violent extremism. Fictional mecha, armor, and model-kit weaponry shown as part of a paint concept is permitted; realistic depictions of harm to people or animals are not.",
          "3. Hate speech — content that promotes hatred, discrimination, dehumanization, harassment, or violence against people based on race, ethnicity, national origin, religion, disability, sex, gender identity, sexual orientation, or another protected characteristic, including hate symbols used to promote such views.",
          "4. Child-unsafe content (CSAM) — any sexualization, sexual exploitation, or abuse of minors, including fictional, stylized, or AI-generated depictions, and any other content that endangers children.",
          "5. Deepfakes / impersonation — realistic depictions of real people without their consent, manipulation of a real person’s likeness, impersonation of real individuals, brands, or organizations, and content presented as authentic or official when it is not.",
          "6. Copyright / trademark infringement — unauthorized reproduction of copyrighted artwork, characters, packaging, decals, logos, trademarks, or another creator’s distinctive work in violation of applicable law. Referring to a model kit or brand to identify a compatible subject is permitted; copying protected designs or presenting output as an official product is not.",
        ],
      },
      {
        title: "Zero-tolerance content",
        paragraphs: [
          "The following are actioned immediately with a permanent ban, without prior warning, and may be reported to law enforcement or other appropriate authorities:",
        ],
        items: [
          "Child sexual abuse material (CSAM) or any sexual content involving minors.",
          "Content that promotes or facilitates terrorism, violent extremism, or mass violence.",
          "Instructions for creating weapons capable of mass casualties, explosives, or other serious real-world harm.",
          "Content inciting genocide or ethnic hatred.",
          "Non-consensual sexual or intimate deepfakes of real individuals.",
        ],
      },
      {
        title: "Prohibited conduct",
        paragraphs: ["You must also not:"],
        items: [
          "Use jailbreak prompts or otherwise attempt to bypass, probe, or defeat our safety screening—for example by splitting, encoding, misspelling, or translating prohibited requests, or by repeatedly resubmitting a rejected request with small changes.",
          "Pass AI-generated output off as human-made work, a photograph of a real physical build, or an official product image where that would mislead others.",
          "Generate or spread misinformation, or use the Service for fraud, spam, sanctions evasion, or any purpose that violates applicable law or the rights of others, including privacy and publicity rights.",
          "Use automated or high-volume access, share accounts, or resell access to the AI tools without our written permission.",
        ],
      },
      {
        title: "AI models we use",
        paragraphs: [
          "NeotypeLab is an independent product and is not affiliated with or endorsed by the model providers below. We do not train our own foundation models. Generation is performed by the following third-party models, which our servers call through their provider APIs on your behalf:",
        ],
        items: [
          `Image generation — ${imageModel.model}, developed by ${imageModel.developer} and served through ${imageModel.servedVia}. Used for ${imageModel.uses}.`,
          `Text generation — ${textModel.model}, developed by ${textModel.developer} and accessed through ${textModel.servedVia}. Used for ${textModel.uses}.`,
          `Prompt safety screening — ${safetyProvider.service} (Waffo Prompt Sift), a stateless check that does not retain prompt text after returning a verdict.`,
          "Only the inputs needed for a request—such as your prompt or style description, selected kit and style attributes, the compiled generation instruction, and eligible reference images—are sent to these providers. Provider routing can change; this section is updated when it does. All generated images and text are AI-generated.",
        ],
      },
      {
        title: "Content moderation",
        paragraphs: [
          "NeotypeLab moderates content in several layers:",
        ],
        items: [
          "Prompt screening before generation: every text and image generation request is checked against a keyword and phrase blocklist covering all six prohibited categories, which we maintain and update as new patterns appear, and is then screened by an automated content safety service using keyword and semantic detection before it is sent to an AI model. Flagged requests are not generated. Requests that cannot be screened—for example, because the safety service is temporarily unavailable—are also not generated.",
          "Model-level output filtering: the image and text models we use apply their providers’ own safety systems, which can refuse unsafe requests or withhold unsafe outputs. Refused results are not delivered to you.",
          "Review of published content: content made public or unlisted can be reviewed, hidden, or withdrawn by our team, and every report is reviewed by a person.",
          "Moderation records: we keep records of automated screening verdicts (without storing the prompt text itself) and of human review decisions, and use them to investigate reports, handle appeals, and identify repeated violations.",
        ],
      },
      {
        title: "Enforcement actions",
        paragraphs: [
          "Depending on the severity, frequency, and context of a violation, we take one or more of the following actions:",
        ],
        items: [
          "Request rejection: the generation request is blocked before reaching the model. Credits for a blocked request are returned where the applicable workflow refunds failed generations.",
          "Warning: written notice for a first-time or minor violation.",
          "Content removal: violating content is taken down, unpublished, or removed from discovery and remix features.",
          "Feature restriction: generation, publishing, or other features are temporarily restricted for repeated or more serious violations.",
          "Account suspension or permanent ban: accounts are suspended for serious or repeated violations and permanently banned for zero-tolerance violations or repeated serious violations. Unused Credits on a banned account may be forfeited where permitted by law.",
          "Legal referral: zero-tolerance violations may be reported to law enforcement, and we cooperate with lawful investigations.",
        ],
      },
      {
        title: "Reporting violations",
        paragraphs: [
          "Anyone—users, rights holders, or members of the public—can report content or behavior that may violate this Policy, including child-safety concerns, impersonation, or infringement of your own rights, by emailing hello@neotypelab.com with the subject “AUP Report.” Please include the page URL or Build N° and a short description of the concern. For copyright complaints, also include the information listed in the Copyright section of our Terms of Service.",
          "Reports are handled as follows: we acknowledge receipt, triage by severity, review the content, decide, apply any enforcement action, and notify the reporter. Child-safety and terrorism reports are prioritized and the content is restricted within 24 hours of receipt; other reports receive an initial response within 5 working days and a decision within 15 working days. If a case needs longer, we tell the reporter why. Reporter identities are kept confidential, and knowingly false or abusive reports may themselves lead to enforcement.",
        ],
      },
      {
        title: "Appeals",
        paragraphs: [
          "If you believe a generation request was rejected, or content or an account was restricted, by mistake, email hello@neotypelab.com with the subject “AUP Appeal” within 30 days. Include the reference code shown with a rejected request, if any, and explain why you believe the decision was wrong. A person will review the appeal and reply within 10 working days.",
        ],
      },
      {
        title: "Policy updates",
        paragraphs: [
          "We may update this Policy to address evolving safety requirements, applicable laws, provider terms, and platform capabilities. We will update the date above and, for material changes, provide reasonable notice through the Service. Continued use after an update takes effect means the updated Policy applies.",
        ],
      },
      {
        title: "Contact",
        paragraphs: [
          "Safety reports, appeals, and questions about this Policy: hello@neotypelab.com.",
        ],
      },
    ],
  },
];

export function getLegalDocument(id: LegalDocumentId) {
  const document = legalDocuments.find((entry) => entry.id === id);
  if (!document) {
    throw new Error(`Unknown legal document: ${id}`);
  }
  return document;
}
