import Image from "next/image";
import { BookOpen, ChefHat } from "lucide-react";

export function Hero({ recipeCount }: { recipeCount: number | null }) {
  return <section className="hero" aria-labelledby="hero-title">
    <div className="hero-text">
      <p className="eyebrow"><span /> Le bonheur est fait maison</p>
      <h1 id="hero-title">Un peu de vous. Beaucoup de <em>gourmandise.</em></h1>
      <p className="hero-copy">Les recettes qu’on aime faire, refaire et partager. Bienvenue dans mon carnet de cuisine.</p>
      <div className="hero-note"><BookOpen size={19} aria-hidden="true" /><span>{recipeCount === null ? "Votre carnet de recettes, à votre rythme." : `${recipeCount} recette${recipeCount !== 1 ? "s" : ""} à cuisiner, à votre rythme.`}</span></div>
    </div>
    <div className="hero-visual">
      <div className="hero-photo"><Image src="/tarte-tatin.jpg" alt="Tarte aux pommes caramélisées, tout juste servie à table" fill priority sizes="(max-width: 760px) 100vw, 40vw" /></div>
      <div className="photo-note"><ChefHat size={22} aria-hidden="true" /><div><strong>Simplement bon.</strong><span>Le plaisir de cuisiner maison.</span></div></div>
    </div>
  </section>;
}
