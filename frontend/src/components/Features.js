import { useTranslation } from "react-i18next";


export default function Features() {
  const { t } = useTranslation();

  const feats = [
    {
      icon: "⭐️",
      title: t("feature1_title"),
      text: t("feature1_text"),
    },
    {
      icon: "⚡",
      title: t("feature2_title"),
      text: t("feature2_text"),
    },
    {
      icon: "🔒",
      title: t("feature3_title"),
      text: t("feature3_text"),
    },
    {
      icon: "📈",
      title: t("feature4_title"),
      text: t("feature4_text"),
    },
  ];

  return (
    <section id="features" className="py-16 bg-gray-50">
      <div className="container mx-auto text-center">
        <h2 className="text-3xl font-bold mb-8">
          {t("why_choose_volmagique")}
        </h2>
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
