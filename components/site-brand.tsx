import Link from "next/link";
import { ChefHat } from "lucide-react";

export function SiteBrand({ href }: { href: string }) {
  return <Link className="brand" href={href} aria-label="Les recettes de Nico, accueil">
    <span className="brand-mark"><ChefHat size={25} aria-hidden="true" /></span>
    <span>Les recettes <strong>de Nico<span className="brand-dot">.</span></strong></span>
  </Link>;
}
