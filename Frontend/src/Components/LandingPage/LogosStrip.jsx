export default function LogosStrip() {
  return (
    <section className="bg-slate-50 border-y border-slate-100 py-10 px-6">
      <div className="max-w-5xl mx-auto text-center">
        <p className="text-slate-400 text-sm font-medium mb-8 uppercase tracking-widest">Trusted by restaurants across India</p>
        <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-4">
          {["Barbeque Nation", "Chai Point", "Box8", "Faasos", "Rebel Foods", "Wow! Momo"].map(brand => (
            <span key={brand} className="text-slate-400 font-semibold text-sm tracking-tight hover:text-slate-600 transition-colors cursor-default">{brand}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
