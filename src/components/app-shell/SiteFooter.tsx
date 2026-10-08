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
      <p className="site-footer__mark">NeotypeLab / Vol.02</p>
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
