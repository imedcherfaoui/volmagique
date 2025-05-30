// testSend.js
import sgMail from "@sendgrid/mail";
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

(async () => {
  try {
    await sgMail.send({
      to: "votre-email@exemple.com",
      from: { email: "deals.volmagique@gmail.com", name: "VolMagique" },
      templateId: process.env.SENDGRID_CONFIRMATION_TEMPLATE_ID,
      dynamicTemplateData: {
        email: "votre-email@exemple.com",
        date: new Date().toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        plan: "Premium",
      },
    });
    console.log("✔️ E-mail de test envoyé");
  } catch (err) {
    console.error("❌ Erreur testSend:", err.response?.body || err);
  }
})();
