"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TIME_FILTERS } from "@/lib/recipe-browse";
import type { BrowseState } from "@/lib/use-browse-state";

type Props = {
  state: BrowseState;
  moments: Array<{ id: string; label: string }>;
  tags: string[];
  resultCount: number;
  onChange: (patch: Partial<BrowseState>) => void;
  onClear: () => void;
};

/** Every filter in a sheet that slides up from the bottom: on a phone the row of chips runs off the screen. */
export function FilterSheet({ state, moments, tags, resultCount, onChange, onClear }: Props) {
  const active = [state.group, state.time, state.tag].filter(Boolean).length;
  const chip = (label: string, pressed: boolean, pick: () => void) => <button key={label} type="button" aria-pressed={pressed} className={pressed ? "filter-active" : ""} onClick={pick}>{label}</button>;
  return <Dialog>
    <DialogTrigger asChild><button className="filter-button"><SlidersHorizontal size={17} aria-hidden="true" /> Filtres{active > 0 && <span>{active}</span>}</button></DialogTrigger>
    <DialogContent className="filter-sheet">
      <div className="sheet-heading">
        <DialogTitle>Filtrer</DialogTitle>
        <button type="button" className="sheet-clear" onClick={onClear} disabled={active === 0}>Tout effacer</button>
      </div>
      <DialogDescription className="sr-only">Choisissez un moment, un temps maximum ou une étiquette.</DialogDescription>
      <section><h3>Moment</h3><div className="filter-row">{moments.map((moment) => chip(moment.label, state.group === moment.id, () => onChange({ group: state.group === moment.id ? "" : moment.id })))}</div></section>
      <section><h3>Temps</h3><div className="filter-row">{TIME_FILTERS.map((option) => chip(option.label, state.time === option.id, () => onChange({ time: state.time === option.id ? "" : option.id })))}</div></section>
      {tags.length > 0 && <section><h3>Étiquette</h3><div className="filter-row">{tags.map((name) => chip(`#${name}`, state.tag === name, () => onChange({ tag: state.tag === name ? "" : name })))}</div></section>}
      <DialogClose asChild><Button type="button" className="sheet-apply">Voir {resultCount} recette{resultCount !== 1 ? "s" : ""}</Button></DialogClose>
    </DialogContent>
  </Dialog>;
}
