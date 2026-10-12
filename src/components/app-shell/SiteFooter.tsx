import { Link } from "@tanstack/react-router";
import { appPaths } from "@/src/lib/appPaths";

const SUPPORT_EMAIL = "hello@neotypelab.com";

const policyLinks = [
  { href: appPaths.legalTerms, label: "Terms of Service" },
  { href: appPaths.legalPrivacy, label: "Privacy Policy" },
  { href: appPaths.acceptableUse, label: "Acceptable Use" },
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__brand">
        <p className="site-footer__mark">NeotypeLab / Vol.02</p>
        <a
          className="site-footer__taaft"
          href="https://theresanaiforthat.com/ai/neotypelab/?ref=social-icon&v=7394648"
          rel="nofollow noopener noreferrer"
          target="_blank"
        >
          <img
            alt="Featured on TAAFT"
            height={32}
            src="https://media.theresanaiforthat.com/social/icon_full.svg"
            width={32}
          />
        </a>
      </div>
      <nav aria-label="Legal" className="site-footer__nav">
        {policyLinks.map((item) => (
          <Link key={item.href} preload="intent" to={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
      <p className="site-footer__support">
        <span>Support</span>
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </footer>
  );
}
