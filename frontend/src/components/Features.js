const feats = [
  {
    icon: "⭐️",
    title: "Premium Deals",
    text: "Top 10 vols & alertes à venir",
  },
  { icon: "⚡", title: "Fast & Free", text: "Emails instantanés, aucun coût" },
  {
    icon: "🔒",
    title: "Secure",
    text: "Données protégées, confidentialité assurée",
  },
  {
    icon: "📈",
    title: "Data-Driven",
    text: "Analyses approfondies pour des décisions éclairées",
  },
];
export default function Features() {
  return (
    <section id="features" className="py-16 bg-gray-50">
      <div className="container mx-auto text-center">
        <h2 className="text-3xl font-bold mb-8">Pourquoi VolMagique ?</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {feats.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="p-6 bg-white rounded-xl shadow hover:shadow-md transition"
            >
              <div className="text-4xl mb-4">{Icon}</div>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-gray-600">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
