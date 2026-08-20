export default function ProductPreview() {
  return (
    <section className="py-28 px-6 lg:px-10 bg-gradient-to-b from-slate-900 to-[#060d1f] relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-32 bg-gradient-to-b from-transparent via-orange-500/50 to-transparent" />
      <div className="max-w-7xl mx-auto text-center">
        <span className="inline-block text-orange-500 text-xs font-semibold tracking-widest uppercase mb-3">Live Dashboard</span>
        <h2 className="display text-4xl lg:text-5xl font-800 text-white mb-5 tracking-tight">See everything at a glance</h2>
        <p className="text-slate-400 text-lg max-w-xl mx-auto mb-16">One screen. Every outlet. Every order. Powered by AI that never sleeps.</p>

        {/* Mock full dashboard */}
        <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] max-w-5xl mx-auto">
          <div className="flex items-center gap-2 px-5 py-3.5 bg-[#0a1628] border-b border-white/5">
            <span className="w-3 h-3 rounded-full bg-rose-500" />
            <span className="w-3 h-3 rounded-full bg-amber-400" />
            <span className="w-3 h-3 rounded-full bg-emerald-400" />
            <span className="ml-4 text-slate-500 text-xs">MenuMind — Central Dashboard</span>
          </div>
          <div className="bg-[#0b1930] p-6 grid grid-cols-4 gap-4 min-h-64">
            {/* Sidebar */}
            <div className="col-span-1 space-y-2">
              {["Dashboard", "Orders", "Menu", "Analytics", "Pricing AI", "Customers"].map((item, i) => (
                <div key={item} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium ${i === 0 ? "bg-orange-500/20 text-orange-400" : "text-slate-500 hover:text-slate-300"}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {item}
                </div>
              ))}
            </div>
            {/* Main content */}
            <div className="col-span-3 space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {[["₹2.4L", "Revenue"], ["1,240", "Orders"], ["₹194", "Avg. Value"], ["94%", "Sat. Score"]].map(([v, l]) => (
                  <div key={l} className="bg-white/5 rounded-xl p-3 text-left">
                    <div className="display text-white font-700 text-xl">{v}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{l}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-slate-400 text-xs mb-3">Hourly Orders</div>
                  <div className="flex items-end gap-1 h-16">
                    {[30,55,40,70,90,85,60,75,95,80,65,50].map((h,i)=>(
                      <div key={i} className="flex-1 rounded-sm" style={{height:`${h}%`,background:i===8?"linear-gradient(to top,#f97316,#ef4444)":"rgba(255,255,255,0.07)"}} />
                    ))}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-orange-600/20 to-rose-600/20 border border-orange-500/20 rounded-xl p-4 text-left">
                  <div className="text-orange-400 text-xs font-semibold mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                    3 AI Suggestions
                  </div>
                  <ul className="space-y-2 text-slate-300 text-xs">
                    <li>↑ Increase Biryani price by ₹25</li>
                    <li>✦ Push Gulab Jamun combo at 2pm</li>
                    <li>⊗ Remove slow item: Veg Pulao</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bullets */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 text-left max-w-4xl mx-auto">
          {[
            { icon: "📊", title: "Real-time Analytics", desc: "Live P&L, cover counts, and item-level margins updated every 60 seconds across all outlets." },
            { icon: "✦", title: "Smart Upsell Suggestions", desc: "AI detects the right moment to recommend a combo or dessert — boosting check averages effortlessly." },
            { icon: "💡", title: "AI-Driven Pricing", desc: "Dynamic pricing engine adjusts prices during peak hours, weather events, and inventory surplus." },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="flex gap-4">
              <span className="text-2xl mt-0.5">{icon}</span>
              <div>
                <h4 className="display text-white font-700 text-base mb-1.5">{title}</h4>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
