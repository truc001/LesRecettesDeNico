import Image from "next/image";
import Link from "next/link";

export function SiteBrand({ href }: { href: string }) {
  return <Link className="brand" href={href} aria-label="Les recettes de Nico, accueil">
    <span className="brand-logo">
      {/* Bubbles that rise from the pot while the logo is hovered. */}
      <span className="brand-puff" aria-hidden="true" /><span className="brand-puff" aria-hidden="true" /><span className="brand-puff" aria-hidden="true" />
      <Image className="brand-mark" src="/logo.png" alt="" width={56} height={56} priority />
    </span>
    <span>Les recettes <strong>de Nico<span className="brand-dot">.</span></strong></span>
  </Link>;
}
