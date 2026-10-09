import Image from "next/image";
import { ArrowRight, BookOpen, ChefHat } from "lucide-react";

export function Hero({ recipeCount, onExplore }: { recipeCount: number | null; onExplore: () => void }) {
  return <section className="hero" aria-labelledby="hero-title">
    <div className="hero-text">
      <p className="eyebrow"><span /> Le bonheur est fait maison</p>
      <h1 id="hero-title">Un peu de vous.<br />Beaucoup de <em>gourmandise.</em></h1>
      <p className="hero-copy">Les recettes qu’on aime faire, refaire et partager. Bienvenue dans mon carnet de cuisine.</p>
      <a className="primary-link" href="#carnet" onClick={onExplore}>Explorer les recettes <ArrowRight size={19} aria-hidden="true" /></a>
      <div className="hero-note"><BookOpen size={19} aria-hidden="true" /><span>{recipeCount === null ? "Votre carnet de recettes, à votre rythme." : `${recipeCount} recette${recipeCount !== 1 ? "s" : ""} à cuisiner, à votre rythme.`}</span></div>
    </div>
    <div className="hero-visual">
      <div className="hero-photo"><Image src="/tarte-tatin.jpg" alt="Tarte aux pommes caramélisées, tout juste servie à table" fill priority sizes="(max-width: 760px) 100vw, 50vw" /></div>
      <div className="photo-note"><ChefHat size={25} aria-hidden="true" /><div><strong>Simplement bon.</strong><span>Le plaisir de cuisiner maison.</span></div></div>
      <span className="photo-stamp" aria-hidden="true">Une pincée<br />de bonheur</span>
    </div>
  </section>;
}
