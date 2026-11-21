import { ArrowUpRight, Plus } from "lucide-react";

/** Symbolic generated artwork; it does not depict or verify the selected home. */
export function HouseBookCover({
  onCapture,
  onExplore,
}: {
  onCapture: () => void;
  onExplore: () => void;
}) {
  return (
    <section className="housebook-cover" aria-label="Welkom in je huisdossier">
      <div className="housebook-intro">
        <h2>Goed voor je huis.</h2>
        <p>
          Foto's, handige weetjes en kleine klussen. Alles krijgt hier een fijne
          plek.
        </p>
        <div className="housebook-actions">
          <button className="button primary" onClick={onCapture}>
            <Plus size={18} /> Iets toevoegen
          </button>
          <button className="cover-explore" onClick={onExplore}>
            Je huis in 3D <ArrowUpRight size={18} />
          </button>
        </div>
      </div>
      <div className="housebook-art" aria-hidden="true">
        <img
          src="/illustrations/huisvriend.png"
          width="1536"
          height="1024"
          alt=""
          fetchPriority="high"
        />
      </div>
    </section>
  );
}
