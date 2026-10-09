import Image from "next/image";
import Link from "next/link";

export function SiteBrand({ href }: { href: string }) {
  return <Link className="brand" href={href} aria-label="Les recettes de Nico, accueil">
    <Image className="brand-mark" src="/logo.png" alt="" width={56} height={56} priority />
    <span>Les recettes <strong>de Nico<span className="brand-dot">.</span></strong></span>
  </Link>;
}
